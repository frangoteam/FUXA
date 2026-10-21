/**
 * Driver SNMP: client for SNMP v1/v2c/v3 agents based on 'net-snmp', polling of scalar OIDs with DAQ support
 */

'use strict';

let snmp; // resolved via require or via plugin manager if needed

const utils = require('../../utils');
const deviceUtils = require('../device-utils');
const trapReceiver = require('./trap-receiver');
const mibStore = require('./mib-store');
const path = require('path');

const SYS_UPTIME_OID = '1.3.6.1.2.1.1.3.0';     // used as reachability/credentials probe on connect
const SNMP_TRAP_OID = '1.3.6.1.6.3.1.1.4.1.0';  // snmpTrapOID.0, synthesized for v1 traps (RFC 3584)
const SNMP_TRAPS_OID = '1.3.6.1.6.3.1.1.5';     // generic traps coldStart..egpNeighborLoss
const MIB2_OID = '1.3.6.1.2.1';                 // default subtree to browse
const BROWSE_MAX_RESULTS = 2000;
const BROWSE_MAX_REPETITIONS = 20;              // GetBulk repetitions used by the subtree walk (v2c/v3)
const OID_REGEX = /^\.?\d+(\.\d+)+$/;

const SnmpVersion = {
    v1: 'v1',
    v2c: 'v2c',
    v3: 'v3'
};

const DEFAULT_OPTIONS = {
    version: SnmpVersion.v3,
    transport: 'udp4',
    timeout: 5000,              // ms per request
    retries: 1,
    securityLevel: 'authPriv',  // v3 only: noAuthNoPriv | authNoPriv | authPriv
    authProtocol: 'sha256',     // v3 only: md5 | sha | sha224 | sha256 | sha384 | sha512
    privProtocol: 'aes',        // v3 only: des | aes | aes256b | aes256r
    context: '',                // v3 only
    maxOidsPerRequest: 25,      // OIDs per GET PDU, keeps the datagram under a typical MTU
    offlineAfterTimeouts: 3,    // consecutive polls without any answer before reconnect
    trapsEnabled: false,        // receive traps/informs sent by the agent (same credentials of the session)
    trapPort: 162               // port < 1024 needs privileges on Linux
};

function tryLoadSnmp(manager) {
    let mod = null;
    try { mod = require('net-snmp'); } catch { /* not installed in root */ }
    if (!mod && manager) {
        try { mod = manager.require('net-snmp'); } catch { /* not installed in _pkg */ }
    }
    return mod;
}

