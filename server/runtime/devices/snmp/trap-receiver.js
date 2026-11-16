/**
 * Shared SNMP notification receiver (traps and informs): one UDP listener for each port/transport,
 * the notifications are dispatched to the subscribed devices by sender address and credentials
 */

'use strict';

const dns = require('dns');

const BIND_RETRY_MS = 30000;            // after a bind failure the port is refused for this time before the bind is retried
const WARN_THROTTLE_MS = 60000;         // repeated warnings of the same kind are logged once per minute

const listeners = {};       // key 'transport:port' -> { receiver, subscribers: { deviceId: subscriber } }
const bindFailures = {};    // key -> { error, until }
const warnings = {};        // key -> last log time of a throttled warning

/**
 * Subscribe a device to the notifications of a port
 * @param {*} snmp net-snmp module
 * @param {*} settings { port, transport }
 * @param {*} subscriber { id, name, address, community, user, onNotification(pdu, rinfo), onError(err) }
 * @param {*} logger
 * @returns function to unsubscribe
 * @throws when a v3 user with the same name but different keys is already registered on the port
 * (the receiver resolves the users by name, one port can hold only one credential set for each user name),
 * or when the port could not be bound in the last BIND_RETRY_MS
 */
async function register(snmp, settings, subscriber, logger) {
    const key = `${settings.transport || 'udp4'}:${settings.port}`;
    const failure = bindFailures[key];
    if (failure) {
        if (Date.now() < failure.until) {
            throw new Error(`trap receiver ${key}: ${failure.error.message}, retry in ${Math.ceil((failure.until - Date.now()) / 1000)} s`);
        }
        delete bindFailures[key];
    }
    subscriber.addresses = await _resolveAddresses(subscriber.address);
    let listener = listeners[key];
    if (listener && subscriber.user) {
        const holder = Object.values(listener.subscribers).find(other => other.id !== subscriber.id && other.user &&
            other.user.name === subscriber.user.name && !_sameUser(other.user, subscriber.user));
        if (holder) {
            throw new Error(`trap receiver ${key}: user '${subscriber.user.name}' is already registered by device '${holder.name || holder.id}' with different keys, use the same credentials or another trap port`);
        }
    }
    if (!listener) {
        // the entry is stored only when the receiver is created: a synchronous failure (bad transport/port) does not leave an empty listener
        listener = { key: key, receiver: null, subscribers: {} };
        listener.receiver = snmp.createReceiver({
            port: settings.port,
            transport: settings.transport || 'udp4',
            includeAuthentication: true
        }, (err, notification) => _onReceiver(listener, err, notification, logger));
        listeners[key] = listener;
        logger.info(`snmp trap receiver listening on ${key}`, true);
    }
    listener.subscribers[subscriber.id] = subscriber;
    _syncAuthorizer(listener, logger);
    return () => unregister(key, subscriber.id, logger);
}

function unregister(key, subscriberId, logger) {
    const listener = listeners[key];
    if (!listener || !listener.subscribers[subscriberId]) {
        return;
    }
    delete listener.subscribers[subscriberId];
    if (Object.keys(listener.subscribers).length) {
        _syncAuthorizer(listener, logger);
    } else {
        _closeListener(listener, logger);
    }
}

