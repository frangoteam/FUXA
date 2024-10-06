/**
 * 'modbus': modbus wrapper to communicate with PLC throw RTU/TCP
 */

'use strict';
var ModbusRTU;
const datatypes = require('./datatypes');
const utils = require('../../utils');
const deviceUtils = require('../device-utils');
const net = require("net");
const TOKEN_LIMIT = 100;
const Mutex = require("async-mutex").Mutex;

function MODBUSclient(_data, _logger, _events, _runtime) {
    var memory = {};                        // Loaded Signal grouped by memory { memory index, start, size, ... }
    var data = JSON.parse(JSON.stringify(_data));                   // Current Device data { id, name, tags, enabled, ... }
    var logger = _logger;
    var client = new ModbusRTU();       // Client Modbus (Master)
    var working = false;                // Working flag to manage overloading polling and connection
    var events = _events;               // Events to commit change to runtime
    var lastStatus = '';                // Last Device status
    var varsValue = [];                 // Signale to send to frontend { id, type, value }
    var memItemsMap = {};               // Mapped Signale name with MemoryItem to find for set value
    var mixItemsMap = {};               // Map the fragmented Signale { key = start address, value = MemoryItems }
    var overloading = 0;                // Overloading counter to mange the break connection
    var lastTimestampValue;             // Last Timestamp of asked values
    var type;
    var runtime = _runtime;             // Access runtime config such as scripts

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
                        logger.info(`'${data.name}' try to connect ${data.property.address}`, true);
                        _connect(function (err) {
                            if (err) {
                                logger.error(`'${data.name}' connect failed! ${err}`);
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
                        logger.error(`'${data.name}' try to disconnect failed!`);
                    } else {
                        logger.info(`'${data.name}' disconnected!`, true);
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
     * Update the tags values list, save in DAQ if value changed or in interval and emit values to clients
     */
    this.polling = async function () {
        let socketRelease;
        try {
            if (data.property.socketReuse && runtime.socketMutex.has(data.property.address)) {
                socketRelease = await runtime.socketMutex.get(data.property.address).acquire();
            }
            await this._polling()
        } catch (err) {
            logger.error(`'${data.name}' polling! ${err}`);
        } finally {
            if (!utils.isNullOrUndefined(socketRelease)) {
                socketRelease()
            }
        }
    }
     this._polling = async function () {
        if (_checkWorking(true)) {
            var readVarsfnc = [];
            if (!data.property.options) {
                for (var memaddr in memory) {
                    var tokenizedAddress = parseAddress(memaddr);
                    try {
                        readVarsfnc.push(await _readMemory(parseInt(tokenizedAddress.address), memory[memaddr].Start, memory[memaddr].MaxSize, Object.values(memory[memaddr].Items)));
                        readVarsfnc.push(await delay(data.property.delay || 10));
                    } catch (err) {
                        logger.error(`'${data.name}' _readMemory error! ${err}`);
                    }
                }
            } else {
                for (var memaddr in mixItemsMap) {
                    try {
                        readVarsfnc.push(await _readMemory(getMemoryAddress(parseInt(memaddr), false), mixItemsMap[memaddr].Start, mixItemsMap[memaddr].MaxSize, Object.values(mixItemsMap[memaddr].Items)));
                        readVarsfnc.push(await delay(data.property.delay || 10));
                    } catch (err) {
                        logger.error(`'${data.name}' _readMemory error! ${err}`);
                    }
                }
            }
            // _checkWorking(false);
            try{
                const result = await Promise.all(readVarsfnc);

                _checkWorking(false);
                if (result.length) {
                    let varsValueChanged = await _updateVarsValue(result);
                    lastTimestampValue = new Date().getTime();
                    _emitValues(varsValue);
                    if (this.addDaq && !utils.isEmptyObject(varsValueChanged)) {
                        this.addDaq(varsValueChanged, data.name, data.id);
                    }
                } else {
                    // console.error('then error');
                }
                if (lastStatus !== 'connect-ok') {
                    _emitStatus('connect-ok');
                }
            } catch (reason) {
                if (reason) {
                    if (reason.stack) {
                        logger.error(`'${data.name}' _readVars error! ${reason.stack}`);
                    } else if (reason.message) {
                        logger.error(`'${data.name}' _readVars error! ${reason.message}`);
                    }
                } else {
                    logger.error(`'${data.name}' _readVars error! ${reason}`);
                }
                _checkWorking(false);
            };
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
        mixItemsMap = {};   // Map the fragmented tag { key = start address, value = MemoryItems }
        var stepsMap = {};  // Map the tag start address and size { key = start address, value = signal size and offset }
        var count = 0;
        for (var id in data.tags) {
            try {
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
                memItemsMap[id].format = data.tags[id].format;
                stepsMap[parseInt(data.tags[id].memaddress) + offset] =  { size: datatypes[data.tags[id].type].WordLen, offset: offset };
            } catch (err) {
                logger.error(`'${data.name}' load error! ${err}`);
            }
        }
        // for fragmented
        let lastStart = -1;             // last start address
        let lastMemAdr = -1;
        let nextAdr = -1;
        Object.keys(stepsMap).sort((a, b) => {return a - b; }).forEach(function(key) {
            try {
                var adr = parseInt(key);        // tag address
                let lastAdrSize = adr + stepsMap[key].size;
                let offset = stepsMap[key].offset;
                if (nextAdr < adr) {
                    // to fragment then new range
                    lastStart = adr;
                    let mits = new MemoryItems();
                    mits.Start = lastStart - getMemoryAddress(lastStart, false);
                    mits.MaxSize = lastAdrSize - lastStart;
                    var token = Math.trunc(offset / TOKEN_LIMIT);
                    lastMemAdr = getMemoryAddress(lastStart, true, token);
                    mits.Items = getMemoryItems(memory[lastMemAdr].Items, mits.Start, mits.MaxSize);
                    mixItemsMap[lastStart] = mits;
                } else if (mixItemsMap[lastStart]) {
                    // to attach of exist range
                    mixItemsMap[lastStart].MaxSize = lastAdrSize - lastStart;
                    mixItemsMap[lastStart].Items = getMemoryItems(memory[lastMemAdr].Items, mixItemsMap[lastStart].Start, mixItemsMap[lastStart].MaxSize);
                }
                nextAdr = 1 + adr + stepsMap[key].size;
            } catch (err) {
                logger.error(`'${data.name}' load error! ${err}`);
            }
        });
        logger.info(`'${data.name}' data loaded (${count})`, true);
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
            return { id: id, name: id, type: memItemsMap[id].type, format: memItemsMap[id].format };
        } else {
            return null;
        }
    }

    /**
     * Set the Tag value
     * Read the current Tag object, write the value in object and send to SPS
     */
    this.setValue = async function (sigid, value) {
        if (data.tags[sigid]) {
            var memaddr = data.tags[sigid].memaddress;
            var offset = parseInt(data.tags[sigid].address) - 1;   // because settings address from 1 to 65536 but communication start from 0
            value = await deviceUtils.tagRawCalculator(value, data.tags[sigid]);

            const divVal = convertValue(value, data.tags[sigid].divisor, true);
            var val;
            if (data.tags[sigid].scaleWriteFunction) {
                let parameters = [
                    { name: 'value', type: 'value', value: divVal }
                ];
                if (data.tags[sigid].scaleWriteParams) {
                    const extraParamsWithValues = JSON.parse(data.tags[sigid].scaleWriteParams);
                    parameters = [...parameters, ...extraParamsWithValues];

                }
                const script = { id: data.tags[sigid].scaleWriteFunction,
                    name: null,
                    parameters};
                try {
                    const bufVal = await runtime.scriptsMgr.runScript(script);
                    if (Array.isArray(bufVal)) {
                        if ((bufVal.length % 2) !== 0 ) {
                            logger.error(`'${data.tags[sigid].name}' setValue script error, returned buffer invalid must be mod 2`);
                            return false;
                        }
                        val = [];
                        for (let i = 0; i < bufVal.length;) {
                            val.push(bufVal.readUInt16BE(i));
                            i = i + 2;
                        }
                    } else {
                        val = bufVal;
                    }
                } catch (error) {
                    logger.error(`'${data.tags[sigid].name}' setValue script error! ${error.toString()}`);
                    return false;
                }

            } else {
                val = datatypes[data.tags[sigid].type].formatter(divVal);
            }

            if (type === ModbusTypes.RTU) {
                const start = Date.now();
                let now = start;
                while ((now - start) < 3000 && working) {  // wait max 3 seconds
                    now = Date.now();
                    await delay(20);
                }
                _checkWorking(true);
            }
            let socketRelease;
            try {
                if (type === ModbusTypes.TCP && data.property.socketReuse && runtime.socketMutex.has(data.property.address)) {
                    socketRelease = await runtime.socketMutex.get(data.property.address).acquire();
                }
                await _writeMemory(parseInt(memaddr), offset, val).then(result => {
                    logger.info(`'${data.name}' setValue(${sigid}, ${value})`, true, true);
                }, reason => {
                    if (reason && reason.stack) {
                        logger.error(`'${data.name}' _writeMemory error! ${reason.stack}`);
                    } else {
                        logger.error(`'${data.name}' _writeMemory error! ${reason}`);
                    }
                });
                if (type === ModbusTypes.RTU) {
                    _checkWorking(false);
                }
            } catch (err) {
                logger.error(`'${data.name}' setValue error! ${err}`);
            } finally {
                if (!utils.isNullOrUndefined(socketRelease)) {
                    socketRelease();
                }
            }
            return true;
        } else {
            logger.error(`'${data.name}' setValue(${sigid}, ${value}) Tag not found`, true, true);
        }
        return false;
    }

    /**
     * Return if PLC is connected
     * Don't work if PLC will disconnect
     */
    this.isConnected = function () {
        return client.isOpen;
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
     * Connect with RTU or TCP
     */
    var _connect = function(callback) {
        try {
            if (type === ModbusTypes.RTU) {
                const rtuOptions = {
                    baudRate: parseInt(data.property.baudrate),
                    dataBits: parseInt(data.property.databits),
                    stopBits: parseFloat(data.property.stopbits),
                    parity: data.property.parity.toLowerCase()
                }
                if (data.property.connectionOption === ModbusOptionType.RTUBufferedPort) {
                    client.connectRTUBuffered(data.property.address, rtuOptions, callback);
                } else if (data.property.connectionOption === ModbusOptionType.AsciiPort) {
                    client.connectAsciiSerial(data.property.address, rtuOptions, callback);
                } else {
                    client.connectRTU(data.property.address, rtuOptions, callback);
                }
            } else if (type === ModbusTypes.TCP) {
                var port = 502;
                var addr = data.property.address;
                if (data.property.address.indexOf(':') !== -1) {
                    addr = data.property.address.substring(0, data.property.address.indexOf(':'));
                    var temp = data.property.address.substring(data.property.address.indexOf(':') + 1);
                    port = parseInt(temp);
                }
                //reuse socket
                if (data.property.socketReuse) {
                    var socket;
                    if (runtime.socketPool.has(data.property.address)) {
                        socket = runtime.socketPool.get(data.property.address);
                    } else {
                        socket = new net.Socket();
                        runtime.socketPool.set(data.property.address, socket);
                        //init read mutex
                        if (data.property.socketReuse === ModbusReuseModeType.ReuseSerial) {
                            runtime.socketMutex.set(data.property.address, new Mutex())
                        }
                    }
                    var openFlag = socket.readyState === "opening" || socket.readyState === "open";
                    if (!openFlag) {
                        socket.connect({
                            // Default options
                            ...{
                                host: addr,
                                port: port
                            },
                        });
                    }
                }
                if (data.property.connectionOption === ModbusOptionType.UdpPort) {
                    client.connectUDP(addr, { port: port }, callback);
                } else if (data.property.connectionOption === ModbusOptionType.TcpRTUBufferedPort) {
                    if (data.property.socketReuse){
                        client.linkTcpRTUBuffered(runtime.socketPool.get(data.property.address), callback);
                    } else {
                        client.connectTcpRTUBuffered(addr, {port: port}, callback);
                    }
                } else if (data.property.connectionOption === ModbusOptionType.TelnetPort) {
                    if (data.property.socketReuse) {
                        client.linkTelnet(runtime.socketPool.get(data.property.address), callback);
                    } else {
                        client.connectTelnet(addr, {port: port}, callback);
                    }
                } else {
                    //reuse socket
                    if (data.property.socketReuse) {
                        client.linkTCP(runtime.socketPool.get(data.property.address), callback);
                    } else {
                        client.connectTCP(addr, { port: port }, callback);
                    }
                }
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
                    if (res.data) {
                        vars.map(v => {
                            let bitoffset = Math.trunc((v.offset - start) / 8);
                            let bit = (v.offset - start) % 8;
                            let value = datatypes[v.type].parser(res.buffer, bitoffset, bit);
                            v.changed = value !== v.rawValue;
                            v.rawValue = value;
                        });
                    }
                    resolve(vars);
                }, reason => {
                    reject(reason);
                });
            } else if (memoryAddress === ModbusMemoryAddress.DigitalInputs) {          // Digital Inputs (Read 100001-165536)
                client.readDiscreteInputs(start, size).then( res => {
                    if (res.data) {
                        vars.map(v => {
                            let bitoffset = Math.trunc((v.offset - start) / 8);
                            let bit = (v.offset - start) % 8;
                            let value = datatypes[v.type].parser(res.buffer, bitoffset, bit);
                            v.changed = value !== v.rawValue;
                            v.rawValue = value;
                        });
                    }
                    resolve(vars);
                }, reason => {
                    reject(reason);
                });
            } else if (memoryAddress === ModbusMemoryAddress.InputRegisters) {          // Input Registers (Read  300001-365536)
                client.readInputRegisters(start, size).then( res => {
                    if (res.data) {
                        vars.map(v => {
                            try {
                                let byteoffset = (v.offset - start) * 2;
                                let buffer = Buffer.from(res.buffer.slice(byteoffset, byteoffset + datatypes[v.type].bytes))
                                let value = datatypes[v.type].parser(buffer);
                                v.changed = value !== v.rawValue;
                                v.rawValue = value;
                            } catch (err) {
                                console.error(err);
                            }
                        });
                    }
                    resolve(vars);
                }, reason => {
                    reject(reason);
                });
            } else if (memoryAddress === ModbusMemoryAddress.HoldingRegisters) {          // Holding Registers (Read/Write  400001-465535)
                client.readHoldingRegisters(start, size).then( res => {
                    if (res.data) {
                        vars.map(v => {
                            let byteoffset = (v.offset - start) * 2;
                            let buffer = Buffer.from(res.buffer.slice(byteoffset, byteoffset + datatypes[v.type].bytes))
                            let value = datatypes[v.type].parser(buffer);
                            v.changed = value !== v.rawValue;
                            v.rawValue = value;
                        });
                    }
                    resolve(vars);
                }, reason => {
                    console.error(reason);
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
                    console.error(reason);
                    reject(reason);
                });
            } else if (memoryAddress === ModbusMemoryAddress.DigitalInputs) {           // Digital Inputs (Read 100001-165536)
                reject();
            } else if (memoryAddress === ModbusMemoryAddress.InputRegisters) {          // Input Registers (Read  300001-365536)
                reject();
            } else if (memoryAddress === ModbusMemoryAddress.HoldingRegisters) {        // Holding Registers (Read/Write  400001-465535)
                if (value.length > 2){
                    client.writeRegisters(start, value).then(res => {
                        resolve();
                    }, reason => {
                        console.error(reason);
                        reject(reason);
                    });
                } else {
                    client.writeRegister(start, value).then(res => {
                        resolve();
                    }, reason => {
                        console.error(reason);
                        reject(reason);
                    });
                }
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
    var _updateVarsValue = async (vars) => {
        var someval = false;
        var tempTags = {};
        for (var vid in vars) {
            let items = vars[vid];
            for (var itemidx in items) {
                const changed = items[itemidx].changed;
                if (items[itemidx] instanceof MemoryItem) {
                    let type = items[itemidx].type;
                    let rawValue = items[itemidx].rawValue;
                    let tags = items[itemidx].Tags;
                    tags.forEach(tag => {
                        tempTags[tag.id] = {
                            id: tag.id,
                            rawValue: convertValue(rawValue, tag.divisor),
                            type: type,
                            daq: tag.daq,
                            changed: changed,
                            tagref: tag
                        };
                        someval = true;
                    });
                } else {
                    tempTags[items[itemidx].id] = {
                        id: items[itemidx].id,
                        rawValue: items[itemidx].rawValue,
                        type: items[itemidx].type,
                        daq: items[itemidx].daq,
                        changed: changed,
                        tagref: items[itemidx]
                    };
                    someval = true;
                }
            }
        }
        if (someval) {
            const timestamp = new Date().getTime();
            var result = {};
            for (var id in tempTags) {
                if (!utils.isNullOrUndefined(tempTags[id].rawValue)) {
                    tempTags[id].value = await deviceUtils.tagValueCompose(tempTags[id].rawValue, varsValue[id] ? varsValue[id].value : null, tempTags[id].tagref, runtime);
                    tempTags[id].timestamp = timestamp;
                    if (this.addDaq && deviceUtils.tagDaqToSave(tempTags[id], timestamp)) {
                        result[id] = tempTags[id];
                    }
                }
                varsValue[id] = tempTags[id];
                varsValue[id].changed = false;
            }
            return result;
        }
        return null;
    }

    /**
     * Emit the PLC Tags values array { id: <name>, value: <value>, type: <type> }
     * @param {*} values
     */
    var _emitValues = function (values) {
        events.emit('device-value:changed', { id: data.id, values: values });
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
     * Used to manage the async connection and polling automation (that not overloading)
     * @param {*} check
     */
    var _checkWorking = function (check) {
        if (check && working) {
            overloading++;
            // !The driver don't give the break connection
            if (overloading >= 3) {
                if (type !== ModbusTypes.RTU) {
                    logger.warn(`'${data.name}' working (connection || polling) overload! ${overloading}`);
                }
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
    const getMemoryAddress = function(address, askey, token) {
        if (address < ModbusMemoryAddress.DigitalInputs) {
            if (askey) {
                return formatAddress('000000', token);
            }
            return ModbusMemoryAddress.CoilStatus;
        } else if (address < ModbusMemoryAddress.InputRegisters) {
            if (askey) {
                return formatAddress(ModbusMemoryAddress.DigitalInputs, token);
            }
            return ModbusMemoryAddress.DigitalInputs;
        } else if (address < ModbusMemoryAddress.HoldingRegisters) {
            if (askey) {
                return formatAddress(ModbusMemoryAddress.InputRegisters, token);
            }
            return ModbusMemoryAddress.InputRegisters;
        } else {
            if (askey) {
                return formatAddress(ModbusMemoryAddress.HoldingRegisters, token);
            }
            return ModbusMemoryAddress.HoldingRegisters;
        }
    }
    const convertValue = function (value, divisor, tosrc = false) {
        try {
            if (divisor && parseFloat(divisor)) {
                if (tosrc) {
                    return value * parseFloat(divisor);
                } else {
                    return value / parseFloat(divisor);
                }
            }
        } catch (err) {
            console.error(err);
        }
        return value;
    }

    /**
     * Return the Items that are wit address and size in the range start, size
     * @param {*} items
     * @param {*} start
     * @param {*} size
     * @returns
     */
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
const ModbusOptionType = {
    SerialPort: 'SerialPort',
    RTUBufferedPort: 'RTUBufferedPort',
    AsciiPort: 'AsciiPort',
    TcpPort: 'TcpPort',
    UdpPort: 'UdpPort',
    TcpRTUBufferedPort: 'TcpRTUBufferedPort',
    TelnetPort: 'TelnetPort'
}
const ModbusReuseModeType = {
    Reuse: 'Reuse',
    ReuseSerial: 'ReuseSerial',
}

module.exports = {
    init: function (settings) {
        // deviceCloseTimeout = settings.deviceCloseTimeout || 15000;
    },
    create: function (data, logger, events, manager, runtime) {
        try { ModbusRTU = require('modbus-serial'); } catch { }
        if (!ModbusRTU && manager) { try { ModbusRTU = manager.require('modbus-serial'); } catch { } }
        if (!ModbusRTU) return null;
        return new MODBUSclient(data, logger, events, runtime);
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