function SnmpClient(_data, _logger, _events, _runtime) {
    let data = JSON.parse(JSON.stringify(_data));   // deep copy of device config
    const logger = _logger;
    const events = _events;
    const runtime = _runtime;

    let session = null;
    let connected = false;
    let working = false;                    // avoid overload during polling/connection
    let overloading = 0;                    // overload counter
    let lastStatus = '';                    // 'connect-ok' | 'connect-off' | 'connect-error' | 'connect-busy' | 'connect-failed'
    let lastTimestampValue = 0;             // timestamp of last successful polling
    let consecutiveTimeouts = 0;            // polls in a row without any answer
    let getProperty = null;                 // function to ask stored property (security)
    let trapUnregister = null;              // function to unsubscribe from the shared trap receiver
    const self = this;

    let tagMap = {};                        // tagId -> tag definition (.address is the OID)
    let oidTagIds = {};                     // OID -> [tagId], to match the notification varbinds
    let varsValue = {};                     // values to send to frontend

    /**
     * Create the SNMP session and probe the agent with a GET of sysUpTime.
     * SNMP is connectionless: 'connected' means the agent answered the probe,
     * for v3 the probe also performs the engine discovery and validates the credentials.
     */
    this.connect = async function () {
        if (!_checkWorking(true)) {
            throw new Error('working');
        }
        try {
            if (!data.property || !data.property.address) {
                logger.error(`'${data.name}' missing connection data!`);
                _emitStatus('connect-failed');
                _clearVarsValue();
                throw new Error('missing address');
            }
            const options = _getOptions();
            const security = await _getSecurity();
            logger.info(`'${data.name}' try to connect ${data.property.address}:${options.port} (${options.version})`, true);
            _closeSession();
            session = _createSession(options, security);
            session.on('error', (err) => {
                logger.error(`'${data.name}' session error! ${err}`);
            });
            await _get([SYS_UPTIME_OID]);
            connected = true;
            consecutiveTimeouts = 0;
            logger.info(`'${data.name}' connected!`, true);
            _emitStatus('connect-ok');
            if (options.trapsEnabled) {
                _registerTraps(options, security);
            }
        } catch (err) {
            connected = false;
            _closeSession();
            logger.error(`'${data.name}' connect failed! ${err}`);
            _emitStatus('connect-error');
            _clearVarsValue();
            throw err;
        } finally {
            _checkWorking(false);
        }
    };

    this.disconnect = function () {
        return new Promise((resolve, reject) => {
            try {
                _closeSession();
                connected = false;
                _emitStatus('connect-off');
                _clearVarsValue();
                _checkWorking(false);
                logger.info(`'${data.name}' disconnected!`, true);
                resolve(true);
            } catch (err) {
                logger.error(`'${data.name}' disconnect failure! ${err}`);
                reject(err);
            }
        });
    };

    /**
     * Read all tags with GET requests split in chunks of maxOidsPerRequest OIDs
     */
    this.polling = async function () {
        if (!_checkWorking(true)) {
            _emitStatus('connect-busy');
            return;
        }
        try {
            if (!session || !connected) {
                return;
            }
            const tagIds = Object.keys(tagMap).filter(id => !tagMap[id].trapOnly);
            if (!tagIds.length) {
                if (lastStatus !== 'connect-ok') {
                    _emitStatus('connect-ok');
                }
                return;
            }
            const options = _getOptions();
            const results = {};
            let answered = false;
            for (const chunk of _chunk(tagIds, options.maxOidsPerRequest)) {
                try {
                    const varbinds = await _get(chunk.map(id => tagMap[id].address));
                    chunk.forEach((id, index) => {
                        results[id] = varbinds[index];
                    });
                    answered = true;
                } catch (err) {
                    logger.error(`'${data.name}' polling error! ${err}`);
                }
            }
            if (answered) {
                consecutiveTimeouts = 0;
                lastTimestampValue = Date.now();
            } else if (++consecutiveTimeouts >= options.offlineAfterTimeouts) {
                connected = false;
                logger.error(`'${data.name}' no answer after ${consecutiveTimeouts} polls, reconnect`);
                _emitStatus('connect-error');
            }
            const changed = await _updateVarsValue(results);
            _emitValues(varsValue);
            if (this.addDaq && changed && !utils.isEmptyObject(changed)) {
                this.addDaq(changed, data.name, data.id);
            }
            if (connected && lastStatus !== 'connect-ok') {
                _emitStatus('connect-ok');
            }
        } catch (err) {
            logger.error(`'${data.name}' polling error! ${err}`);
        } finally {
            _checkWorking(false);
        }
    };

    this.load = function (_data) {
        data = JSON.parse(JSON.stringify(_data));
        varsValue = {};
        tagMap = {};
        oidTagIds = {};
        try {
            mibStore.refresh();
            let count = 0;
            for (const id in data.tags) {
                const tag = data.tags[id];
                const address = mibStore.toOid(tag.address);
                if (!address) {
                    logger.warn(`'${data.name}' tag ${tag.name} (${id}) ${mibStore.isSymbolic(tag.address) ? 'unknown MIB name' : 'invalid OID'} '${tag.address}'`);
                    continue;
                }
                tagMap[id] = { ...tag, id, address: address, trapOnly: !!(tag.options && tag.options.trapOnly) };
                oidTagIds[address] = (oidTagIds[address] || []).concat(id);
                count++;
            }
            logger.info(`'${data.name}' data loaded (${count})`, true);
        } catch (err) {
            logger.error(`'${data.name}' load error! ${err}`);
        }
    };

    this.getValues = function () {
        return varsValue;
    };

    this.getValue = function (id) {
        if (varsValue[id]) {
            return { id: id, value: varsValue[id].value, ts: lastTimestampValue };
        }
        return null;
    };

    this.getStatus = function () {
        return lastStatus;
    };

    this.getTagProperty = function (id) {
        const tag = tagMap[id];
        return tag ? { id: id, name: tag.name, type: tag.type, format: tag.format } : null;
    };

    /**
     * Write a tag with a SET request, the varbind type is taken from the tag type
     */
    this.setValue = async function (tagId, value) {
        const tag = tagMap[tagId];
        if (!tag || !session) {
            return false;
        }
        try {
            const rawValue = await deviceUtils.tagRawCalculator(value, tag, runtime);
            const varbind = {
                oid: tag.address,
                type: _objectTypeOf(tag.type),
                value: _encodeValue(rawValue, tag.type)
            };
            await _set([varbind]);
            logger.info(`'${tag.name}' setValue(${tagId}, ${rawValue})`, true, true);
            return true;
        } catch (err) {
            logger.error(`'${tag.name}' setValue error! ${err}`);
            return false;
        }
    };

    /**
     * Walk the subtree of the node OID (default mib-2) and return the instances found with type and current value
     * @param {*} node { oid: base OID, max: max results }
     */
    this.browse = function (node) {
        return new Promise((resolve, reject) => {
            if (!session || !connected) {
                return reject('Device not connected!');
            }
            const baseOid = _normalizeOid(String((node && node.oid) || MIB2_OID).trim());
            if (!OID_REGEX.test(baseOid)) {
                return reject(`Invalid OID '${baseOid}'`);
            }
            const max = (node && parseInt(node.max, 10) > 0) ? parseInt(node.max, 10) : BROWSE_MAX_RESULTS;
            const items = [];
            let truncated = false;
            const feed = (varbinds) => {
                for (const varbind of varbinds) {
                    if (items.length >= max) {
                        truncated = true;
                        return true;    // stop the walk
                    }
                    if (snmp.isVarbindError(varbind)) {
                        continue;
                    }
                    const type = _tagTypeOf(varbind);
                    items.push({
                        address: varbind.oid,
                        name: mibStore.toName(varbind.oid),
                        type: type,
                        value: _decodeVarbind(varbind, { type: type }).value
                    });
                }
                return false;
            };
            try {
                session.subtree(baseOid, BROWSE_MAX_REPETITIONS, feed, (err) => {
                    if (err) {
                        logger.error(`'${data.name}' browse error! ${err}`);
                        return reject(err);
                    }
                    resolve({ items: items, total: items.length, truncated: truncated });
                });
            } catch (err) {
                logger.error(`'${data.name}' browse error! ${err}`);
                reject(err);
            }
        });
    };

    this.isConnected = function () {
        return connected;
    };

    this.bindAddDaq = function (fnc) {
        this.addDaq = fnc;
    };
    this.addDaq = null;

    this.bindGetProperty = function (fnc) {
        getProperty = fnc;
    };

    this.lastReadTimestamp = () => lastTimestampValue;

    this.getTagDaqSettings = (tagId) => (data.tags[tagId] ? data.tags[tagId].daq : null);

    this.setTagDaqSettings = (tagId, settings) => {
        if (data.tags[tagId]) {
            utils.mergeObjectsValues(data.tags[tagId].daq, settings);
        }
    };

    /**
     * Merge the device options with the defaults
     */
    function _getOptions() {
        const options = (data.property && data.property.options && typeof data.property.options === 'object') ? data.property.options : {};
        const result = { ...DEFAULT_OPTIONS, ...options };
        result.port = parseInt(data.property.port, 10) || 161;
        result.timeout = parseInt(result.timeout, 10) || DEFAULT_OPTIONS.timeout;
        result.retries = (parseInt(result.retries, 10) >= 0) ? parseInt(result.retries, 10) : DEFAULT_OPTIONS.retries;
        result.maxOidsPerRequest = parseInt(result.maxOidsPerRequest, 10) || DEFAULT_OPTIONS.maxOidsPerRequest;
        result.offlineAfterTimeouts = parseInt(result.offlineAfterTimeouts, 10) || DEFAULT_OPTIONS.offlineAfterTimeouts;
        return result;
    }

    /**
     * Ask the stored security property: { uid: user, pwd: community (v1/v2c) or authKey (v3), privKey }
     */
    async function _getSecurity() {
        if (!getProperty) {
            return {};
        }
        const result = await getProperty({ query: 'security', name: data.id });
        if (result && result.value && result.value !== 'null') {
            return JSON.parse(result.value) || {};
        }
        return {};
    }

    function _createSession(options, security) {
        const sessionOptions = {
            port: options.port,
            retries: options.retries,
            timeout: options.timeout,
            transport: options.transport
        };
        if (options.version === SnmpVersion.v3) {
            sessionOptions.version = snmp.Version3;
            sessionOptions.context = options.context || '';
            return snmp.createV3Session(data.property.address, _createV3User(options, security), sessionOptions);
        }
        sessionOptions.version = (options.version === SnmpVersion.v1) ? snmp.Version1 : snmp.Version2c;
        return snmp.createSession(data.property.address, security.pwd || 'public', sessionOptions);
    }

    function _createV3User(options, security) {
        const level = snmp.SecurityLevel[options.securityLevel];
        if (!level) {
            throw new Error(`unknown security level '${options.securityLevel}'`);
        }
        if (!security.uid) {
            throw new Error('missing v3 user name');
        }
        const user = { name: security.uid, level: level };
        if (level !== snmp.SecurityLevel.noAuthNoPriv) {
            user.authProtocol = snmp.AuthProtocols[options.authProtocol];
            if (!user.authProtocol || options.authProtocol === 'none') {
                throw new Error(`unknown authentication protocol '${options.authProtocol}'`);
            }
            if (!security.pwd) {
                throw new Error('missing v3 authentication key');
            }
            user.authKey = security.pwd;
        }
        if (level === snmp.SecurityLevel.authPriv) {
            user.privProtocol = snmp.PrivProtocols[options.privProtocol];
            if (!user.privProtocol || options.privProtocol === 'none') {
                throw new Error(`unknown privacy protocol '${options.privProtocol}'`);
            }
            if (!security.privKey) {
                throw new Error('missing v3 privacy key');
            }
            user.privKey = security.privKey;
        }
        return user;
    }

    /**
     * Subscribe to the shared trap receiver with the credentials of the session
     */
    function _registerTraps(options, security) {
        _unregisterTraps();
        const subscriber = {
            id: data.id,
            address: data.property.address,
            community: (options.version === SnmpVersion.v3) ? null : (security.pwd || 'public'),
            user: (options.version === SnmpVersion.v3) ? _createV3User(options, security) : null,
            onNotification: (pdu) => {
                _onNotification(pdu).catch(err => logger.error(`'${data.name}' notification error! ${err}`));
            },
            onError: (err) => {
                logger.error(`'${data.name}' trap receiver error! ${err}`);
                trapUnregister = null;
            }
        };
        trapUnregister = trapReceiver.register(snmp, { port: options.trapPort, transport: options.transport }, subscriber, logger);
    }

    function _unregisterTraps() {
        if (trapUnregister) {
            trapUnregister();
            trapUnregister = null;
        }
    }

    /**
     * Update the tags matching the notification varbinds
     */
    async function _onNotification(pdu) {
        const results = {};
        _notificationVarbinds(pdu).forEach(varbind => {
            (oidTagIds[varbind.oid] || []).forEach(id => {
                results[id] = varbind;
            });
        });
        if (utils.isEmptyObject(results)) {
            logger.info(`'${data.name}' notification received without matching tags`, true);
            return;
        }
        const changed = await _updateVarsValue(results);
        _emitValues(varsValue);
        if (self.addDaq && changed && !utils.isEmptyObject(changed)) {
            self.addDaq(changed, data.name, data.id);
        }
    }

    /**
     * Varbinds of the notification, for v1 traps sysUpTime.0 and snmpTrapOID.0 are synthesized as RFC 3584
     */
    function _notificationVarbinds(pdu) {
        const varbinds = (pdu.varbinds || []).slice();
        if (pdu.type === snmp.PduType.Trap) {
            const trapOid = (pdu.generic >= 0 && pdu.generic < 6) ? `${SNMP_TRAPS_OID}.${pdu.generic + 1}` : `${pdu.enterprise}.0.${pdu.specific}`;
            varbinds.unshift(
                { oid: SYS_UPTIME_OID, type: snmp.ObjectType.TimeTicks, value: pdu.upTime },
                { oid: SNMP_TRAP_OID, type: snmp.ObjectType.OID, value: trapOid }
            );
        }
        return varbinds;
    }

    function _closeSession() {
        _unregisterTraps();
        if (session) {
            try {
                session.close();
            } catch { /* ignore */ }
            session = null;
        }
    }

    function _get(oids) {
        return new Promise((resolve, reject) => {
            session.get(oids, (err, varbinds) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(varbinds || []);
                }
            });
        });
    }

    function _set(varbinds) {
        return new Promise((resolve, reject) => {
            session.set(varbinds, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result || []);
                }
            });
        });
    }

    function _clearVarsValue() {
        for (const id in varsValue) {
            varsValue[id].value = null;
        }
        _emitValues(varsValue);
    }

    async function _updateVarsValue(results) {
        const timestamp = Date.now();
        const toDaq = {};
        let some = false;
        for (const id in tagMap) {
            const varbind = results[id];
            if (typeof varbind === 'undefined') {
                continue;
            }
            const tagDef = tagMap[id];
            const decoded = _decodeVarbind(varbind, tagDef);
            if (decoded.error) {
                logger.warn(`'${data.name}' tag ${tagDef.name} (${tagDef.address}) ${decoded.error}`);
            }
            const previous = varsValue[id];
            const entry = {
                id: id,
                rawValue: decoded.value,
                type: tagDef.type,
                daq: tagDef.daq,
                changed: !previous || previous.rawValue !== decoded.value,
                tagref: tagDef,
                value: null,
                timestamp: timestamp
            };
            if (!utils.isNullOrUndefined(decoded.value)) {
                entry.value = await deviceUtils.tagValueCompose(decoded.value, previous ? previous.value : null, tagDef, runtime);
                if (deviceUtils.tagDaqToSave(entry, timestamp)) {
                    toDaq[id] = entry;
                }
            }
            varsValue[id] = entry;
            varsValue[id].changed = false;
            some = true;
        }
        return some ? toDaq : null;
    }

    /**
     * Convert a varbind to a JavaScript value: numbers for the integer types,
     * strings for OctetString/IpAddress/OID, null for the error types
     */
    function _decodeVarbind(varbind, tag) {
        if (!varbind) {
            return { value: null, error: 'no response' };
        }
        if (snmp.isVarbindError(varbind)) {
            return { value: null, error: snmp.varbindError(varbind) };
        }
        const value = varbind.value;
        if (utils.isNullOrUndefined(value)) {
            return { value: null };
        }
        if (varbind.type === snmp.ObjectType.Counter64) {
            return { value: _decodeCounter64(value) };
        }
        if (Buffer.isBuffer(value)) {
            return { value: _decodeOctetString(value, tag) };
        }
        return { value: value };
    }

    function _decodeCounter64(value) {
        if (!Buffer.isBuffer(value)) {
            return Number(value);
        }
        const buffer = Buffer.concat([Buffer.alloc(Math.max(0, 8 - value.length)), value]);
        return Number(buffer.readBigUInt64BE(0));
    }

    function _decodeOctetString(buffer, tag) {
        const text = buffer.toString('utf8');
        if (_isNumericType(tag.type)) {
            const number = parseFloat(text);
            return isNaN(number) ? text : number;
        }
        if (tag.type === SnmpTagType.Hex || !_isPrintable(text)) {
            return buffer.toString('hex');
        }
        return text;
    }

    function _isPrintable(text) {
        // allow tab, line feed, carriage return and everything from space on, no replacement chars from invalid utf8
        return !/[\u0000-\u0008\u000b\u000c\u000e-\u001f�]/.test(text);
    }

    function _isNumericType(type) {
        return [SnmpTagType.Integer, SnmpTagType.Counter32, SnmpTagType.Gauge32, SnmpTagType.Unsigned32,
            SnmpTagType.TimeTicks, SnmpTagType.Counter64].indexOf(type) !== -1;
    }

    /**
     * Tag type to propose for a varbind read from the agent
     */
    function _tagTypeOf(varbind) {
        const ObjectType = snmp.ObjectType;
        switch (varbind.type) {
            case ObjectType.Boolean:
                return SnmpTagType.Boolean;
            case ObjectType.OctetString:
                return (Buffer.isBuffer(varbind.value) && !_isPrintable(varbind.value.toString('utf8'))) ? SnmpTagType.Hex : SnmpTagType.OctetString;
            case ObjectType.Opaque:
                return SnmpTagType.Hex;
            case ObjectType.OID:
                return SnmpTagType.OID;
            case ObjectType.IpAddress:
                return SnmpTagType.IpAddress;
            case ObjectType.Counter32:
                return SnmpTagType.Counter32;
            case ObjectType.Gauge32:
                return SnmpTagType.Gauge32;
            case ObjectType.TimeTicks:
                return SnmpTagType.TimeTicks;
            case ObjectType.Counter64:
                return SnmpTagType.Counter64;
            default:
                return SnmpTagType.Integer;
        }
    }

    function _objectTypeOf(type) {
        if (type === SnmpTagType.Hex) {
            return snmp.ObjectType.OctetString;
        }
        return snmp.ObjectType[type] || snmp.ObjectType.Integer;
    }

    function _encodeValue(value, type) {
        switch (type) {
            case SnmpTagType.OctetString:
                return utils.isNullOrUndefined(value) ? '' : String(value);
            case SnmpTagType.Hex:
                return Buffer.from(String(value || ''), 'hex');
            case SnmpTagType.IpAddress:
            case SnmpTagType.OID:
                return String(value);
            case SnmpTagType.Boolean:
                return (value === true || value === 'true' || value === 1 || value === '1');
            case SnmpTagType.Counter64: {
                const buffer = Buffer.alloc(8);
                buffer.writeBigUInt64BE(BigInt(Math.max(0, Math.trunc(Number(value)))));
                return buffer;
            }
            default: {
                const number = parseInt(value, 10);
                if (isNaN(number)) {
                    throw new Error(`value '${value}' is not an integer`);
                }
                return number;
            }
        }
    }

    function _normalizeOid(oid) {
        return oid.startsWith('.') ? oid.substring(1) : oid;
    }

    function _chunk(items, size) {
        const chunks = [];
        for (let index = 0; index < items.length; index += size) {
            chunks.push(items.slice(index, index + size));
        }
        return chunks;
    }

    function _emitValues(values) {
        events.emit('device-value:changed', { id: data.id, values: values });
    }

    function _emitStatus(status) {
        lastStatus = status;
        events.emit('device-status:changed', { id: data.id, status: status });
    }

    function _checkWorking(check) {
        if (check && working) {
            overloading++;
            logger.warn(`'${data.name}' working (connection || polling) overload! ${overloading}`);
            if (overloading >= 3) {
                _closeSession();
                connected = false;
            } else {
                return false;
            }
        }
        working = check;
        overloading = 0;
        return true;
    }
}

/**
 * Tag types supported, the keys match net-snmp ObjectType (Hex is an OctetString shown as hex string)
 */
const SnmpTagType = {
    Integer: 'Integer',
    OctetString: 'OctetString',
    Hex: 'Hex',
    Counter32: 'Counter32',
    Gauge32: 'Gauge32',
    Unsigned32: 'Unsigned32',
    TimeTicks: 'TimeTicks',
    Counter64: 'Counter64',
    IpAddress: 'IpAddress',
    OID: 'OID',
    Boolean: 'Boolean'
};

module.exports = {
    init: function () { },
    create: function (data, logger, events, manager, runtime) {
        if (!snmp) {
            snmp = tryLoadSnmp(manager);
        }
        if (!snmp) {
            return null;
        }
        const appDir = runtime && runtime.settings && runtime.settings.appDir;
        mibStore.init(snmp, appDir ? path.resolve(appDir, '_mibs') : null, logger);
        return new SnmpClient(data, logger, events, runtime);
    },
    SnmpVersion: SnmpVersion,
    SnmpTagType: SnmpTagType
};
