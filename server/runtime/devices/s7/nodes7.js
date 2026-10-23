/**
 * 's7' alternate driver: pure-JS S7 communication through the `nodes7` library.
 *
 * Why: `node-snap7` is a native addon. On an unstable PLC/network it can corrupt
 * the heap and crash the whole server process on repeated reconnects. This driver
 * exposes the same public interface as the snap7 driver (s7/index.js) but runs
 * entirely in JavaScript, so a PLC/network fault can only affect that device.
 *
 * Enable per device (the default driver stays 'snap7'):
 *   property: { "driver": "nodes7", "address": "192.168.0.10", "rack": 0, "slot": 1 }
 * Optional, for special cases such as LOGO!8 (explicit TSAP):
 *   property: { "driver": "nodes7", "tsapLocal": "0x0100", "tsapRemote": "0x0201", "timeout": 5000 }
 *
 * v1 support: connection by rack/slot or explicit TSAP, DB tags
 * (Bool/Byte/Int/Word/DInt/DWord/Real/Char) read and write, reconnect handled by
 * the device layer. Non-DB areas (E/I/A/Q/M words) are out of scope: they are
 * skipped with a warning and the tag stays unchanged.
 */
'use strict';

const deviceUtils = require('../device-utils');

/** Readable text for anything a library may hand back as an error. */
function errorText(err) {
    if (err === null || err === undefined) return 'unknown error';
    if (typeof err === 'string') return err.trim() || 'unknown error';
    if (typeof err !== 'object') return String(err);
    const code = err.code !== undefined && err.code !== null ? String(err.code) : '';
    if (typeof err.message === 'string' && err.message) {
        return code && !err.message.includes(code) ? `${err.message} (code=${code})` : err.message;
    }
    if (code) return `code=${code}`;
    try {
        const json = JSON.stringify(err);
        if (json && json !== '{}') return json;
    } catch (_) {
        // fall through to String() below
    }
    return String(err);
}

