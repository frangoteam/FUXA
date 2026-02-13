/**
 * 'modbus': modbus wrapper to communicate with PLC through RTU/TCP
 */

'use strict';
var ModbusRTU;
const datatypes = require('./datatypes');
const utils = require('../../utils');
const deviceUtils = require('../device-utils');
const net = require("net");
const TOKEN_LIMIT = 100;

function MODBUSclient(_data, _logger, _events, _runtime) {
    var memory = {};                        // Loaded Signal grouped by memory { memory index, start, size, ... }
    var data = JSON.parse(JSON.stringify(_data));                   // Current Device data { id, name, tags, enabled, ... }
    var logger = _logger;
    var client = null;                  // [Modified] Initialized to null, assigned after connection
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
     * initialize the modbus type
     */
    this.init = function (_type) {
        type = _type;
    }

    /**
     * Connect to PLC
     * Emit connection status to clients, clear all Tags values
     */
    this.connect = function () {
        return new Promise(async function (resolve, reject) {
            if (data.property && data.property.address && (type === ModbusTypes.TCP ||
                (type === ModbusTypes.RTU && data.property.baudrate && data.property.databits && data.property.stopbits && data.property.parity))) {
                try {
                    // [Modified] Logic to check if client exists
                    if ((!client || !client.isOpen) && _checkWorking(true)) {
                        logger.info(`'${data.name}' try to connect ${data.property.address}`, true);
                        
                        // [Added] RTU branching logic
                        if (type === ModbusTypes.RTU) {
                            try {
                                // the same logic as TCP
                                if(client){
                                    connectionManager.releaseRtuClient(data.property);
                                    client = null;
                                }

                                client = await connectionManager.getRtuClient(data.property);                                
                                logger.info(`'${data.name}' connected (RTU Shared)!`, true);
                                _emitStatus('connect-ok');
                                resolve();
                            } catch (err) {
                                logger.error(`'${data.name}' connect failed! ${err}`);
                                _emitStatus('connect-error');
                                reject();
                            }
                            _checkWorking(false);
                            return;
                        }

                        // 2. TCP Mode
                        // [Added] Check for ReuseSerial mode
                        if (data.property.socketReuse === 'ReuseSerial') {
                            try {
                                //If the client already exists (which means this is a reconnection), release the old reference count first.
                                if(client){
                                    //do not use await , just for decrementing the counter
                                    connectionManager.releaseTcpClient(data.property);
                                    client = null;
                                }

                                // Request shared client from Manager
                                client = await connectionManager.getTcpClient(data.property);
                                logger.info(`'${data.name}' connected (TCP Shared)!`, true);
                                _emitStatus('connect-ok');
                                resolve();
                            } catch (err) {
                                logger.error(`'${data.name}' connect failed (Shared): ${err}`);
                                _emitStatus('connect-error');
                                reject();
                            }
                            _checkWorking(false);
                            return;
                        }

                        // 3. Standard TCP Mode
                        // [Reserved] Original TCP connection logic
                        client = new ModbusRTU();
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

                                // Safety check: Ensure the underlying internal socket instance exists to avoid crashes
                                if (client._client && client._client.socket) {
                                    // Increase the maximum number of event listeners (default is 10)
                                    // This suppresses 'MaxListenersExceededWarning' when multiple devices/tags 
                                    // attach error handlers to the same shared socket connection
                                    client._client.socket.setMaxListeners(30);
                                }
                                
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
        return new Promise(async function (resolve, reject) {
            _checkWorking(false);
            
            // [Added] RTU resource release
            if (type === ModbusTypes.RTU) {
                await connectionManager.releaseRtuClient(data.property);                
                _emitStatus('connect-off');
                _clearVarsValue();
                resolve(true);
                return;
            }

            // 2. TCP Shared Release (ReuseSerial)
            if (data.property.socketReuse === 'ReuseSerial') {
                // Decrement refCount, close if needed
                await connectionManager.releaseTcpClient(data.property);
                _emitStatus('connect-off');
                _clearVarsValue();
                resolve(true);
                return;
            }

            // 3. Standard TCP Close
            if (!client || !client.isOpen) {
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
        
        try {
            // [Added] Check if TCP device should be skipped
            if (type === ModbusTypes.TCP && connectionManager.shouldSkipTcpDevice(data.id)) {
                const skipInfo = connectionManager.getTcpSkipInfo(data.id);
                logger.info(
                    `'${data.name}' temporarily skipped (state: ${skipInfo.state}, retry in ${skipInfo.skipRemaining}s)`
                );
                return;
            }

            // [Added] Check if TCP connection is closed and attempt reconnect
            if (type === ModbusTypes.TCP && (!client || !client.isOpen)) {
                logger.warn(`'${data.name}' TCP connection closed, attempting to reconnect...`);
                try {
                    await this.connect();
                    logger.info(`'${data.name}' TCP reconnected successfully`, true);
                } catch (err) {
                    logger.error(`'${data.name}' TCP reconnection failed: ${err}`);
                    _emitStatus('connect-error');
                    return; // Skip this polling cycle
                }
            }

            await this._polling()

        } catch (err) {
            logger.error(`'${data.name}' polling! ${err}`);            
        } 
    }
    this._polling = async function () {
        if (_checkWorking(true)) {
            var readVarsfnc = [];
            if (!data.property.options) {
                for (var memaddr in memory) {
                    var tokenizedAddress = parseAddress(memaddr);
                    // [Fixed] Don't use await here - let promises settle in Promise.allSettled
                    // This allows multiple slaves to fail without blocking the queue
                    readVarsfnc.push(
                        _readMemory(parseInt(tokenizedAddress.address), memory[memaddr].Start, memory[memaddr].MaxSize, Object.values(memory[memaddr].Items))
                            .catch(err => {
                                logger.error(`'${data.name}' _readMemory error at ${memaddr}! ${err.message || err}`);
                                return []; // Return empty array on error so Promise.allSettled can continue
                            })
                    );
                    readVarsfnc.push(delay(data.property.delay || 10));
                }
            } else {
                for (var memaddr in mixItemsMap) {
                    // [Fixed] Don't use await here - let promises settle in Promise.allSettled
                    readVarsfnc.push(
                        _readMemory(getMemoryAddress(parseInt(memaddr), false), mixItemsMap[memaddr].Start, mixItemsMap[memaddr].MaxSize, Object.values(mixItemsMap[memaddr].Items))
                            .catch(err => {
                                logger.error(`'${data.name}' _readMemory error at ${memaddr}! ${err.message || err}`);
                                return []; // Return empty array on error so Promise.allSettled can continue
                            })
                    );
                    readVarsfnc.push(delay(data.property.delay || 10));
                }
            }
            // _checkWorking(false);
            try {
                // [Fixed] Use allSettled instead of all to handle multiple slave failures
                // allSettled never rejects - it waits for all promises to complete
                const results = await Promise.allSettled(readVarsfnc);
                // Extract successful results (status === 'fulfilled')
                const result = results
                    .filter(r => r.status === 'fulfilled')
                    .map(r => r.value);
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
                stepsMap[parseInt(data.tags[id].memaddress) + offset] = { size: datatypes[data.tags[id].type].WordLen, offset: offset };
            } catch (err) {
                logger.error(`'${data.name}' load error! ${err}`);
            }
        }
        // for fragmented
        let lastStart = -1;             // last start address
        let lastMemAdr = -1;
        let nextAdr = -1;
        Object.keys(stepsMap).sort((a, b) => { return a - b; }).forEach(function (key) {
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
            return { id: id, value: varsValue[id].value, ts: lastTimestampValue };
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
                const script = {
                    id: data.tags[sigid].scaleWriteFunction,
                    name: null,
                    parameters
                };
                try {
                    const bufVal = await runtime.scriptsMgr.runScript(script, false);
                    if (Array.isArray(bufVal)) {
                        if ((bufVal.length % 2) !== 0) {
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

            try {
                _checkWorking(true);

                await _writeMemory(parseInt(memaddr), offset, val).then(result => {
                    logger.info(`'${data.name}' setValue(${sigid}, ${value})`, true, true);
                }, reason => {
                    if (reason && reason.stack) {
                        logger.error(`'${data.name}' _writeMemory error! ${reason.stack}`);
                    } else {
                        logger.error(`'${data.name}' _writeMemory error! ${reason}`);
                    }
                });
            } catch (err) {
                logger.error(`'${data.name}' setValue error! ${err}`);
            } finally {
                _checkWorking(false);                
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
        return client && client.isOpen;
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
    var _connect = function (callback) {
        try {           
            if (type === ModbusTypes.TCP) {
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
                    if (data.property.socketReuse) {
                        client.linkTcpRTUBuffered(runtime.socketPool.get(data.property.address), callback);
                    } else {
                        client.connectTcpRTUBuffered(addr, { port: port }, callback);
                    }
                } else if (data.property.connectionOption === ModbusOptionType.TelnetPort) {
                    if (data.property.socketReuse) {
                        client.linkTelnet(runtime.socketPool.get(data.property.address), callback);
                    } else {
                        client.connectTelnet(addr, { port: port }, callback);
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
            // [Modified] Wrap all client.read... calls in _execute
            
            if (memoryAddress === ModbusMemoryAddress.CoilStatus) {                      // Coil Status (Read/Write 000001-065536)
                _execute(c => c.readCoils(start, size)).then(res => {
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
                }, reason => reject(reason));
            } else if (memoryAddress === ModbusMemoryAddress.DigitalInputs) {          // Digital Inputs (Read 100001-165536)
                _execute(c => c.readDiscreteInputs(start, size)).then(res => {
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
                }, reason => reject(reason));
            } else if (memoryAddress === ModbusMemoryAddress.InputRegisters) {          // Input Registers (Read  300001-365536)
                _execute(c => c.readInputRegisters(start, size)).then(res => {
                    if (res.data) {
                        vars.map(v => {
                            try {
                                let byteoffset = (v.offset - start) * 2;
                                let buffer = Buffer.from(res.buffer.slice(byteoffset, byteoffset + datatypes[v.type].bytes))
                                let value = datatypes[v.type].parser(buffer);
                                v.changed = value !== v.rawValue;
                                v.rawValue = value;
                            } catch (err) { console.error(err); }
                        });
                    }
                    resolve(vars);
                }, reason => reject(reason));
            } else if (memoryAddress === ModbusMemoryAddress.HoldingRegisters) {          // Holding Registers (Read/Write  400001-465535)
                _execute(c => c.readHoldingRegisters(start, size)).then(res => {
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
            // [Modified] Wrap all client.write... calls in _execute
            if (memoryAddress === ModbusMemoryAddress.CoilStatus) {                      // Coil Status (Read/Write 000001-065536)
                _execute(c => c.writeCoil(start, value)).then(res => {
                    resolve();
                }, reason => {
                    console.error(reason);
                    reject(reason);
                });
            } else if (memoryAddress === ModbusMemoryAddress.DigitalInputs) {           // Digital Inputs (Read 100001-165536)
                reject();
            } else if (memoryAddress === ModbusMemoryAddress.InputRegisters) {          // Input Registers (Read  300001-365536)
                reject();
            } else if (memoryAddress === ModbusMemoryAddress.HoldingRegisters) {
                // Utiliser forceFC16 depuis la config du device
                if (value.length > 2 || data.property.forceFC16) {
                    _execute(c => c.writeRegisters(start, value)).then(res => {
                        resolve();
                    }, reason => {
                        console.error(reason);
                        reject(reason);
                    });
                } else {
                    _execute(c => c.writeRegister(start, value)).then(res => {
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
     * Used to manage the async connection and polling automation (prevent overloading)
     * [Fixed] Simplified logic - with proper timeout and skip mechanisms in place,
     * we don't need aggressive overload protection that closes ports
     * @param {*} check
     */
    var _checkWorking = function (check) {
        if (check && working) {
            overloading++;
            
            // [Fixed] Different handling for RTU vs TCP
            if (type === ModbusTypes.RTU) {
                // For RTU: NEVER close the port due to overload
                // The port is shared and managed by RTUManager
                // Just log if severely overloaded
                if (overloading >= 20) {
                    logger.warn(`'${data.name}' RTU severe polling overload (${overloading}), check polling interval`);
                    // Reset to prevent spam
                    overloading = 0;
                }
                return false; // Indicate overload but don't break
            } else {
                // For TCP: More lenient threshold before closing
                if (overloading >= 10) {
                    logger.warn(`'${data.name}' TCP working overload! ${overloading} - closing connection`);
                    if (client && typeof client.close === 'function') {
                        try {
                            client.close();
                        } catch (err) {
                            logger.error(`'${data.name}' error closing overloaded connection: ${err}`);
                        }
                    }
                } else {
                    return false;
                }
            }
        }
        working = check;
        overloading = 0;
        return true;
    }

    // [Added] Internal helper: Unified read/write execution (RTU uses queue / TCP executes directly)
    // Moved to bottom to preserve function order in diffs
    var _execute = function(action) {
        if (type === ModbusTypes.RTU) {
            return connectionManager.executeRtu(data, action);
        } else {
            // TCP (Direct or ReuseSerial)
            // Delegate completely to ConnectionManager
            // It handles Queueing (if ReuseSerial), Timeout, and Error Recording
            // Pass the whole data object so Manager can access id, property.socketReuse, etc.
            return connectionManager.executeTcp(client, data, action);
        }
    }

    const formatAddress = function (address, token) { return token + '-' + address; }
    const parseAddress = function (address) { return { token: address.split('-')[0], address: address.split('-')[1] }; }
    const getMemoryAddress = function (address, askey, token) {
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
     * Return the Items that are with address and size in the range start, size
     * @param {*} items
     * @param {*} start
     * @param {*} size
     * @returns
     */
    const getMemoryItems = function (items, start, size) {
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

/**
 * Unified Connection Manager for both RTU and TCP
 * Refactored: Merged common logic for resource pooling and error state management.
 */
class ConnectionManager {
    constructor() {
        // Resource Pools
        this.rtuPorts = {}; // { key: { client, queue, refCount, config, isConnecting } }
        this.tcpPorts = {}; // { key: { client, queue, refCount, config, isConnecting, connectAction } }

        // Error Tracking Maps
        this.rtuSlaveErrors = {};  // { 'COM1_9600_Slave1': { count, state, skipUntil... } }
        this.tcpDeviceErrors = {}; // { 'device_id': { count, state, skipUntil... } }
        
        // Promise Locks (prevent race conditions)
        this.rtuConnecting = {};
        this.tcpConnecting = {};

        // Skip State Configuration
        this.skipStates = {
            timeout:    { name: 'timeout',    duration: 10000, maxErrors: 3, nextState: 'fault' },
            fault:      { name: 'fault',      duration: 30000, maxErrors: 3, nextState: 'disconnect' },
            disconnect: { name: 'disconnect', duration: 60000, maxErrors: 3, nextState: null }
        };
    }

    configure(options = {}) {
        if (options.skipStates) {
            ['timeout', 'fault', 'disconnect'].forEach(state => {
                if (options.skipStates[state]) {
                    this.skipStates[state].duration = options.skipStates[state].duration || this.skipStates[state].duration;
                    this.skipStates[state].maxErrors = options.skipStates[state].maxErrors || this.skipStates[state].maxErrors;
                }
            });
        }
        console.info('Connection Manager configured.');
    }

    // ==========================================
    // [Generic] Helper Methods (The Core Logic)
    // ==========================================

    /**
     * Generic resource acquirer with Promise Caching to prevent race conditions.
     */
    async _getSharedClient(key, portsMap, connectingMap, config, connectFn) {
        // 1. Fast Path: Return existing
        if (portsMap[key]) {
            const portObj = portsMap[key];

            //Check the connection status. If it’s disconnected, it must be repaired 
            if (!portObj.client.isOpen) {
                console.warn(`'${key}' Shared client found but closed. Attempting to recover...`);
                
                // Case A: Another device (or polling loop) is already reconnecting , need to wait
                if (portObj.isConnecting) {
                    let retries = 0;
                    while (portObj.isConnecting && retries < 50) { // Wait up to 5 seconds
                        await new Promise(r => setTimeout(r, 100));
                        retries++;
                    }
                    // After waiting, if the connection is successful, return the client
                    if (portObj.client.isOpen) {
                        portObj.refCount++;
                        return portObj.client;
                    }
                }
                
                // Case B: No one is handling it, or still fails after waiting , trigger a reconnect
                // Double check to ensure we don't start parallel reconnection
                if (!portObj.client.isOpen && !portObj.isConnecting) {
                     portObj.isConnecting = true;
                     try {
                         // Ensure the old socket is closed
                         try { 
                             await portObj.client.close(); 
                         } catch(e) {}
                         
                         // Run the connection function (establish a completely new connection)
                         const newClient = await connectFn(); 
                         
                         // Update the shared object with the new client reference
                         portObj.client = newClient;
                         portObj.isConnecting = false;
                         console.info(`'${key}' Shared connection recovered successfully.`);
                     } catch (err) {
                         portObj.isConnecting = false;
                         console.error(`'${key}' Recovery failed: ${err.message}`);
                         // If the connection fails, throw the error so the outer MODBUSclient knows
                         throw err;
                     }
                }
                // Confirm the connection is active (or just repaired), increase reference count and return it
                if (portObj.client.isOpen) {
                    portObj.refCount++;
                    return portObj.client;
                } else {
                    throw new Error(`Failed to recover shared connection for '${key}'`);
                }
            }
            portsMap[key].refCount++;
            return portsMap[key].client;
        }

        // 2. Wait for pending connection
        if (connectingMap[key]) {
            await connectingMap[key];
            if (portsMap[key]) {
                portsMap[key].refCount++;
                return portsMap[key].client;
            }
            throw new Error(`Connection wait failed for ${key}`);
        }

        // 3. Initiate Connection (Locked)
        connectingMap[key] = (async () => {
            try {
                // Execute the specific connection logic
                const client = await connectFn();
                client.setTimeout(2000);

                // Store in pool
                portsMap[key] = {
                    client: client,
                    queue: Promise.resolve(),
                    refCount: 0, // Will be incremented after return
                    config: config,
                    isConnecting: false,
                    connectAction: connectFn // Store for reconnection usage
                };
                console.info(`'${key}' Shared Connection created`);
            } catch (err) {
                console.error(`'${key}' Connection failed: ${err.message}`);
                throw err;
            } finally {
                delete connectingMap[key];
            }
        })();

        // 4. Await result
        try {
            await connectingMap[key];
        } catch (e) {
            throw e; 
        }

        // 5. Final Return
        if (portsMap[key]) {
            portsMap[key].refCount++;
            return portsMap[key].client;
        }
        throw new Error('Unexpected connection failure');
    }

    /**
     * Generic Skip Logic
     */
    _shouldSkip(errorMap, key) {
        const errorInfo = errorMap[key];
        if (!errorInfo) return false;

        // Check if currently skipped
        if (errorInfo.skipUntil && Date.now() < errorInfo.skipUntil) {
            return true;
        }

        // Skip period expired, reset
        if (errorInfo.skipUntil && Date.now() >= errorInfo.skipUntil) {
            console.info(`'${key}' retry after skip period (state: ${errorInfo.state}, count reset to 0)`);
            errorInfo.count = 0;
            errorInfo.skipUntil = null;
            return false;
        }
        return false;
    }

    /**
     * Generic Error Recording & State Transition
     */
    _recordError(errorMap, key, error) {
        if (!errorMap[key]) {
            errorMap[key] = {
                count: 0,
                state: 'timeout',
                lastError: null,
                skipUntil: null,
                stateEnteredAt: Date.now()
            };
        }

        const errorInfo = errorMap[key];
        errorInfo.count++;
        errorInfo.lastError = error.message || error;

        const currentState = this.skipStates[errorInfo.state];
        
        // State escalation
        if (errorInfo.count >= currentState.maxErrors) {
            const skipDuration = currentState.duration;
            errorInfo.skipUntil = Date.now() + skipDuration;

            if (currentState.nextState) {
                const previousState = errorInfo.state;
                errorInfo.state = currentState.nextState;
                errorInfo.count = 0;
                errorInfo.stateEnteredAt = Date.now();
                console.warn(`'${key}' escalated: ${previousState} -> ${errorInfo.state}. Skip ${skipDuration/1000}s`);
            } else {
                
                console.warn(`'${key}' state '${errorInfo.state}': Skip ${skipDuration/1000}s`);
            }
        }
    }

    /**
     * Generic Success Recovery
     */
    _recordSuccess(errorMap, key) {
        if (errorMap[key]) {
            console.info(`'${key}' recovered from error state.`);
            delete errorMap[key];
        }
    }

    // ==========================================
    // RTU Specific Implementation
    // ==========================================
    
    getRtuKey(config) {
        return config.address + '_' + config.baudrate + '_' + config.parity;
    }
    
    getRtuSlaveKey(config, slaveId) {
        return this.getRtuKey(config) + '_Slave' + slaveId;
    }

    async getRtuClient(config) {
        const key = this.getRtuKey(config);
        
        // Define RTU specific connection logic
        const connectFn = async () => {
            const client = new ModbusRTU();
            const options = {
                baudRate: parseInt(config.baudrate),
                dataBits: parseInt(config.databits),
                stopBits: parseFloat(config.stopbits),
                parity: config.parity
            };
            if (config.connectionOption === ModbusOptionType.RTUBufferedPort) {
                await client.connectRTUBuffered(config.address, options);
            } else if (config.connectionOption === ModbusOptionType.AsciiPort) {
                await client.connectAsciiSerial(config.address, options);
            } else {
                await client.connectRTU(config.address, options);
            }
            return client;
        };

        return this._getSharedClient(key, this.rtuPorts, this.rtuConnecting, config, connectFn);
    }

    async releaseRtuClient(config) {
        const key = this.getRtuKey(config);
        if (this.rtuPorts[key]) {
            this.rtuPorts[key].refCount--;
            if (this.rtuPorts[key].refCount <= 0) {
                if (this.rtuPorts[key].client.isOpen) {
                    console.info(`'${key}' disconnect`);
                    this.rtuPorts[key].client.close();
                }
                delete this.rtuPorts[key];
            }
        }
    }

    async ensureRtuConnection(key) {
        const portObj = this.rtuPorts[key];
        if (!portObj) return false;
        try { if (portObj.client.isOpen) return true; } catch (e) {}

        if (!portObj.isConnecting) {
            portObj.isConnecting = true;
            try {
                console.warn(`'${key}' RTU reconnecting...`);
                try { 
                    if (portObj.client._port) await portObj.client.close(); 
                } catch (e) {}
                await new Promise(r => setTimeout(r, 100));
                
                // Re-execute stored connection action
                const newClient = await portObj.connectAction();
                portObj.client = newClient; // Replace client
                
                console.info(`'${key}' RTU reconnected`);
                portObj.isConnecting = false;
                return true;
            } catch (err) {
                console.error(`'${key}' RTU reconnect failed: ${err.message}`);
                portObj.isConnecting = false;
                await new Promise(r => setTimeout(r, 1000));
                return false;
            }
        }
        return false;
    }

    // Wrappers for RTU Error/Skip
    shouldSkipRtuSlave(config, slaveId) {
        return this._shouldSkip(this.rtuSlaveErrors, this.getRtuSlaveKey(config, slaveId));
    }
    recordRtuSlaveError(config, slaveId, error) {
        this._recordError(this.rtuSlaveErrors, this.getRtuSlaveKey(config, slaveId), error);
    }
    recordRtuSlaveSuccess(config, slaveId) {
        this._recordSuccess(this.rtuSlaveErrors, this.getRtuSlaveKey(config, slaveId));
    }

    async executeRtu(deviceData, action, timeout = 2000) {
        const options = deviceData.property || {};
        const key = this.getRtuKey(options);
        const portObj = this.rtuPorts[key];
        timeout = options.rtuTimeout || timeout;
        const slaveId = parseInt(options.slaveid) || 1;

        if (!portObj) return Promise.reject('Port not connected');
        
        if (this.shouldSkipRtuSlave(options, slaveId)) {
            const errorInfo = this.rtuSlaveErrors[this.getRtuSlaveKey(options, slaveId)];
            const skipRemaining = Math.ceil((errorInfo.skipUntil - Date.now()) / 1000);
            return Promise.reject(new Error(`RTU SlaveID ${slaveId} skipped (state: ${errorInfo.state}, retry: ${skipRemaining}s)`));
        }

        const result = portObj.queue.then(async () => {
            try {
                const isConnected = await this.ensureRtuConnection(key);
                if (!isConnected) throw new Error('Port not open');

                const operationPromise = (async () => {
                    await portObj.client.setID(slaveId);
                    const res = await action(portObj.client);
                    await new Promise(r => setTimeout(r, 20));
                    return res;
                })();

                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error(`Timeout SlaveID ${slaveId}`)), 2000);
                });

                const res = await Promise.race([operationPromise, timeoutPromise]);
                this.recordRtuSlaveSuccess(options, slaveId);
                return res;
            } catch (err) {
                this.recordRtuSlaveError(options, slaveId, err);
                throw err;
            }
        });
        
        portObj.queue = result.catch(() => {});
        return result;
    }

    // ==========================================
    // TCP Specific Implementation
    // ==========================================

    getTcpKey(config) {
        let address = config.address;
        let port = 502;
        if (address.indexOf(':') !== -1) {
            const parts = address.split(':');
            address = parts[0];
            port = parseInt(parts[1]);
        } else if (config.port) {
            port = parseInt(config.port);
        }
        return `${address}:${port}`;
    }

    async getTcpClient(config) {
        const key = this.getTcpKey(config);

        // Define TCP specific connection logic
        const connectFn = async () => {
            const client = new ModbusRTU();
            const [ip, portStr] = key.split(':');
            const port = parseInt(portStr);
            const options = { port: port };
            
            if (config.connectionOption === ModbusOptionType.TcpRTUBufferedPort) {
                await client.connectTcpRTUBuffered(ip, options);
            } else if (config.connectionOption === ModbusOptionType.TelnetPort) {
                await client.connectTelnet(ip, options);
            } else {
                await client.connectTCP(ip, options);
            }

            // Enable KeepAlive
            if (client._client && client._client.socket) {
                client._client.socket.setKeepAlive(true, 5000);
                client._client.socket.setNoDelay(true);
            }
            return client;
        };

        return this._getSharedClient(key, this.tcpPorts, this.tcpConnecting, config, connectFn);
    }

    async releaseTcpClient(config) {
        const key = this.getTcpKey(config);
        if (this.tcpPorts[key]) {
            this.tcpPorts[key].refCount--;
            if (this.tcpPorts[key].refCount <= 0) {
                if (this.tcpPorts[key].client.isOpen) {
                    console.info(`'${key}' TCP disconnect (Ref=0)`);
                    this.tcpPorts[key].client.close();
                }
                delete this.tcpPorts[key];
            }
        }
    }

    async ensureTcpConnection(key) {
        const portObj = this.tcpPorts[key];
        if (!portObj) return false;
        if (portObj.client.isOpen) return true;

        if (!portObj.isConnecting) {
            portObj.isConnecting = true;
            console.warn(`'${key}' TCP reconnecting...`);
            try {
                try { 
                    await portObj.client.close(); 
                } catch (e) {}
                await new Promise(r => setTimeout(r, 500));
                
                // Re-execute stored connection action
                const newClient = await portObj.connectAction();
                portObj.client = newClient; // Replace client (IMPORTANT: Update the object ref)

                console.info(`'${key}' TCP reconnected`);
                portObj.isConnecting = false;
                return true;
            } catch (err) {
                console.error(`'${key}' TCP reconnect failed: ${err.message}`);
                portObj.isConnecting = false;
                await new Promise(r => setTimeout(r, 1000));
                return false;
            }
        }
        return false;
    }

    // Wrappers for TCP Error/Skip
    shouldSkipTcpDevice(deviceId) {
        return this._shouldSkip(this.tcpDeviceErrors, deviceId);
    }
    recordTcpDeviceError(deviceId, error) {
        this._recordError(this.tcpDeviceErrors, deviceId, error);
    }
    recordTcpDeviceSuccess(deviceId) {
        this._recordSuccess(this.tcpDeviceErrors, deviceId);
    }
    getTcpSkipInfo(deviceId) {
        const errorInfo = this.tcpDeviceErrors[deviceId];
        if (!errorInfo || !errorInfo.skipUntil) return null;
        return {
            state: errorInfo.state,
            skipRemaining: Math.ceil((errorInfo.skipUntil - Date.now()) / 1000)
        };
    }

    async executeTcp(client, deviceData, action, timeout = 2000) {
        const deviceId = deviceData.id;
        const options = deviceData.property || {};
        const isReuseSerial = options.socketReuse === 'ReuseSerial';
        const key = this.getTcpKey(options);
        timeout = options.tcpTimeout || timeout;

        if (this.shouldSkipTcpDevice(deviceId)) {
            const errorInfo = this.tcpDeviceErrors[deviceId];
            const skipRemaining = Math.ceil((errorInfo.skipUntil - Date.now()) / 1000);
            return Promise.reject(new Error(`TCP device '${deviceId}' skipped (state: ${errorInfo.state}, retry: ${skipRemaining}s)`));
        }

        const runOperation = async (targetClient) => {
            try {
                const operationPromise = (async () => {
                    if (options.slaveid) await targetClient.setID(parseInt(options.slaveid));
                    const res = await action(targetClient);
                    if (isReuseSerial) await new Promise(r => setTimeout(r, 20));
                    return res;
                })();

                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error(`TCP timeout ${timeout}ms`)), timeout);
                });

                const result = await Promise.race([operationPromise, timeoutPromise]);
                this.recordTcpDeviceSuccess(deviceId);
                return result;
            } catch (err) {
                this.recordTcpDeviceError(deviceId, err);
                const errorInfo = this.tcpDeviceErrors[deviceId];
                
                // Hard Error Checks
                const isFatalError = err.code === 'EPIPE' || err.code === 'ECONNRESET' || 
                                     err.code === 'ECONNREFUSED' || err.message.includes('This socket is closed');
                
                // Zombie Connection Check
                let isZombieConnection = (errorInfo && errorInfo.state === 'disconnect' && errorInfo.count >= 3);

                if (isFatalError || isZombieConnection) {
                    const reason = isFatalError ? `Fatal(${err.code})` : `Zombie(Count>=3)`;
                    console.warn(`TCP Device '${deviceId}' reset. Reason: ${reason}`);
                    if (targetClient) {
                        try { targetClient.close(); } catch(e) {}
                        if (isReuseSerial && this.tcpPorts[key]) {
                             try { this.tcpPorts[key].client._client.destroy(); } catch(e) {}
                        }
                    }

                    if(errorInfo){
                        errorInfo.count = 0;
                        console.info(`TCP Device '${deviceId}' error count reset to 0 after force close.`);
                    }
                }
                throw err;
            }
        };

        if (isReuseSerial) {
            const portObj = this.tcpPorts[key];
            if (!portObj) return Promise.reject(new Error(`Shared TCP '${key}' not found`));
            
            const result = portObj.queue.then(async () => {
                const isConnected = await this.ensureTcpConnection(key);
                if (!isConnected) throw new Error('TCP Reconnect Failed');
                return runOperation(portObj.client); // Use client from portObj (may be updated)
            });
            portObj.queue = result.catch(() => {});
            return result;
        } else {
            return runOperation(client);
        }
    }
}

// Global instance
const connectionManager = new ConnectionManager();

