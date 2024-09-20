/**
 * 'ethernetip': use nodePCCC a library that allows communication to certain Allen-Bradley PLCs -
 * The SLC 500 series, Micrologix and ControlLogix/CompactLogix PLCs using PCCC embedded in Ethernet/IP
 */

'use strict';
var EthernetIp;
const utils = require('../../utils');
const deviceUtils = require('../device-utils');

function EthernetIPclient(_data, _logger, _events, _runtime) {

    var runtime = _runtime;
    var data = JSON.parse(JSON.stringify(_data)); // Current Device data { id, name, tags, enabled, ... }
    var logger = _logger;
    var events = _events;               // Events to commit change to runtime
    var lastStatus = '';                // Last Device status
    var working = false;                // Working flag to manage overloading polling and connection
    var conn = new EthernetIp;
    var doneReading = false;
    var doneWriting = false;
    var overloading = 0;                // Overloading counter to mange the break connection
    var connected = false;              // Connected flag
    var itemsMap = {};                  // Items Mapped Tag name with Item path to find for set value
    var varsValue = [];                 // Signale to send to frontend { id, type, value }
    var lastTimestampValue;             // Last Timestamp of asked values
    /**
     * initialize the device type
     */
    this.init = function (_type) {
        console.error('Not supported!');
    }

    /**
     * Connect to device
     * Emit connection status to clients, clear all Tags values
     */
    this.connect = function () {
        return new Promise(function (resolve, reject) {
            if (data.property && data.property.address) {
                try {
                    if (_checkWorking(true)) {
                        logger.info(`'${data.name}' try to connect ${data.property.address}`, true);
                        _connect(function (err) {
                            if (err) {
                                logger.error(`'${data.name}' connect failed! ${err}`);
                                _emitStatus('connect-error');
                                _clearVarsValue();
                                reject();
                            } else {
                                connected = true;
                                conn.addItems(Object.keys(itemsMap));
                                logger.info(`'${data.name}' connected!`, true);
                                _emitStatus('connect-ok');
                                resolve();
                            }
                            _checkWorking(false);
                        });
                    } else {
                        reject();
                        _emitStatus('connect-error');
                    }
                } catch (err) {
                    logger.error(`'${data.name}' try to connect error! ${err}`);
                    _checkWorking(false);
                    _emitStatus('connect-error');
                    _clearVarsValue();
                    reject();
                }
            } else {
                logger.error(`'${data.name}' missing connection data!`);
                _emitStatus('connect-failed');
                _clearVarsValue();
                reject();
            }
        });
    }


    /**
     * Disconnect the device
     * Emit connection status to clients, clear all Tags values
     */
    this.disconnect = function () {
        return new Promise(function (resolve, reject) {
            try {
                if (conn && connected) {
                    conn.dropConnection(function (result) {
                        if (result) {
                            logger.error(`'${data.name}' try to disconnect failed!`);
                        } else {
                            logger.info(`'${data.name}' disconnected!`, true);
                        }
                        resolve(result);
                    });
                }
                resolve(true);
            } catch (err) {
                if (err) {
                    logger.error(`'${data.name}' disconnect failure! ${err}`);
                }
                reject();
            }
            connected = false;
            _checkWorking(false);
            _emitStatus('connect-off');
            _clearVarsValue();
        });
    }

    /**
     * Read values in polling mode
     * Update the tags values list, save in DAQ if value changed or in interval and emit values to clients
     */
    this.polling = async function () {
        if (_checkWorking(true)) {
            if (conn && connected) {
                try {
                    const result = await _readValues();

                    _checkWorking(false);
                    if (result) {
                        let varsValueChanged = await _updateVarsValue(result);
                        lastTimestampValue = new Date().getTime();
                        _emitValues(varsValue);
                        if (this.addDaq && !utils.isEmptyObject(varsValueChanged)) {
                            this.addDaq(varsValueChanged, data.name, data.id);
                        }
                    } else {
                        // console.error('then error');
                    }

                } catch (err) {
                    //logger.error(`'${data.name}' _readValues error! ${reason}`);
                    logger.error(`'${data.name}' polling error: ${err}`);
                    _checkWorking(false);
                }
            } else {
                _checkWorking(false);
            }
        }
    }

    /**
     * Load Tags attribute to read with polling
     */
    this.load = function (_data) {
        varsValue = [];
        data = JSON.parse(JSON.stringify(_data));
        try {
            itemsMap = {};
            var count = Object.keys(data.tags).length;
            for (var id in data.tags) {
                itemsMap[data.tags[id].address] = data.tags[id];
                // if (!itemsMap[data.tags[id].address]) {
                //     itemsMap[data.tags[id].address] = [data.tags[id]];
                // } else {
                //     itemsMap[data.tags[id].address].push(data.tags[id]);
                // }
            }
            logger.info(`'${data.name}' data loaded (${count})`, true);
        } catch (err) {
            logger.error(`'${data.name}' load error! ${err}`);
        }
    }

    /**
     * Return Tags values array { id: <name>, value: <value> }
     */
    this.getValues = function () {
        return varsValue;
    }

    /**
     * Return Tag value { id: <name>, value: <value>, ts: <lastTimestampValue> }
     */
    this.getValue = function (id) {
        if (varsValue[id]) {
            return { id: id, value: varsValue[id].value, ts: lastTimestampValue };
        }
        return null;
    }

    /**
     * Return connection status 'connect-off', 'connect-ok', 'connect-error', 'connect-busy'
     */
    this.getStatus = function () {
        return lastStatus;
    }

    /**
     * Return Tag property to show in frontend
     */
    this.getTagProperty = function (tagid) {
        if (data.tags[tagid]) {
            return { id: tagid, name: data.tags[tagid].name, type: data.tags[tagid].type, format: data.tags[tagid].format };
        } else {
            return null;
        }
    }

    /**
     * Set the Tag value to device
     * take the address from
     */
    this.setValue = async function (tagId, value) {
        if (data.tags[tagId]) {
            let valueToSend = await deviceUtils.tagRawCalculator(value, data.tags[tagId], runtime);
            conn.writeItems([data.tags[tagId].address], [parseFloat(valueToSend)], (error) => {
                if (error) {
                    logger.error(`'${data.tags[tagId].name}' setValue error! ${error}`);
                } else {
                    logger.info(`'${data.tags[tagId].name}' setValue(${tagId}, ${valueToSend})`, true, true);
                }
            });
            return true;
        }
        return false;
    }

    /**
     * Return if device is connected
     */
    this.isConnected = function () {
        return connected;
    }

    /**
     * Bind the DAQ store function
     */
    this.bindAddDaq = function (fnc) {
        this.addDaq = fnc;                         // Add the DAQ value to db history
    }
    this.addDaq = null;

    /**
     * Return the timestamp of last read tag operation on polling
     * @returns
     */
     this.lastReadTimestamp = () => {
        return lastTimestampValue;
    }

    /**
     * Return the Daq settings of Tag
     * @returns
     */
    this.getTagDaqSettings = (tagId) => {
        return data.tags[tagId] ? data.tags[tagId].daq : null;
    }

    /**
     * Set Daq settings of Tag
     * @returns
     */
    this.setTagDaqSettings = (tagId, settings) => {
        if (data.tags[tagId]) {
            utils.mergeObjectsValues(data.tags[tagId].daq, settings);
        }
    }

    /**
     * Clear local Items value by set all to null
     */
    var _clearVarsValue = function () {
        for (var id in varsValue) {
            varsValue[id].value = null;
        }
        if (varsValue.length) {
            _emitValues(varsValue);
        }
    }

    /**
     * Read all values
     */
    var _readValues = function () {
        return new Promise((resolve, reject) => {
            conn.readAllItems((err, items) => {
                if (err) {
                    reject(err);
                }
                resolve(items);
            });
        });
    }

    /**
     * Update the Tags values read
     * @param {*} vars
     */
    var _updateVarsValue = async (vars) => {
        const timestamp = new Date().getTime();
        var changed = {};
        for (const [key, value] of Object.entries(itemsMap)) {
            if (!utils.isNullOrUndefined(vars[key])) {
                var id = itemsMap[key].id;
                var valueChanged = itemsMap[key].value !== vars[key];
                itemsMap[key].rawValue = vars[key];
                itemsMap[key].value = await deviceUtils.tagValueCompose(vars[key], varsValue[id] ? varsValue[id].value : null, itemsMap[key]);
                varsValue[id] = { id: id, value: itemsMap[key].value, type: itemsMap[key].type, daq: itemsMap[key].daq, changed: valueChanged, timestamp: timestamp };
                if (this.addDaq && deviceUtils.tagDaqToSave(varsValue[id], timestamp)) {
                    changed[id] = varsValue[id];
                }
                varsValue[id].changed = false;
            }
        };
        return changed;
    }

    /**
     * Connect with RTU or TCP
     */
    var _connect = function (callback) {
        try {
            var port = 44818;
            var addr = data.property.address;
            if (data.property.address.indexOf(':') !== -1) {
                var addr = data.property.address.substring(0, data.property.address.indexOf(':'));
                var temp = data.property.address.substring(data.property.address.indexOf(':') + 1);
                port = parseInt(temp);
            }
            if (data.property.options) {
                conn.initiateConnection({ port: port, host: addr, routing: [0x01, 0x00, data.property.rack, data.property.slot] }, callback);
            } else {
                conn.initiateConnection({ port: port, host: addr /* , routing: [0x01,0x00,0x01,0x00] */ }, callback);
            }
        } catch (err) {
            callback(err);
        }
    }

    /**
     * Emit the PLC connection status
     * @param {*} status
     */
    var _emitStatus = function (status) {
        lastStatus = status;
        events.emit('device-status:changed', { id: data.id, status: status });
    }

    /**
     * Emit the webapi Tags values array { id: <name>, value: <value>, type: <type> }
     * @param {*} values
     */
    var _emitValues = function (values) {
        events.emit('device-value:changed', { id: data.id, values: values });
    }

    /**
     * Used to manage the async connection and polling automation (that not overloading)
     * @param {*} check
     */
    var _checkWorking = function (check) {
        if (check && working) {
            overloading++;
            logger.warn(`'${data.name}' working (connection || polling) overload! ${overloading}`);
            // !The driver don't give the break connection
            if (overloading >= 3) {
                conn.dropConnection();
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
    init: function (settings) {
    },
    create: function (data, logger, events, manager, runtime) {
        // To use with plugin
        try { EthernetIp = require('nodepccc'); } catch { }
        if (!EthernetIp && manager) { try { EthernetIp = manager.require('nodepccc'); } catch { } }
        if (!EthernetIp) return null;
        return new EthernetIPclient(data, logger, events, runtime);
    }
}