function Nodes7S7(data, logger, events, runtime) {
    const NodeS7 = require('nodes7');
    const client = new NodeS7({ silent: true });
    const self = this;

    this.data = data;
    this.logger = logger;
    this.events = events;
    this.runtime = runtime;
    this.connected = false;
    this.working = false;          // avoids overlapping polls
    this.lastReadTs = 0;
    this.varsValue = {};           // id -> { id, value, rawValue, type, changed, daq, timestamp }
    this.addressMap = {};          // tag id -> nodes7 address
    this.byId = {};                // tag id -> { id, address, type, daq, nodeId }
    this.byteExtract = {};         // id -> { high: bool } (DBB read as WORD, see _translateAddress)
    this.lastStatus = 'connect-off';
    this.reconnectDelay = 0;

    // ---- connection ---------------------------------------------------------
    this.connect = function () {
        return new Promise((resolve) => {
            const prop = data.property || {};
            const params = {
                host: prop.address || '127.0.0.1',
                port: Number(prop.port) || 102,
                rack: Number(prop.rack) >= 0 ? Number(prop.rack) : 0,
                slot: Number(prop.slot) >= 0 ? Number(prop.slot) : 1,
            };
            // Explicit TSAP (LOGO!8 and special cases) — optional flat fields
            if (prop.tsapLocal !== undefined && prop.tsapLocal !== null && prop.tsapLocal !== '') {
                params.localTSAP = _parseTsap(prop.tsapLocal);
            }
            if (prop.tsapRemote !== undefined && prop.tsapRemote !== null && prop.tsapRemote !== '') {
                params.remoteTSAP = _parseTsap(prop.tsapRemote);
            }
            // Connection timeout (ms) — optional
            const timeout = Number(prop.timeout) > 0 ? Number(prop.timeout) : 5000;
            params.timeout = timeout;
            logger.info(`'${data.name}' [nodes7] connecting to ${params.host} (rack ${params.rack}, slot ${params.slot}${params.remoteTSAP ? ', tsap 0x' + params.remoteTSAP.toString(16) : ''})`, true);
            let settled = false;
            const to = setTimeout(() => {
                if (settled) {
                    return;
                }
                settled = true;
                self.connected = false;
                self.lastStatus = 'connect-error';
                logger.error(`'${data.name}' [nodes7] connect timeout after ${timeout}ms to ${params.host}:${params.port} (rack ${params.rack}, slot ${params.slot})`);
                _emitStatus('connect-error');
                try { client.dropConnection(() => { }); } catch (_) { }
                resolve();
            }, timeout + 500);
            client.initiateConnection(params, (err) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(to);
                if (err) {
                    self.connected = false;
                    self.lastStatus = 'connect-error';
                    // nodes7 does not hand back Error instances: it calls back with plain
                    // objects such as { code: 'EUSERTIMEOUT' }. errorText() keeps the cause
                    // in the log instead of the useless "[object Object]".
                    logger.error(`'${data.name}' [nodes7] connect failed on ${params.host}:${params.port} (rack ${params.rack}, slot ${params.slot}): ${errorText(err)}`);
                    _emitStatus('connect-error');
                } else {
                    self.connected = true;
                    self.lastStatus = 'connect-ok';
                    self.reconnectDelay = 0;
                    logger.info(`'${data.name}' [nodes7] connected!`, true);
                    _emitStatus('connect-ok');
                }
                resolve();
            });
        });
    };

    function _parseTsap(value) {
        // accepts "0x0100", "0100" and "256"
        const str = String(value).trim();
        if (/^0x/i.test(str)) return parseInt(str, 16);
        if (/^[0-9a-fA-F]{4}$/.test(str)) return parseInt(str, 16);
        return parseInt(str, 10);
    }

    // nodes7 reports bad quality by returning the STRING 'BAD <code>' (e.g. "BAD 255")
    // instead of the value when an item could not be read with good quality.
    function _isBadQuality(value) {
        return typeof value === 'string' && /^BAD(\s|$)/i.test(value.trim());
    }

    this.disconnect = function () {
        return new Promise((resolve) => {
            self.connected = false;
            try { client.dropConnection(() => { }); } catch (_) { }
            self.lastStatus = 'connect-off';
            _emitStatus('connect-off');
            // Values are intentionally kept: the connection status event is what tells
            // the UI the device is unavailable, and old values must not become null.
            resolve(true);
        });
    };

    this.isConnected = function () { return client.isoConnectionState === 4 || self.connected; };

    // ---- load (register tags as nodes7 items) --------------------------------
    this.load = function (_data) {
        data = _data || data;
        self.byId = {};
        self.addressMap = {};
        self.byteExtract = {};
        // Reset the internal nodes7 state. On a project reload the tag list changes and
        // stale items stay in the library queue: when an item that no longer exists is
        // processed, the translation callback returns undefined and stringToS7Addr
        // throws on addr.split(). As that exception skips the library "addRemoveArray
        // = []" reset, the queue is never cleared and the error repeats on every poll.
        if (client) {
            client.removeItemsNow();
            client.addRemoveArray = [];
            client.readPacketValid = false;
        }
        const toAdd = [];
        let skipped = 0;
        for (const id in data.tags) {
            const tag = data.tags[id];
            if (!tag.address) continue;
            const nodes7Addr = _translateAddress(tag, id);
            if (!nodes7Addr) { skipped++; continue; }
            self.byId[id] = { id, address: tag.address, type: tag.type, daq: tag.daq, nodeId: id };
            self.addressMap[id] = nodes7Addr;
            toAdd.push(id);
        }
        // _COMMERR: nodes7 special item used to detect communication errors
        toAdd.push('_COMMERR');
        if (toAdd.length > 1) {
            client.setTranslationCB((name) => (name === '_COMMERR' ? '_COMMERR' : (self.addressMap[name] || undefined)));
            client.addItems(toAdd);
        }
        logger.info(`'${data.name}' [nodes7] data loaded (${toAdd.length - 1} tags${skipped ? ', ' + skipped + ' skipped' : ''})`, true);
    };

    // ---- polling -------------------------------------------------------------
    this.polling = async function () {
        if (self.working) {
            return;
        }
        self.working = true;
        try {
            client.readAllItems((anyBad, values) => {
                try {
                    const vals = values || {};
                    // nodes7 does NOT return '_COMMERR' in `values` (readDoneCallback only
                    // delivers polled items). The real communication state is
                    // client.isoConnectionState (4 = connected), which is exactly what
                    // findItem('_COMMERR') would use.
                    const connected = client.isoConnectionState === 4;
                    // 1st argument is anyBadQualities (boolean): true means at least one
                    // item has bad quality, the other values are still valid.
                    if (anyBad && connected) {
                        logger.debug(`'${data.name}' [nodes7] some items have bad quality`);
                    }
                    if (!connected) {
                        _markCommError();
                        // lastReadTs is intentionally NOT updated: the device layer uses it
                        // to detect a stalled PLC and force a reconnect with backoff.
                    } else {
                        self.lastStatus = 'connect-ok';
                        _emitStatus('connect-ok');
                        self.lastReadTs = Date.now();
                    }
                    // Always process the returned values: bad quality items ("BAD ...")
                    // are ignored by _processValues, keeping their last good value.
                    _processValues(vals);
                } catch (e) {
                    logger.warn(`'${data.name}' [nodes7] processing: ${e.message}`);
                } finally {
                    self.working = false;
                }
            });
        } catch (e) {
            logger.warn(`'${data.name}' [nodes7] polling error: ${e.message}`);
            self.working = false;
        }
    };

    function _processValues(values) {
        const now = new Date().getTime();
        const toDaq = {};
        (async () => {
            for (const id in self.byId) {
                const meta = self.byId[id];
                let raw = values[id];
                // Skip missing/null items and bad quality results (e.g. the "BAD 255"
                // string returned when the PLC refuses/does not answer): keep the last
                // good value and do not report a change.
                if (raw === undefined || raw === null || _isBadQuality(raw)) continue;
                // DBB read as WORD: extract the right byte (even = high, odd = low)
                if (self.byteExtract[id] && typeof raw === 'number') {
                    raw = self.byteExtract[id].high ? ((raw >> 8) & 0xFF) : (raw & 0xFF);
                }
                const tagref = data.tags[id];
                // nodes7 returns true/false for Bool; normalize to 1/0 (same as snap7)
                if (meta.type === 'Bool') raw = raw ? 1 : 0;
                let value = raw;
                try {
                    value = await deviceUtils.tagValueCompose(raw, self.varsValue[id] ? self.varsValue[id].value : null, tagref, runtime);
                } catch (_) {
                    value = raw;
                }
                const changed = (self.varsValue[id] ? self.varsValue[id].value : null) !== value;
                self.varsValue[id] = {
                    id,
                    rawValue: raw,
                    value,
                    type: meta.type || 'number',
                    daq: meta.daq,
                    changed,
                    timestamp: now,
                };
                if (changed && self.addDaq && deviceUtils.tagDaqToSave(self.varsValue[id], now)) {
                    toDaq[id] = self.varsValue[id];
                }
            }
            _emitValues(self.varsValue);
            if (self.addDaq && Object.keys(toDaq).length) {
                self.addDaq(toDaq, data.name, data.id);
            }
        })().catch((e) => logger.warn(`'${data.name}' [nodes7] processing: ${e.message}`));
    }

    function _markCommError() {
        self.lastStatus = 'connect-error';
        _emitStatus('connect-error');
        // On continuous communication errors the device layer forces a reconnect with
        // backoff — the driver only reports the status.
    }

    // ---- write ---------------------------------------------------------------
    this.setValue = async function (sigid, value) {
        const meta = self.byId[sigid];
        if (!meta) return false;
        if (self.byteExtract[sigid]) {
            logger.warn(`'${data.name}' [nodes7] write ignored on Byte tag (${meta.address}) — it is read as WORD`);
            return false;
        }
        const normalized = await deviceUtils.tagRawCalculator(value, data.tags[sigid], runtime);
        client.writeItems([sigid], [normalized], (err) => {
            if (err) logger.error(`'${data.name}' [nodes7] setValue error: ${errorText(err)}`);
            else logger.info(`'${data.name}' [nodes7] setValue(${sigid}, ${normalized})`, true, true);
        });
        return true;
    };

    // ---- value access --------------------------------------------------------
    this.getValues = function () { return self.varsValue; };
    this.getValue = function (id) {
        if (self.varsValue[id]) return { id, value: self.varsValue[id].value, ts: self.lastReadTs };
        return null;
    };
    this.getStatus = function () { return self.lastStatus; };
    this.getTagProperty = function (id) {
        const meta = self.byId[id];
        if (!meta) return null;
        return { id, name: meta.id, type: meta.type, format: undefined };
    };
    this.lastReadTimestamp = () => self.lastReadTs;
    this.getTagDaqSettings = (tagId) => (data.tags[tagId] ? data.tags[tagId].daq : null);
    this.setTagDaqSettings = (tagId, settings) => {
        if (data.tags[tagId]) {
            const utils = require('../../utils');
            utils.mergeObjectsValues(data.tags[tagId].daq, settings);
        }
    };
    this.bindAddDaq = function (fnc) { self.addDaq = fnc; };
    this.addDaq = null;

    // ---- helpers -------------------------------------------------------------
    function _translateAddress(tag, id) {
        const addr = String(tag.address || '').toUpperCase().replace(/ /g, '');
        const type = String(tag.type || '').toUpperCase();

        // 1) Address already in the nodes7 native format (same as node-red-contrib-s7):
        //    e.g. "DB1,INT0", "DB1,X0.0", "DB1,REAL4". Contains a comma -> pass through.
        if (addr.includes(',')) {
            return addr;
        }
        // 2) Native areas without comma: I/E (input), Q/A (output), M (memory),
        //    P (peripheral) with types X/B/C/W/I/D/DI/R. e.g. I0.0, IW0, MW0,
        //    IDI0, MR0, PIB0, Q0.1. Passed through as is (nodes7 parses them).
        if (/^(I|E|Q|A|M|P)([A-Z]{0,3})\d+(\.\d+)?$/.test(addr)) {
            return addr;
        }

        const m = addr.match(/^(DB\d+)\.(DBX|DBB|DBW|DBD)([\d.]+)$/i);
        if (m) {
            const db = m[1]; // DB2
            const kind = m[2]; // DBX/DBB/DBW/DBD
            const off = m[3]; // e.g. 0.0 (bit) or 2 (byte)
            if (kind === 'DBX') {
                const [byte, bit] = off.split('.');
                if (bit === undefined) return undefined;
                return `${db},X${byte}.${bit}`; // DB2,X0.0
            }
            const byteOffset = parseInt(off, 10);
            if (isNaN(byteOffset)) return undefined;

            // BYTE (1 byte) is misaligned in the nodes7 optimized read when mixed with
            // INT/WORD/REAL (even-alignment padding shifts the pointer). Solution: read
            // an aligned WORD and extract the byte:
            //  - even offset -> WORD at the same offset, high byte (>>8)
            //  - odd offset  -> WORD at offset-1, low byte (&0xFF)
            if (kind === 'DBB') {
                const wordOffset = (byteOffset % 2 === 0) ? byteOffset : byteOffset - 1;
                if (wordOffset < 0) return undefined;
                self.byteExtract[id] = { high: byteOffset % 2 === 0 };
                return `${db},WORD${wordOffset}`;
            }

            const t = kind === 'DBW' ? _wordType(type) : _dwordType(type);
            if (!t) return undefined;
            return `${db},${t}${byteOffset}`; // DB2,INT2
        }
        // Memory area M bit (e.g. M0.0) — basic bit support; M words are not covered
        // in v1 (DB areas only).
        const mBit = addr.match(/^M\d+\.\d+$/i);
        if (mBit) return `M${addr.substring(1)}`;
        // E/I/A/Q areas and M words: out of scope in v1
        logger.warn(`'${data.name}' [nodes7] unsupported address (v1): ${tag.address}`);
        return undefined;
    }

    function _wordType(fuxaType) {
        if (fuxaType === 'INT') return 'INT';
        if (fuxaType === 'UINT' || fuxaType === 'WORD') return 'WORD';
        if (fuxaType === 'INT16') return 'INT';
        return 'INT';
    }
    function _dwordType(fuxaType) {
        if (fuxaType === 'DINT') return 'DINT';
        if (fuxaType === 'DWORD') return 'DWORD';
        if (fuxaType === 'REAL' || fuxaType === 'FLOAT') return 'REAL';
        return 'DINT';
    }

    function _emitValues(values) {
        try { events.emit('device-value:changed', { id: data.id, values }); } catch (_) { }
    }
    function _emitStatus(status) {
        self.lastStatus = status;
        try { events.emit('device-status:changed', { id: data.id, status }); } catch (_) { }
    }
}

module.exports = {
    init: function () { },
    create: function (data, logger, events, manager, runtime) {
        try {
            return new Nodes7S7(data, logger, events, runtime);
        } catch (err) {
            logger.warn(`'${data && data.name}' [nodes7] driver creation failed: ${errorText(err)}`);
            return null;
        }
    },
};