function _onReceiver(listener, err, notification, logger) {
    if (err && !notification) {
        if (err.code === 'EACCES' || err.code === 'EADDRINUSE') {
            // bind failed: drop the listener, refuse the port for a while and let the devices reconnect
            logger.error(`snmp trap receiver ${listener.key} bind failed! ${err.message}`);
            bindFailures[listener.key] = { error: err, until: Date.now() + BIND_RETRY_MS };
            const subscribers = Object.values(listener.subscribers);
            _closeListener(listener, logger);
            subscribers.forEach(subscriber => {
                try {
                    subscriber.onError(err);
                } catch (e) {
                    logger.error(`snmp trap receiver ${listener.key} error! ${e}`);
                }
            });
        } else {
            _warnThrottled(logger, `${listener.key}:${err.message}`, `snmp trap receiver ${listener.key} ${err.message}${err.rinfo ? ` from ${err.rinfo.address}` : ''}`);
        }
        return;
    }
    if (!notification || !notification.pdu) {
        return;
    }
    const from = _normalizeAddress(notification.rinfo ? notification.rinfo.address : '');
    const pdu = notification.pdu;
    let dispatched = 0;
    Object.values(listener.subscribers).forEach(subscriber => {
        if (!subscriber.addresses.has(from) || !_isAuthorized(subscriber, pdu)) {
            return;
        }
        dispatched++;
        try {
            subscriber.onNotification(pdu, notification.rinfo);
        } catch (e) {
            logger.error(`snmp trap receiver ${listener.key} dispatch error! ${e}`);
        }
    });
    if (!dispatched) {
        _warnThrottled(logger, `${listener.key}:unmatched:${from}`, `snmp trap receiver ${listener.key} notification from ${from} without matching device`);
    }
}

/**
 * Check the notification credentials against the subscriber: community for v1/v2c, user name for v3
 */
function _isAuthorized(subscriber, pdu) {
    if (pdu.user) {
        return !!subscriber.user && subscriber.user.name === pdu.user;
    }
    return subscriber.community === pdu.community;
}

/**
 * Rebuild the receiver authorization lists from the subscribers
 */
function _syncAuthorizer(listener, logger) {
    const authorizer = listener.receiver.getAuthorizer();
    const communities = new Set();
    const users = {};
    Object.values(listener.subscribers).forEach(subscriber => {
        if (subscriber.community) {
            communities.add(subscriber.community);
        }
        if (subscriber.user) {
            users[subscriber.user.name] = subscriber.user;     // conflicting keys are rejected by register()
        }
    });
    authorizer.getCommunities().slice().forEach(community => {
        if (!communities.has(community)) {
            authorizer.deleteCommunity(community);
        }
    });
    communities.forEach(community => authorizer.addCommunity(community));
    authorizer.getUsers().slice().forEach(user => {
        if (!users[user.name]) {
            authorizer.deleteUser(user.name);
        }
    });
    Object.values(users).forEach(user => authorizer.addUser(user));
}

function _sameUser(a, b) {
    return a.level === b.level && a.authProtocol === b.authProtocol && a.authKey === b.authKey &&
        a.privProtocol === b.privProtocol && a.privKey === b.privKey;
}

/**
 * Addresses accepted as sender: the device address and, for a host name, all the resolved addresses
 */
function _resolveAddresses(address) {
    return new Promise((resolve) => {
        const addresses = new Set([_normalizeAddress(address)]);
        try {
            dns.lookup(address, { all: true }, (err, resolved) => {
                if (!err && Array.isArray(resolved)) {
                    resolved.forEach(entry => addresses.add(_normalizeAddress(entry.address)));
                }
                resolve(addresses);
            });
        } catch {
            resolve(addresses);     // keep the literal address
        }
    });
}

/**
 * An IPv4 sender on a udp6 listener appears as IPv4-mapped address '::ffff:a.b.c.d'
 */
function _normalizeAddress(address) {
    const value = String(address || '').trim().toLowerCase();
    return value.startsWith('::ffff:') ? value.substring(7) : value;
}

function _warnThrottled(logger, key, message) {
    const now = Date.now();
    if (!warnings[key] || now - warnings[key] > WARN_THROTTLE_MS) {
        warnings[key] = now;
        logger.warn(message);
    }
}

function _closeListener(listener, logger) {
    delete listeners[listener.key];
    listener.subscribers = {};
    try {
        listener.receiver.close();      // without callback: with a callback net-snmp reads the socket address first, which fails for an unbound socket
    } catch { /* socket may be already closed */ }
    logger.info(`snmp trap receiver ${listener.key} closed`, true);
}

module.exports = {
    register: register,
    /** for tests */
    _listeners: listeners,
    _bindFailures: bindFailures,
    _reset: () => {
        Object.keys(listeners).forEach(key => delete listeners[key]);
        Object.keys(bindFailures).forEach(key => delete bindFailures[key]);
        Object.keys(warnings).forEach(key => delete warnings[key]);
    }
};
