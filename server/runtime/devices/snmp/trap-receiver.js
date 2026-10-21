/**
 * Shared SNMP notification receiver (traps and informs): one UDP listener for each port/transport,
 * the notifications are dispatched to the subscribed devices by sender address and credentials
 */

'use strict';

const dns = require('dns');

const listeners = {};       // key 'transport:port' -> { receiver, subscribers: { deviceId: subscriber } }

/**
 * Subscribe a device to the notifications of a port
 * @param {*} snmp net-snmp module
 * @param {*} settings { port, transport }
 * @param {*} subscriber { id, address, community, user, onNotification(pdu, rinfo), onError(err) }
 * @param {*} logger
 * @returns function to unsubscribe
 */
function register(snmp, settings, subscriber, logger) {
    const key = `${settings.transport || 'udp4'}:${settings.port}`;
    let listener = listeners[key];
    if (!listener) {
        listener = { key: key, receiver: null, subscribers: {} };
        listeners[key] = listener;
        listener.receiver = snmp.createReceiver({
            port: settings.port,
            transport: settings.transport || 'udp4',
            includeAuthentication: true
        }, (err, notification) => _onReceiver(listener, err, notification, logger));
        logger.info(`snmp trap receiver listening on ${key}`, true);
    }
    subscriber.addresses = new Set([subscriber.address]);
    _resolveAddress(subscriber);
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
            // bind failed: drop the listener so that the next device connection retries
            logger.error(`snmp trap receiver ${listener.key} bind failed! ${err.message}`);
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
            logger.warn(`snmp trap receiver ${listener.key} ${err.message}${err.rinfo ? ` from ${err.rinfo.address}` : ''}`);
        }
        return;
    }
    if (!notification || !notification.pdu) {
        return;
    }
    const from = notification.rinfo ? notification.rinfo.address : '';
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
        logger.warn(`snmp trap receiver ${listener.key} notification from ${from} without matching device`);
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
            if (users[subscriber.user.name] && !_sameUser(users[subscriber.user.name], subscriber.user)) {
                logger.warn(`snmp trap receiver ${listener.key} user '${subscriber.user.name}' defined with different keys, last wins`);
            }
            users[subscriber.user.name] = subscriber.user;
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

function _resolveAddress(subscriber) {
    try {
        dns.lookup(subscriber.address, { all: true }, (err, addresses) => {
            if (!err && Array.isArray(addresses)) {
                addresses.forEach(entry => subscriber.addresses.add(entry.address));
            }
        });
    } catch { /* keep the literal address */ }
}

function _closeListener(listener, logger) {
    delete listeners[listener.key];
    listener.subscribers = {};
    try {
        listener.receiver.close(() => { });
    } catch { /* socket may be already closed */ }
    logger.info(`snmp trap receiver ${listener.key} closed`, true);
}

module.exports = {
    register: register,
    /** for tests */
    _listeners: listeners
};
