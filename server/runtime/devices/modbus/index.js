/**
 * 'modbus': modbus wrapper to communicate with PLC throw RTU/TCP 
 */

'use strict';
var ModbusRTU = require("modbus-serial");
const datatypes = require('./datatypes');
const TOKEN_LIMIT = 1000;
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
    var mixItemsMap = {};               // 
    var daqInterval = 0;                // Min save DAQ value interval, used to store DAQ too if the value don't change (milliseconds)
    var lastDaqInterval = 0;            // Help to check daqInterval
    var overloading = 0;                // Overloading counter to mange the break connection
    var lastTimestampValue;             // Last Timestamp of asked values
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
                        _emitStatus('connect-error');
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
    this.polling = async function () {
        if (_checkWorking(true)) {
            var readVarsfnc = [];
            if (!data.property.options) {
                for (var memaddr in memory) {
                    var tokenizedAddress = parseAddress(memaddr);
                    readVarsfnc.push(await _readMemory(parseInt(tokenizedAddress.address), memory[memaddr].Start, memory[memaddr].MaxSize, Object.values(memory[memaddr].Items)));
                    readVarsfnc.push(await delay(100));
                }
            } else {
                for (var memaddr in mixItemsMap) {
                    try {
                        readVarsfnc.push(await _readMemory(getMemoryAddress(parseInt(memaddr), false), mixItemsMap[memaddr].Start, mixItemsMap[memaddr].MaxSize, Object.values(mixItemsMap[memaddr].Items)));
                        readVarsfnc.push(await delay(100));
                    } catch (error) {
                    }
                }
            }
            _checkWorking(false);
            Promise.all(readVarsfnc).then(result => {
                _checkWorking(false);
                if (result.length) {
                    let varsValueChanged = _updateVarsValue(result);
                    lastTimestampValue = new Date().getTime();
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
                if (lastStatus !== 'connect-ok') {
                    _emitStatus('connect-ok');                    
                }
            }, reason => {
                if (reason) {
                    if (reason.stack) {
                        logger.error(data.name + ' _readVars error: ' + reason.stack);
                    } else if (reason.message) {
                        logger.error(data.name + ' _readVars error: ' + reason.message);
                    }
                } else {
                    logger.error(data.name + ' _readVars error: ' + reason);
                }
                _checkWorking(false);
            });
        } else {
            _emitStatus('connect-busy');
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
        mixItemsMap = {};
        var stepsMap = {};
        var count = 0;
        for (var id in data.tags) {
            var offset = parseInt(data.tags[id].address) - 1;   // because settings address from 1 to 65536 but communication start from 0
            var token = Math.trunc(offset / TOKEN_LIMIT);
            var memaddr = formatAddress(data.tags[id].memaddress, token);
            if (!memory[memaddr]) {
                memory[memaddr] = new MemoryItems();
            }
            if (!memory[memaddr].Items[offset]) {
                memory[memaddr].Items[offset] = new MemoryItem(data.tags[id].type, offset);
            }
            memory[memaddr].Items[offset].Tags.push(data.tags[id]); // because you can have multiple tags at the same DB address
            
            if (offset < memory[memaddr].Start) {
                if (memory[memaddr].Start != 65536) {
                    memory[memaddr].MaxSize += memory[memaddr].Start - offset;
                    memory[memaddr].Start = offset;
                } else {
                    memory[memaddr].MaxSize = datatypes[data.tags[id].type].WordLen;
                    memory[memaddr].Start = offset;
                }
            } else {
                var len = offset + datatypes[data.tags[id].type].WordLen - memory[memaddr].Start;
                if (memory[memaddr].MaxSize < len) {
                    memory[memaddr].MaxSize = len;
                }
            }
            memItemsMap[id] = memory[memaddr].Items[offset];
            stepsMap[parseInt(data.tags[id].memaddress) + offset] = datatypes[data.tags[id].type].WordLen;
        }
        stepsMap[999999] = true;    // used to process the last right address
        let laststart = -1;
        let lastkey = -1;
        Object.keys(stepsMap).sort().forEach(function(key) {
            // lastkey++;
            var adr = parseInt(key);
            if (laststart >= 0 && adr > lastkey) {
                let mits = new MemoryItems();
                mits.Start = laststart - getMemoryAddress(laststart, false);
                mits.MaxSize = lastkey - laststart; 
                var memaddr = getMemoryAddress(laststart, true);
                mits.Items = getMemoryItems(memory[memaddr].Items, mits.Start, mits.MaxSize);
                mixItemsMap[laststart] = mits;
                laststart = adr;

            } 
            if (laststart < 0) {
                laststart = adr;
            }
            lastkey = adr + stepsMap[key];
        });
        logger.info(data.name + ': data loaded (' + count + ')');
    }

    /**
     * Return Tags values array { id: <name>, value: <value>, type: <type> }
     */
    this.getValues = function () {
        return varsValue;
    }

    /**
     * Return Tag value { id: <name>, value: <value>, ts: <lastTimestampValue> }
     */
    this.getValue = function (id) {
        if (varsValue[id]) {
            return {id: id, value: varsValue[id].value, ts: lastTimestampValue };
        }
        return null;
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
        if (data.tags[sigid]) {
            var memaddr = data.tags[sigid].memaddress;
            var offset = parseInt(data.tags[sigid].address) - 1;   // because settings address from 1 to 65536 but communication start from 0
            var val = datatypes[data.tags[sigid].type].formatter(value);
            _writeMemory(parseInt(memaddr), offset, val).then(result => {
                logger.info('setValue : ' + sigid + '=' + val);
            }, reason => {
                if (reason && reason.stack) {
                    logger.error(data.name + ' _writeDB error: ' + reason.stack);
                } else {
                    logger.error(data.name + ' _writeDB error: ' + reason);
                }
            });
        }
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
                client.connectRTUBuffered(data.property.address, {
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
     * Read a Memory from modbus and parse the result
     * @param {int} memoryAddress - The memory address to read
     * @param {int} start - Position of the first variable
     * @param {int} size - Length of the variables to read (the last address)
     * @param {array} vars - Array of Var objects
     * @returns {Promise} - Resolves to the vars array with populate *value* property
     */
    var _readMemory = function (memoryAddress, start, size, vars) {
        return new Promise((resolve, reject) => {
            if (vars.length === 0) return resolve([]);
            // define read function
            if (memoryAddress === ModbusMemoryAddress.CoilStatus) {                      // Coil Status (Read/Write 000001-065536)
                client.readCoils(start, size).then( res => {
                    let changed = [];
                    if (res.data) {
                        vars.map(v => {
                            let bitoffset = Math.trunc((v.offset - start) / 8);
                            let bit = (v.offset - start) % 8;
                            let value = datatypes[v.type].parser(res.buffer, bitoffset, bit);
                            if (value !== v.value) {
                                changed.push(v);
                            }
                            v.value = value;
                        });
                    }
                    resolve(changed);
                }, reason => {
                    reject(reason);
                });
            } else if (memoryAddress === ModbusMemoryAddress.DigitalInputs) {          // Digital Inputs (Read 100001-165536)
                client.readDiscreteInputs(start, size).then( res => {
                    let changed = [];
                    if (res.data) {
                        vars.map(v => {
                            let bitoffset = Math.trunc((v.offset - start) / 8);
                            let bit = (v.offset - start) % 8;
                            let value = datatypes[v.type].parser(res.buffer, bitoffset, bit);
                            if (value !== v.value) {
                                changed.push(v);
                            }
                            v.value = value;
                        });
                    }
                    resolve(changed);
                }, reason => {
                    reject(reason);
                });
            } else if (memoryAddress === ModbusMemoryAddress.InputRegisters) {          // Input Registers (Read  300001-365536)
                client.readInputRegisters(start, size).then( res => {
                    let changed = [];
                    if (res.data) {
                        vars.map(v => {
                            try {
                                let byteoffset = (v.offset - start) * 2;
                                let buffer = Buffer.from(res.buffer.slice(byteoffset, byteoffset + datatypes[v.type].bytes))
                                let value = datatypes[v.type].parser(buffer);
                                if (value !== v.value) {
                                    changed.push(v);
                                }
                                v.value = value;    
                            } catch (err) {
                                console.log(err);
                            }
                        });
                    }
                    resolve(changed);
                }, reason => {
                    reject(reason);
                });
            } else if (memoryAddress === ModbusMemoryAddress.HoldingRegisters) {          // Holding Registers (Read/Write  400001-465535)
                client.readHoldingRegisters(start, size).then( res => {
                    let changed = [];
                    if (res.data) {
                        vars.map(v => {
                            let byteoffset = (v.offset - start) * 2;
                            let buffer = Buffer.from(res.buffer.slice(byteoffset, byteoffset + datatypes[v.type].bytes))
                            let value = datatypes[v.type].parser(buffer);
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
            } else {
                reject();
            }
        });
    }

    /**
     * Write value to modbus
     * @param {*} memoryAddress 
     * @param {*} start 
     * @param {*} value 
     */
    var _writeMemory = function (memoryAddress, start, value) {
        return new Promise((resolve, reject) => {
            if (memoryAddress === ModbusMemoryAddress.CoilStatus) {                      // Coil Status (Read/Write 000001-065536)
                client.writeCoil(start, value).then(res => {
                    resolve();
                }, reason => {
                    console.log(reason);
                    reject(reason);
                });
            } else if (memoryAddress === ModbusMemoryAddress.DigitalInputs) {           // Digital Inputs (Read 100001-165536)
                reject();
            } else if (memoryAddress === ModbusMemoryAddress.InputRegisters) {          // Input Registers (Read  300001-365536)
                reject();
            } else if (memoryAddress === ModbusMemoryAddress.HoldingRegisters) {        // Holding Registers (Read/Write  400001-465535)
                client.writeRegisters(start, value).then(res => {
                    resolve();
                }, reason => {
                    console.log(reason);
                    reject(reason);
                });
            } else {
                reject();
            }
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
            memItemsMap[id].value = null;
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

    const formatAddress = function(address, token) { return token + '-' + address; }
    const parseAddress = function(address) { return { token:  address.split('-')[0], address: address.split('-')[1] }; }
    const getMemoryAddress = function(address, askey) {
        if (address < ModbusMemoryAddress.DigitalInputs) {
            if (askey) return formatAddress('000000', '0');
            return ModbusMemoryAddress.CoilStatus;
        } else if (address < ModbusMemoryAddress.InputRegisters) {
            if (askey) return formatAddress(ModbusMemoryAddress.DigitalInputs, '0');
            return ModbusMemoryAddress.DigitalInputs;
        } else if (address < ModbusMemoryAddress.HoldingRegisters) {
            if (askey) return formatAddress(ModbusMemoryAddress.InputRegisters, '0');
            return ModbusMemoryAddress.InputRegisters;
        } else {
            if (askey) return formatAddress(ModbusMemoryAddress.HoldingRegisters, '0');
            return ModbusMemoryAddress.HoldingRegisters;
        }
    }

    const getMemoryItems = function(items, start, size) {
        let result = {};
        for (var itemidx in items) {
            if (items[itemidx].offset >= start && items[itemidx].offset < start + size) {
                result[itemidx] = items[itemidx];
            }
        }
        return result;
    }
    const delay = ms => { return new Promise(resolve => setTimeout(resolve, ms)) };
}

const ModbusTypes = { RTU: 0, TCP: 1 };
const ModbusMemoryAddress = { CoilStatus: 0, DigitalInputs: 100000, InputRegisters: 300000, HoldingRegisters: 400000 };

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