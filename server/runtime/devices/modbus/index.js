/**
 * 'modbus': modbus wrapper to communicate with PLC throw RTU/TCP 
 */

'use strict';
var ModbusRTU = require("modbus-serial");
const datatypes = require('./datatypes');

function MODBUSclient(_data, _logger, _events) {
    var memory = {};                        // Loaded Signal grouped by memory { memory index, start, size, ... }
    var data = JSON.parse(JSON.stringify(_data));                   // Current Device data { id, name, tags, enabled, ... }
    var logger = _logger;  
    var client = new ModbusRTU();       // Client Modbus (Master)
    var working = false;                // Working flag to manage overloading polling and connection
    var events = _events;               // Events to commit change to runtime
    var lastStatus = '';                // Last Device status
    var varsValue = [];                 // Signale to send to frontend { id, type, value }
    var memItemsMap = {};               // Mapped Signale name with MemoryItem to find for set value
    // var mixItemsMap = {};               // E/I/A/Q/M Mapped Signale name to find for read in polling and set value
    var daqInterval = 0;                // Min save DAQ value interval, used to store DAQ too if the value don't change (milliseconds)
    var lastDaqInterval = 0;            // Help to check daqInterval
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
                                if (data.property.slaveid) {
                                    // set the client's unit id
                                    client.setID(parseInt(data.property.slaveid));
                                }
                                // set a timout for requests default is null (no timeout)
                                client.setTimeout(2000);
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
            for (var memaddr in memory) {
                readVarsfnc.push(_readMemory(parseInt(memaddr), memory[memaddr].Start, memory[memaddr].MaxSize, Object.values(memory[memaddr].Items)));
            }
            _checkWorking(false);
        //     if (Object.keys(mixItemsMap).length) {
        //         readVarsfnc.push(_readVars(Object.values(mixItemsMap)));
        //     }
            Promise.all(readVarsfnc).then(result => {
                _checkWorking(false);
                if (result.length) {
                    let varsValueChanged = _updateVarsValue(result);
                    _emitValues(varsValue);
                    if (this.addDaq) {
                        var current = new Date().getTime();
                        if (current - daqInterval > lastDaqInterval) {
                            this.addDaq(varsValue);
                            lastDaqInterval = current;
                        } else if (varsValueChanged) {
                            this.addDaq(varsValueChanged);
                        }
                    }
                } else {
        //             // console.log('then error');
                }
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
        memory = {};
        varsValue = [];
        // memItemsMap = {};
        // mixItemsMap = {};
        var count = 0;
        for (var id in data.tags) {
            var memaddr = data.tags[id].memaddress;
            var offset = parseInt(data.tags[id].address);
            // var offsetInt = parseInt(offset);
            if (!memory[memaddr]) {
                memory[memaddr] = new MemoryItems();
            }
            if (!memory[memaddr].Items[offset]) {                
                memory[memaddr].Items[offset] = new MemoryItem(data.tags[id].type, offset);
            }
            memory[memaddr].Items[offset].Tags.push(data.tags[id]); // because you can have multiple tags at the same DB address
            var len = datatypes[data.tags[id].type].WordLen;
            if (offset < memory[memaddr].Start) {
                memory[memaddr].Start = offset;
            }
            if (memory[memaddr].MaxSize < offset + datatypes[data.tags[id].type].WordLen) {
                memory[memaddr].MaxSize = offset + datatypes[data.tags[id].type].WordLen;
            }
            memItemsMap[id] = memory[memaddr].Items[offset];
        }
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
        if (memItemsMap[id]) {
            return { id: id, name: id, type: memItemsMap[id].type };
        } else {
            return null;
        }
    }

    /**
     * Set the Tag value
     * Read the current Tag object, write the value in object and send to SPS 
     */
    this.setValue = function (sigid, value) {
        var memaddr = data.tags[sigid].memaddress;
        var offset = parseInt(data.tags[sigid].address);
        // .writeCoil(address, state)
        // .writeRegister (address, value)
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
                    baudRate: parseInt(data.property.baudrate),
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
     * Read a Memory and parse the result
     * @param {int} memoryAddress - The memory address to read
     * @param {int} start - Position of the first variable
     * @param {int} size - Length of the variables to read (the last address)
     * @param {array} vars - Array of Var objects
     * @returns {Promise} - Resolves to the vars array with populate *value* property
     */
    var _readMemory = function (memoryAddress, start, size, vars) {
        return new Promise((resolve, reject) => {
            if (vars.length === 0) return resolve([]);

            // vars.forEach(v => {
            //     if (v.offset < offset) offset = v.Start;
            //     if (end < v.Start + datatypes[v.type].bytes) {
            //         end = v.Start + datatypes[v.type].bytes;
            //     }
            // });
            // define read function
            if (memoryAddress === 1) {                      // Coil Status (Read/Write 000001-065536)
                client.readCoils(start, size).then( res => {
                    console.log(res);
                    let changed = [];
                    if (res.data) {
                        vars.map(v => {
                            let value = datatypes[v.type].parser(res.data[v.offset]);
                            if (value !== v.value) {
                                changed.push(v);
                            }
                            v.value = value;
                        });
                    }
                    resolve(changed);
                }, reason => {
                    console.log(reason);
                    reject(reason);
                });
            } else if (memoryAddress === 200001) {          // Digital Inputs (Read 100001-165536)
                fncToRead = client.readDiscreteInputs;
            } else if (memoryAddress === 300001) {          // Input Registers (Read  300001-365536)
                fncToRead = client.readInputRegisters;
            } else if (memoryAddress === 400001) {          // Holding Registers (Read/Write  400001-465535)
                fncToRead = client.readHoldingRegisters;
            } else {
                reject();
            }
            // fncToRead(start, size).then( res => {
            //     console.log(res);
            //     resolve(res);
            // }, reason => {
            //     console.log(reason);
            //     reject(reason);
            // });

            // console.log);, (err, res) => {
                // if (err) return _getErr(err);
                // let changed = [];
                // console.log(res);
                // vars.map(v => {
                //     let value = null;
                //     if (v.type === 'BOOL') {
                //         // check the full byte and send all bit if there is a change 
                //         value = datatypes['BYTE'].parser(res, v.Start - offset, -1);
                //     } else {
                //         value = datatypes[v.type].parser(res, v.Start - offset, v.bit);
                //     }
                //     if (value !== v.value) {
                //         changed.push(v);
                //     }
                //     v.value = value;
                //     return v;
                // });
                // resolve(changed);
            // });
        });
    }

    /**
     * Clear the Tags values by setting to null
     * Emit to clients
     */
    var _clearVarsValue = function () {
        for (var id in varsValue) {
            varsValue[id].value = null;
        }
        for (var id in memItemsMap) {
            for (var itemid in memItemsMap[dbid].Items) {
                memItemsMap[id].Items[itemid].value = null;
            }
        }
        _emitValues(varsValue);
    }

        /**
     * Update the Tags values read
     * @param {*} vars 
     */
    var _updateVarsValue = function (vars) {
        var someval = false;
        var changed = [];
        var result = [];
        for (var vid in vars) {
            let items = vars[vid];
            for (var itemidx in items) {
                if (items[itemidx] instanceof MemoryItem) {
                    let type = items[itemidx].type;
                    let value = items[itemidx].value;
                    let tags = items[itemidx].Tags;
                    tags.forEach(tag => {
                        result[tag.name] = { id: tag.name, value: value, type: type };
                        someval = true;
                    });
                } else {
                    result[items[itemidx].name] = { id: items[itemidx].name, value: items[itemidx].value, type: items[itemidx].type };
                    someval = true;
                }
            }
        }
        if (someval) {
            for (var id in result) {
                if (varsValue[id] !== result[id]) {
                    changed[id] = result[id];
                }
                varsValue[id] = result[id];
            }
            return changed;
        }
        return null;
    }

    /**
     * Emit the PLC Tags values array { id: <name>, value: <value>, type: <type> }
     * @param {*} values 
     */
    var _emitValues = function (values) {
        events.emit('device-value:changed', { id: data.name, values: values });
    }

    /**
     * Emit the PLC connection status
     * @param {*} status 
     */
    var _emitStatus = function (status) {
        lastStatus = status;
        events.emit('device-status:changed', { id: data.name, status: status });
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

function MemoryItem(type, offset) {
    this.offset = offset;
    this.type = type;
    this.bit = -1;
    this.Tags = [];
}

function MemoryItems() {
    this.Start = 65536;
    this.MaxSize = 0;
    this.Items = {};
}