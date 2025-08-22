'use strict';

/**
 * Driver MELSEC (MC Protocol / SLMP via TCP) based on 'mcprotocol'
 * API usate: initiateConnection, setTranslationCB, addItems, readAllItems, writeItems, dropConnection
 */

const path = require('path');
let McProtocol; // costructor

const utils = require('../../utils');
const deviceUtils = require('../device-utils');

function tryLoadMcprotocol(manager) {
    // Mok-Protocol to use locally
    try { return require(path.resolve(process.cwd(), '_pkg/mok-mcprotocol/mcprotocol.cjs')); } catch {}
    // from node_modules
    try { return require('mcprotocol'); } catch { }
    if (manager) {
        // from _pkg
        try { return manager.require('mcprotocol'); } catch {}
    }
    return null;
}

function MelsecClient(_data, _logger, _events, _runtime) {
    let data = JSON.parse(JSON.stringify(_data));
    const logger = _logger;
    const events = _events;
    const runtime = _runtime;

    let registered = new Set();
    let conn = null;
    let connected = false;
    let working = false;
    let overloading = 0;
    let lastStatus = '';
    let lastTimestampValue = 0;

    let tagMap = {};          // tagId -> definizione (.address in sintax MC)
    let varsValue = {};       // value to send on frontend

    this.connect = function () {
        return new Promise((resolve, reject) => {
            try {
                if (_checkWorking(true) === false) {
                    return reject();
                }
                if (!data.property || !data.property.address) {
                    logger.error(`'${data.name}' missing connection data!`);
                    _emitStatus('connect-failed');
                    _clearVarsValue();
                    _checkWorking(false);
                    return reject(new Error('missing address'));
                }

                const { host, port, ascii, octal } = _parseAddressOptions(
                    data.property.address,
                    data.property.ascii,
                    data.property.octalIO
                );

                logger.info(`'${data.name}' try to connect ${host}:${port}`, true);

                if (!McProtocol) {
                    logger.error(`'${data.name}' mcprotocol not available`);
                    _emitStatus('connect-error');
                    _checkWorking(false);
                    return reject(new Error('mcprotocol ctor missing'));
                }

                conn = new McProtocol();

                conn.initiateConnection(
                    { host, port, ascii: !!ascii, octalInputOutput: (typeof octal === 'boolean' ? octal : true) },
                    (err) => {
                        if (typeof err !== 'undefined') {
                            logger.error(`'${data.name}' connect failed! ${err}`);
                            connected = false;
                            _emitStatus('connect-error');
                            _clearVarsValue();
                            _checkWorking(false);
                            return reject(err);
                        }

                        // map tagId -> address MC
                        conn.setTranslationCB((tagId) => tagMap[tagId] ? tagMap[tagId].address : tagId);

                        // register items
                        _syncRegisteredItems();

                        connected = true;
                        logger.info(`'${data.name}' connected!`, true);
                        _emitStatus('connect-ok');
                        _checkWorking(false);
                        resolve();
                    }
                );
            } catch (err) {
                logger.error(`'${data.name}' try to connect error! ${err}`);
                _emitStatus('connect-error');
                _clearVarsValue();
                _checkWorking(false);
                reject(err);
            }
        });
    };

    this.disconnect = function () {
        return new Promise((resolve, reject) => {
            try {
                if (conn) {
                    try {
                        conn.dropConnection();
                    } catch { }
                }
                connected = false;
                registered = new Set();
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

    this.polling = async function () {
        if (_checkWorking(true) === false) {
            _emitStatus('connect-busy');
            return;
        }
        if (!conn || !connected) {
            _checkWorking(false);
            return;
        }
        if (!registered || registered.size === 0) {
            if (lastStatus !== 'connect-ok') {
                _emitStatus('connect-ok');
            }
            _checkWorking(false);
            return;
        }
        try {
            conn.readAllItems(async (anythingBad, valuesObj) => {
                if (anythingBad) {
                    logger.warn(`'${data.name}' polling returned bad quality`);
                }
                const changed = await _updateVarsValue(valuesObj);
                lastTimestampValue = Date.now();
                _emitValues(varsValue);
                if (this.addDaq && changed && !utils.isEmptyObject(changed)) {
                    this.addDaq(changed, data.name, data.id);
                }
                if (lastStatus !== 'connect-ok') {
                    _emitStatus('connect-ok');
                }
                _checkWorking(false);
            });
        } catch (err) {
            logger.error(`'${data.name}' polling error: ${err}`);
            _checkWorking(false);
        }
    };

    this.load = function (_d) {
        data = JSON.parse(JSON.stringify(_d));
        varsValue = {};
        tagMap = {};
        try {
            let count = 0;
            for (const id in data.tags) {
                const t = data.tags[id];
                if (!t.address || typeof t.address !== 'string') {
                    logger.warn(`'${data.name}' tag ${t.name} (${id}) missing MC address`);
                    continue;
                }
                tagMap[id] = { ...t, id };
                count++;
            }
            if (connected && conn) {
                _syncRegisteredItems();
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
        if (varsValue[id]) return { id, value: varsValue[id].value, ts: lastTimestampValue };
        return null;
    };

    this.getStatus = function () {
        return lastStatus;
    };

    this.getTagProperty = function (tagId) {
        const t = tagMap[tagId];
        return t ? { id: tagId, name: t.name, type: t.type, format: t.format } : null;
    };

    this.setValue = async function (tagId, value) {
        if (!tagMap[tagId] || !conn) {
            return false;
        }
        try {
            const valueToSend = await deviceUtils.tagRawCalculator(value, tagMap[tagId], runtime);
            await new Promise((resolve, reject) => {
                conn.writeItems(tagId, valueToSend, (anythingBad) => {
                    if (anythingBad) return reject(new Error('write error'));
                    logger.info(`'${tagMap[tagId].name}' setValue(${tagId}, ${valueToSend})`, true, true);
                    resolve();
                });
            });
            return true;
        } catch (err) {
            logger.error(`'${tagMap[tagId]?.name || tagId}' setValue error! ${err}`);
            return false;
        }
    };

    /**
     * Return if device is connected

    */
    this.isConnected = function () {
        return connected;
    }

    this.bindAddDaq = function (fnc) { this.addDaq = fnc; };
    this.addDaq = null;

    this.lastReadTimestamp = () => lastTimestampValue;

    this.getTagDaqSettings = (tagId) => (data.tags[tagId] ? data.tags[tagId].daq : null);
    this.setTagDaqSettings = (tagId, settings) => {
        if (data.tags[tagId]) utils.mergeObjectsValues(data.tags[tagId].daq, settings);
    };

    function _parseAddressOptions(address, ascii, octal) {
        let host = address;
        let port = 1281; // default comune MC/SLMP
        const i = address.indexOf(':');
        if (i !== -1) {
            host = address.substring(0, i);
            port = parseInt(address.substring(i + 1), 10);
        }
        return { host, port, ascii, octal };
    }

    function _clearVarsValue() {
        for (const id in varsValue) varsValue[id].value = null;
        _emitValues(varsValue);
    }

    async function _updateVarsValue(valuesObj) {
        let some = false;
        const ts = Date.now();
        const toDaq = {};
        const temp = {};

        for (const id in tagMap) {
            const prevRaw = varsValue[id]?.rawValue;
            const raw = valuesObj[id]; // key = tagId via setTranslationCB
            if (typeof raw === 'undefined') {
                continue;
            }
            const tagDef = tagMap[id];
            temp[id] = {
                id,
                rawValue: raw,
                type: tagDef.type,
                daq: tagDef.daq,
                changed: prevRaw !== raw,
                tagref: tagDef
            };
            some = true;
        }
        if (!some) {
            return null;
        }

        for (const id in temp) {
            if (!utils.isNullOrUndefined(temp[id].rawValue)) {
                const parsed = deviceUtils.parseValue(temp[id].rawValue, temp[id].tagref?.type);  //this parser don't work because check only js types (number, string, boolean)
                temp[id].value = await deviceUtils.tagValueCompose(
                    parsed,
                    varsValue[id] ? varsValue[id].value : null,
                    temp[id].tagref,
                    runtime
                );
                temp[id].timestamp = ts;
                if (deviceUtils.tagDaqToSave(temp[id], ts)) toDaq[id] = temp[id];
            }
            varsValue[id] = temp[id];
            varsValue[id].changed = false;
        }
        return toDaq;
    }

    function _syncRegisteredItems() {
        if (!conn) {
            return;
        }
        const current = new Set(Object.keys(tagMap)); // tagId, because using setTranslationCB
        const toRemove = [...registered].filter(k => !current.has(k));
        const toAdd    = [...current].filter(k => !registered.has(k));
        if (toRemove.length && typeof conn.removeItems === 'function') {
            try {
                conn.removeItems(toRemove);
            } catch {}
        }
        if (toAdd.length) {
            try {
                conn.addItems(toAdd);
            } catch {}
        }
        registered = current;
    }

    function _emitValues(values) {
        events.emit('device-value:changed', { id: data.id, values });
    }

    function _emitStatus(status) {
        lastStatus = status;
        events.emit('device-status:changed', { id: data.id, status });
    }

    function _checkWorking(check) {
        if (check && working) {
            overloading++;
            logger.warn(`'${data.name}' working (connection || polling) overload! ${overloading}`);
            if (overloading >= 3) {
                try { if (conn) conn.dropConnection(); } catch { }
            } else {
                return false;
            }
        }
        working = check;
        overloading = 0;
        return true;
    }
}

module.exports = {
    init: function () { },
    create: function (data, logger, events, manager, runtime) {
        if (!McProtocol) McProtocol = tryLoadMcprotocol(manager);
        if (!McProtocol) return null;
        return new MelsecClient(data, logger, events, runtime);
    }
};
