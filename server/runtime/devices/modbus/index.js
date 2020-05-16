/**
 * 'modbus': modbus wrapper to communicate with PLC throw RTU/TCP 
 */

'use strict';
var ModbusRTU = require("modbus-serial");

function MODBUSclient(_data, _logger, _events) {
    // var db = {};                        // Loaded Signal in DB format { DB index, start, size, ... }
    var data = JSON.parse(JSON.stringify(_data));                   // Current Device data { id, name, tags, enabled, ... }
    var logger = _logger;  
    var client = new ModbusRTU();       // Client Modbus (Master)
    var working = false;                // Working flag to manage overloading polling and connection
    var events = _events;               // Events to commit change to runtime
    var lastStatus = '';                // Last Device status
    var varsValue = [];                 // Signale to send to frontend { id, type, value }
    // var dbItemsMap = {};                // DB Mapped Signale name with DbItem to find for set value
    // var mixItemsMap = {};               // E/I/A/Q/M Mapped Signale name to find for read in polling and set value
    var daqInterval = 0;                // Min save DAQ value interval, used to store DAQ too if the value don't change (milliseconds)
    // var lastDaqInterval = 0;            // Help to check daqInterval
    var overloading = 0;                // Overloading counter to mange the break connection
    var type;

    /**
     * initialize the modubus type 
     */
    this.init = function (_type) {
        type = _type;
    }

    /**
     * Connect to PLC
     * Emit connection status to clients, clear all Tags values
     */
    this.connect = function () {
        return new Promise(function (resolve, reject) {
            if (data.property && data.property.address && (type === ModbusTypes.TCP || 
                    (type === ModbusTypes.RTU && data.property.baudrate && data.property.databits && data.property.stopbits && data.property.parity))) {
                try {
                    if (!client.isOpen  && _checkWorking(true)) {
                        logger.info(data.name + ': try to connect ' + data.property.address);
                        _connect(function (err) {
                            if (err) {
                                logger.error(data.name + ': connect failed! ' + err);
                                _emitStatus('connect-error');
                                _clearVarsValue();
                                reject();
                            } else {
                                logger.info(data.name + ': connected!');
                                _emitStatus('connect-ok');
                                resolve();
                            }
                            _checkWorking(false);
                        });
                    } else {
                        reject();
                    }
                } catch (err) {
                    logger.error(data.name + ': try to connect error! ' + err);
                    _checkWorking(false);
                    _emitStatus('connect-error');
                    _clearVarsValue();
                    reject();
                }
            } else {
                logger.error(data.name + ': missing connection data!');
                _emitStatus('connect-failed');
                _clearVarsValue();
                reject();
            }
        });
    }

    /**
     * Disconnect the PLC
     * Emit connection status to clients, clear all Tags values
     */
    this.disconnect = function () {
        return new Promise(function (resolve, reject) {
            _checkWorking(false);
            if (!client.isOpen) {
                _emitStatus('connect-off');
                _clearVarsValue();
                resolve(true);
            } else {
                client.close(function (result) {
                    if (result) {
                        logger.error(data.name + ' try to disconnect failed!');
                    } else {
                        logger.info(data.name + ': disconnected!');
                    }
                    _emitStatus('connect-off');
                    _clearVarsValue();
                    resolve(result);
                });
            }
        });
    }

    /**
     * Read values in polling mode 
     * Update the tags values list, save in DAQ if value changed or for daqInterval and emit values to clients
     */
    this.polling = function () {
        if (_checkWorking(true)) {
            var readVarsfnc = [];
        //     for (var dbnum in db) {
        //         readVarsfnc.push(_readDB(parseInt(dbnum), Object.values(db[dbnum].Items)));
        //     }
        //     if (Object.keys(mixItemsMap).length) {
        //         readVarsfnc.push(_readVars(Object.values(mixItemsMap)));
        //     }
            Promise.all(readVarsfnc).then(result => {
                _checkWorking(false);
        //         if (result.length) {
        //             let varsValueChanged = _updateVarsValue(result);
        //             _emitValues(varsValue);
        //             if (this.addDaq) {
        //                 var current = new Date().getTime();
        //                 if (current - daqInterval > lastDaqInterval) {
        //                     this.addDaq(varsValue);
        //                     lastDaqInterval = current;
        //                 } else if (varsValueChanged) {
        //                     this.addDaq(varsValueChanged);
        //                 }
        //             }
        //         } else {
        //             // console.log('not');
        //         }
            }, reason => {
                if (reason && reason.stack) {
                    logger.error(data.name + ' _readVars error: ' + reason.stack);
                } else {
                    logger.error(data.name + ' _readVars error: ' + reason);
                }
                _checkWorking(false);
            });
        }
    }

    /**
     * Load Tags attribute to read with polling
     */
    this.load = function (_data) {
        data = JSON.parse(JSON.stringify(_data));
        // db = {};
        // varsValue = [];
        // dbItemsMap = {};
        // mixItemsMap = {};
        var count = 0;
        // for (var id in data.tags) {
        //     var varDb = _getTagItem(data.tags[id]);
        //     if (varDb instanceof DbItem) {
        //         if (!db[varDb.dbnum]) {
        //             var grptag = new DbItems(varDb.dbnum);
        //             db[varDb.dbnum] = grptag;
        //         }
        //         if (!db[varDb.dbnum].Items[varDb.Start]) {
        //             db[varDb.dbnum].Items[varDb.Start] = varDb;
        //         }
        //         db[varDb.dbnum].Items[varDb.Start].Tags.push(data.tags[id]); // because you can have multiple tags at the same DB address
        //         if (db[varDb.dbnum].MaxSize < varDb.Start + datatypes[varDb.type].S7WordLen) {
        //             db[varDb.dbnum].MaxSize = varDb.Start + datatypes[varDb.type].S7WordLen;
        //         }
        //         // check Bit to Map
        //         if (varDb.bit >= 0) {
        //             varDb.BitMap[varDb.bit] = id;
        //         }
        //         count++;
        //         dbItemsMap[id] = db[varDb.dbnum].Items[varDb.Start];
        //     } else if (varDb && !isNaN(varDb.Start)) {
        //         varDb.id = id;
        //         varDb.name = data.tags[id].name;
        //         mixItemsMap[id] = varDb;
        //     }
        // }
        logger.info(data.name + ': data loaded (' + count + ')');
    }

    /**
     * Return Tags values array { id: <name>, value: <value>, type: <type> }
     */
    this.getValues = function () {
        return varsValue;
    }

    /**
     * Return connection status 'connect-off', 'connect-ok', 'connect-error'
     */
    this.getStatus = function () {
        return lastStatus;
    }

    /**
     * Return Tag property
     */
    this.getTagProperty = function (id) {
        // if (dbItemsMap[id]) {
        //     return { id: id, name: id, type: dbItemsMap[id].type };
        // } else if (mixItemsMap[id]) {
        //     return { id: id, name: id, type: mixItemsMap[id].type };
        // } else {
        //     return null;
        // }
    }

    /**
     * Set the Tag value
     * Read the current Tag object, write the value in object and send to SPS 
     */
    this.setValue = function (sigid, value) {
        // var item = _getTagItem(data.tags[sigid]);
        // if (item) {
        //     item.value = value;
        //     _writeVars([item], (item instanceof DbItem)).then(result => {
        //         logger.info(data.name + ' setValue : ' + sigid + '=' + value);
        //     }, reason => {
        //         if (reason && reason.stack) {
        //             logger.error(data.name + ' _writeDB error: ' + reason.stack);
        //         } else {
        //             logger.error(data.name + ' _writeDB error: ' + reason);
        //         }
        //     });
        // }
    }

    /**
     * Return if PLC is connected
     * Don't work if PLC will disconnect
     */
    this.isConnected = function () {
        return client.isOpen;
    }

    /**
     * Bind the DAQ store function and default daqInterval value in milliseconds
     */
    this.bindAddDaq = function (fnc, intervalToSave) {
        this.addDaq = fnc;                         // Add the DAQ value to db history
        daqInterval = intervalToSave;
    }

    this.addDaq = null;      

    /**
     * Connect with RTU or TCP
     */
    var _connect = function(callback) {
        try {
            if (type === ModbusTypes.RTU) {
                client.connectRTU(data.property.address, {
                                    baudrate: parseInt(data.property.baudrate),
                                    dataBits: parseInt(data.property.databits),
                                    stopBits: parseFloat(data.property.stopbits),
                                    parity: data.property.parity.toLowerCase()}, callback);
            } else if (type === ModbusTypes.TCP) {
                var port = 502;
                var addr = data.property.address;
                if (data.property.address.indexOf(':') !== -1) {
                    var addr = data.property.address.substring(0, data.property.address.indexOf(':'));
                    var temp = data.property.address.substring(data.property.address.indexOf(':') + 1);
                    port = parseInt(temp);
                }
                client.connectTCP(addr, { port: port }, callback)
            }
        } catch (err) {
            callback(err);
        }
    }

    /**
     * Used to manage the async connection and polling automation (that not overloading)
     * @param {*} check 
     */
    var _checkWorking = function (check) {
        if (check && working) {
            overloading++;
            logger.error(data.name + ' working (polling/connecting) overload! ' + overloading);
            // !The driver don't give the break connection
            if (overloading >= 3) {
                client.close();
            } else {
                return false;
            }
        }
        working = check;
        overloading = 0;
        return true;
    }

    /**
     * Clear the Tags values by setting to null
     * Emit to clients
     */
    var _clearVarsValue = function () {
        // for (var id in varsValue) {
        //     varsValue[id].value = null;
        // }
        // for (var dbid in db) {
        //     for (var itemid in db[dbid].Items) {
        //         db[dbid].Items[itemid].value = null;
        //     }
        // }
        // for (var mi in mixItemsMap) {
        //     mixItemsMap[mi].value = null;
        // }
        // _emitValues(varsValue);
    }

    /**
     * Emit the PLC connection status
     * @param {*} status 
     */
    var _emitStatus = function (status) {
        lastStatus = status;
        events.emit('device-status:changed', { id: data.name, status: status });
    }
}

const ModbusTypes = { RTU: 0, TCP: 1 };

module.exports = {
    init: function (settings) {
        // deviceCloseTimeout = settings.deviceCloseTimeout || 15000;
    },
    create: function (data, logger, events) {
        return new MODBUSclient(data, logger, events);
    },
    ModbusTypes: ModbusTypes
}