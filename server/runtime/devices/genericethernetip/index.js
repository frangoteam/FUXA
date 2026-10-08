/**
 * 'genericethernetip': uses st-ethernet-ip to communicate with generic ethernet-ip devices using
 * explicit and implicit messaging.  Also provides Browse functionality to list found ethernet-ip 
 * devices on the local network.
 */

'use strict';
var STEthernetIp;
const utils = require('../../utils');
const deviceUtils = require('../device-utils');

const EnipTagType = {//EnipTagDataSourceType
    symbolic: 0,
    explicit: 1,
    assemblyIO: 2
}
const EnipIODataType = {
    bit: 0,
    integer16: 1
}
const EnipTypes = {
    BOOL: 0xc1,
    SINT: 0xc2,
    INT: 0xc3,
    DINT: 0xc4,
    LINT: 0xc5,
    USINT: 0xc6,
    UINT: 0xc7,
    UDINT: 0xc8,
    REAL: 0xca,
    LREAL: 0xcb,
    STIME: 0xcc,
    DATE: 0xcd,
    TIME_AND_DAY: 0xce,
    DATE_AND_STRING: 0xcf,
    STRING: 0xd0,
    WORD: 0xd1,
    DWORD: 0xd2,
    BIT_STRING: 0xd3,
    LWORD: 0xd4,
    STRING2: 0xd5,
    FTIME: 0xd6,
    LTIME: 0xd7,
    ITIME: 0xd8,
    STRINGN: 0xd9,
    SHORT_STRING: 0xda,
    TIME: 0xdb,
    EPATH: 0xdc,
    ENGUNIT: 0xdd,
    STRINGI: 0xde,
    STRUCT: 0x02a0
};
var globalIOScanner = undefined; //shared by all Ethernet/IP devices
function GenericEthernetIPclient(_data, _logger, _events, _runtime) {

    var runtime = _runtime;
    var deviceType = 'EthernetIPclient';
    var device = JSON.parse(JSON.stringify(_data)); // Current Device data { id, name, tags, enabled, ... }
    var tagMemoryTable = []; //Buffers indexed by tag id, mirrors memory on device
    var logger = _logger;
    var events = _events;               // Events to commit change to runtime
    var lastStatus = '';                // Last Device status     
    var working = false;                // Working flag to manage overloading polling and connection
    var conn;// = new STEthernetIp.Controller();  // connection for explicit and symbolic messaging
    //var globalIOScanner;                      // Connection Manager for IO exchange
    var ioconnections = [];             //  IO connections
    var numberOfIOScannersWaitingToConnect = 0;
    var connectionAttempts = 5;
    var doneReading = false;
    var doneWriting = false;
    var overloading = 0;                // Overloading counter to mange the break connection
    var connected = false;              // Connected flag
    var ioconnected = false;
    var itemsMap = {};                  // Items Mapped Tag name with Item path to find for set value
    var varsValue = {};                 // Values indexed by FUXA tag id
    var lastTimestampValue;             // Last Timestamp of asked values
    var connSupportsTagGroup = true;    // first polling with try group read, if fails, will try single read per tag
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
            (async () => {
                try {
                    if (device.property && device.property.address) {
                        // console.log('in connect, calling checkWroking');
                        if (_checkWorking(true)) {
                            //console.log('in connect checkworking returned true');
                            logger.debug(`'${device.name}' try to connect ${device.property.address}`);
                            //logger.info(`'${device.name}' try to connect ${device.property.address}`, true);
                            await _connect();
                            connected = true;
                            logger.debug(`'${device.name}' connected!`);
                            //logger.info(`'${device.name}' connected!`, true);
                            _emitStatus('connect-ok');
                            _checkWorking(false);
                            return resolve();

                        } else {
                            logger.debug(`${device.name} in connect checkWorking returned false`);
                            _emitStatus('connect-error');
                            return reject();
                        }
                    } else {
                        logger.error(`'${device.name}' missing connection data!`);
                        _emitStatus('connect-failed');
                        _clearVarsValue();
                        return reject();
                    }
                } catch (err) {
                    logger.debug('caught async execption in connect');
                    logger.debug(err.toString());
                    // TODO add error lookup to string
                    logger.error(`'${device.name}' try to connect error! ${JSON.stringify(err)}`);
                    _checkWorking(false);
                    _emitStatus('connect-error');
                    _clearVarsValue();
                    return reject();
                }
            })()
        });
    }


    /**
     * Disconnect the device
     * Emit connection status to clients, clear all Tags values
     */
    this.disconnect = function () {
        logger.debug(`${device.name} disconnect external called`);
        return new Promise(function (resolve, reject) {
            (async () => {
                try {
                    await _disconnectAll();
                    resolve();
                } catch (error) {
                    logger.error(`'${device.name}' disconnect failure! ${error}`);
                    reject(error)

                }
                connected = false;
                _checkWorking(false);
                _emitStatus('connect-off');
                _clearVarsValue();
            })()
        });
    }

    /**
     * Read values in polling mode 
     * Update the tags values list, save in DAQ if value changed or in interval and emit values to clients
     */
    this.polling = async function () {
        //console.log('in polling, calling checkworking');
        if (_checkWorking(true, true)) {
            //console.log('polling: checkworking returned true enip device connected ' + conn?.established);
            // if (ioconnections?.length > 0) {
            //     for (const ioconn of ioconnections) {
            //         logger.debug('polling: ioconn connected ' + ioconn.connected);
            //     }
            // }
            if (conn && this.isConnected()) {
                try {
                    const result = await _readValues();
                    //console.log('calling checkWorking in after readValues in polling');
                    _checkWorking(false, true);
                    if (result && Object.keys(result).length > 0) {
                        let varsValueChanged = await _updateVarsValue(result);
                        lastTimestampValue = new Date().getTime();
                        _emitValues(varsValue);
                        if (this.addDaq && !utils.isEmptyObject(varsValueChanged)) {
                            this.addDaq(varsValueChanged, device.name, device.id);
                        }
                    } else {
                        // console.error('then error');
                    }
                } catch (err) {
                    logger.error(`'${device.name}' polling error: ${err}`);
                    const errstr = JSON.stringify(err);
                    logger.error(errstr);
                    //mark the connect as not connected, this will force a reconnect
                    //ideally the ethernet/ip plugin should mark itself not connected
                    //for now do it here.
                    const timeOutError = err.message?.constructor === String && err.message.startsWith('TIMEOUT');
                    if (conn?.established_conn && timeOutError) {
                        logger.info(`${device.name} lost connection, marking connection closed.  Should reconnect.`);
                        conn.established_conn = false;
                    }
                    _checkWorking(false, true);
                }
            } else {
                logger.debug(`${device.name} calling checkWorking in polling, not connected`);
                _checkWorking(false, true);
            }
        } else {
            logger.debug(`${device.name} in polling, checkworking returned false`);
        }
    }

    /**
     * Load Tags attribute to read with polling
     */
    this.load = function (_data) {
        varsValue = {};
        tagMemoryTable = [];
        device = JSON.parse(JSON.stringify(_data));
        try {
            itemsMap = {};
            var count = Object.keys(device.tags).length;
            for (var id in device.tags) {
                itemsMap[id] = device.tags[id];
            }
            logger.info(`'${device.name}' data loaded (${count})`, true);
        } catch (err) {
            logger.error(`'${device.name}' load error! ${err}`);
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
        if (device.tags[tagid]) {
            return { id: tagid, name: device.tags[tagid].name, type: device.tags[tagid].type, format: device.tags[tagid].format };
        } else {
            return null;
        }
    }

    /**
     * Set the Tag value to device
     * take the address from
     */
    this.setValue = async function (tagId, value) {
        if (device.tags[tagId]) {
            const tag = device.tags[tagId];
            const isStringTag = _isStringTag(tag);
            let valueToSend = isStringTag ? value : await deviceUtils.tagRawCalculator(value, tag, runtime);
            if (tag.enipOptions?.tagType === EnipTagType.symbolic &&
                (tag.enipOptions?.symbolicOpt.dataType === EnipTypes.BOOL)) {
                if (valueToSend === 'true') {
                    valueToSend = 1;
                } else if (valueToSend === 'false') {
                    valueToSend = 0;
                }
            }
        

            // io tag
            if (tag.enipOptions?.tagType === EnipTagType.assemblyIO) {
                // find connection associated with the tag
                for (const ioconn of ioconnections) {
                    if (tag.enipOptions?.ioOpt?.ioModuleId === ioconn.id &&
                        tag.enipOptions?.ioOpt?.ioOutput === true) { //output tag
                            ioconn.setValue(tagId, valueToSend);
                            return true;
                    }
                }
            }

            // explicit data
            if (tag.enipOptions?.tagType === EnipTagType.explicit) {
                                
                if (tag.enipOptions.explicitOpt?.class  === undefined ||
                    tag.enipOptions.explicitOpt?.instance === undefined ||
                    tag.enipOptions.explicitOpt?.attribute === undefined) {
                    
                    logger.error(`${device.name} '${tag.name}' Explicit tag definition missing class or instance or attribute`);
                    return false;

                }
                logger.debug(`${device.name} ${tag.name} setValue buffer: ${valueToSend}`);
                let strBuf = undefined;
                if ((value === undefined || value === null) && tag.enipOptions?.explicitOpt?.sendBuffer?.length > 0) {
                    strBuf = tag.enipOptions.explicitOpt.sendBuffer;
                } else if (typeof valueToSend === 'string') {
                    strBuf = valueToSend;
                }
                if (strBuf === undefined) {
                    logger.error(`${device.name} '${tag.name}' Ethernet/IP explicit tag value must be of type string (hex) to set value`);
                    return false;
                }
                
                const trimedVal = strBuf.replace(/\s/g, "");
                let valueBuf = undefined;
                try {
                    valueBuf = Buffer.from(trimedVal, 'hex');
                } catch (error) {
                    logger.error(`${device.name} '${tag.name}' error converting send buffer from hex ${error}`);
                    return false;
                }
                                
                conn?.setAttributeSingle(tag.enipOptions.explicitOpt.class,
                    tag.enipOptions.explicitOpt.instance,
                    tag.enipOptions.explicitOpt.attribute,
                    valueBuf).then(() => {
                        logger.debug(`${device.name} '${tag.name}' setValue ${strBuf} set`);
                    }).catch(error => {
                        logger.error(`${device.name} '${tag.name}' setValue error! ${JSON.stringify(error)}`);
                    }); 
                return true;
            }

            //symbolic
            if (tag.enipOptions?.tagType === EnipTagType.symbolic) {
                const enipTag = new STEthernetIp.Tag(device.tags[tagId].address,
                    tag.enipOptions?.symbolicOpt.program,
                    tag.enipOptions?.symbolicOpt.dataType
                );
                enipTag.value = valueToSend;
                conn.writeTag(enipTag).then(() => {
                    logger.debug(`${device.name} Sending value ${valueToSend}`);
                    //logger.info(`'${tag.name}' setValue(${tagId}, ${valueToSend})`, true, true);
                }).catch(error => {
                    logger.error(`${device.name} '${tag.name}' setValue error! ${error}`);
                }); 
                return true;
            }
        }
        return false;
    }

    /**
     * Return if device is connected
     */
    this.isConnected = function () {
        let allioconnected = true;
        for (const ioconn of ioconnections) {
          //  console.log('isConnected:: ioconn connected ' + ioconn.connected);
            allioconnected &&= ioconn.connected;
        }
       // console.log('isConnected:: conn.established ' + conn?.established);
        connected = conn?.established_conn && allioconnected;
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
        return device.tags[tagId] ? device.tags[tagId].daq : null;
    }

    /**
     * Set Daq settings of Tag
     * @returns 
     */
    this.setTagDaqSettings = (tagId, settings) => {
        if (device.tags[tagId]) {
            utils.mergeObjectsValues(device.tags[tagId].daq, settings);
        }
    }
    this.browseForDevices = function (path, callback) {
        return new Promise(function (resolve, reject) {
            (async () => {
                try {
                    if (_checkWorking(true)) {
                        try {
                            //default is port 51687
                            const browser = new STEthernetIp.Browser(51687, "0.0.0.0", false);//, updateRate: number=3000, disconnectMultiplier: number=4);
                            browser.start();
                            await new Promise(resolve => setTimeout(resolve, 6500));
                            browser.stop();
                            browser.socket.close();
                            //const result = JSON.stringify(browser.deviceList);
                            _checkWorking(false);
                            resolve(browser.deviceList);

                        } catch (err) {
                            let errstr = JSON.stringify(err)
                            logger.error(`Error searching for ethernet/ip devices.`);
                            logger.error(errstr);
                            _checkWorking(false);
                            reject(errstr);
                        }
                    } else {
                        reject('Device is busy');
                    }
                } catch (err) {
                    logger.debug('caught async execption in browse for devices');
                    logger.debug(err);
                    // TODO add error lookup to string
                    logger.error(`'${device.name}' try to browse for devices error! ${JSON.stringify(err)}`);
                    _checkWorking(false);
                    return reject('Unable to browse for devices');
                }
            })()
        });
    }
    this.browse = function (node, callback) {
        return new Promise(function (resolve, reject) {
            (async () => {
                try {

                    if (_checkWorking(true)) {
                        try {
                            //create new connection to get tag list
                            const aconn = await _createConnection();                          
                            try {
                                const tagList = new STEthernetIp.TagList();
                                await aconn.getControllerTagList(tagList);                               
                                resolve(tagList);
                                _checkWorking(false);
                            } finally {
                                const dcresult = await aconn.disconnect();
                                logger.debug(`${device.name} browse for tags disconnect result ${dcresult}`);
                            }
                        } catch (err) {
                            let errstr = JSON.stringify(err)
                            logger.debug(errstr);
                            if (err && (err.generalStatusCode === 0x08 || err.generalStatusCode === 0x05)) {
                                errstr = 'Browse for tags not supported by Ethernet/IP device';                                
                            } else {
                                errstr = `${device.name} Error retrieving symbolic tags for ethernet/ip device.`;
                                logger.error(errstr);
                            }
                            _checkWorking(false);
                            reject(errstr);
                        }
                    } else {
                        reject('Device is busy');
                    }
                } catch (err) {
                    logger.debug(`${device.name} caught async execption in browse for tags`);
                    logger.debug(err);
                    // TODO add error lookup to string
                    logger.error(`'${device.name}' try to browse for tags error! ${JSON.stringify(err)}`);
                    _checkWorking(false);
                    return reject(`${device.name} Unable to browse for tags`);
                }
            })()
        });
    }
    var _isStringTag = function (tag) {
        if (tag.enipOptions?.tagType === EnipTagType.symbolic &&
            (tag.enipOptions?.symbolicOpt.dataType === EnipTypes.SHORT_STRING  ||
                tag.enipOptions?.symbolicOpt.dataType === EnipTypes.DATE_AND_STRING  ||
                tag.enipOptions?.symbolicOpt.dataType === EnipTypes.STRING  ||
                tag.enipOptions?.symbolicOpt.dataType === EnipTypes.STRING2  ||
                tag.enipOptions?.symbolicOpt.dataType === EnipTypes.STRINGI  ||
                tag.enipOptions?.symbolicOpt.dataType === EnipTypes.STRINGN
            )) {
            return true;
        }
        return false;
    }
    /**
     * Clear local Items value by set all to null
     */
    var _clearVarsValue = function () {
        for (var id in varsValue) {
            varsValue[id].value = null;
        }
        if (Object.keys(varsValue).length) {
            _emitValues(varsValue);
        }
    }

    /**
     * Read all values
     */
    var _readValues = async function () {
        // return new Promise((resolve, reject) => {

        const items = {};

        const tags = Object.values(device.tags);
        if (tags.length === 0 && ioconnections.length === 0) {
            // no tags data to send and no io connections
            // request controller properties to keep connection open
            await conn?.readControllerProps();
            return items;
            //console.log(conn.state.controller.name);
        }
        // read IO module/table tags
        // these values are already in memory, as the IO data is sent periodically over UDP
        // so no additional communication is needed
        // just copy the values from the ethernet/ip plugin to fuxa
        for (const ioconn of ioconnections) {
            const connTags = tags?.filter(tag => (tag.enipOptions?.tagType === EnipTagType.assemblyIO && //io tag
                tag.enipOptions?.ioOpt?.ioModuleId === ioconn.id && //tag associated with this io connection
                tag.enipOptions?.ioOpt?.ioOutput === false)); // input tag
            for (const tag of connTags) {
                items[tag.id] = ioconn.getValue(tag.id);
                logger.debug(`${device.name} IO tag ${tag.name} value: ${items[tag.id]}`);
            }
        }

        //read explicit msg tags, explicit tags can be marked get and send, or send only
        //skip send only
        for (var id in device.tags) {
            if (device.tags[id].enipOptions?.tagType !== EnipTagType.explicit ||
                (device.tags[id].enipOptions?.tagType === EnipTagType.explicit &&
                    device.tags[id].enipOptions?.explicitOpt?.getOrSend === false)) {
                continue;
            }
            const theTag = device.tags[id];
            let valueBuf = undefined;
                if (theTag.enipOptions?.explicitOpt?.sendBuffer?.length > 0) {
                    const trimedVal = theTag.enipOptions.explicitOpt.sendBuffer.replace(/\s/g, "");
                try {
                    valueBuf = Buffer.from(trimedVal, 'hex');
                } catch (error) {
                    logger.error(`${device.name} '${theTag.name}' error converting send buffer from hex ${error}`);
                    return false;
                }
                }   
            const tagValue = await conn?.getAttributeSingle(theTag.enipOptions.explicitOpt.class, theTag.enipOptions.explicitOpt.instance, theTag.enipOptions.explicitOpt.attribute, valueBuf);
            logger.debug(`${device.name} Read Explicit tag ${theTag.name} value:`);
            logger.debug(tagValue);
            items[id] = tagValue;
            tagMemoryTable[id] = tagValue;//do we need this?
        }

        // for symoblic
        if (connSupportsTagGroup) {
            const group = new STEthernetIp.TagGroup();
            for (var id in device.tags) {
                if (device.tags[id].enipOptions?.tagType !== EnipTagType.symbolic) {
                    continue;
                }
                //const aTag = new STEthernetIp.Tag(device.tags[id].address);
                const aTag = new STEthernetIp.Tag(device.tags[id].address,
                    device.tags[id].enipOptions?.symbolicOpt.program,
                    device.tags[id].enipOptions?.symbolicOpt.dataType
                );
                aTag.FuxaId = id;
                group.add(aTag);
            }
            try {
                await conn.readTagGroup(group);
                               
                group.forEach(tag => {
                    logger.debug(`${device.name} Read symbolic tag ${tag.name} in group value ${tag.value}`);
                    items[tag.FuxaId] = tag.value;
                });
                
            } catch(error) {
                logger.error(JSON.stringify(error));
                if (error.generalStatusCode !== 8) {//0x08 is not supported
                    //error is something other than not supported
                    throw(error);
                } else {
                    logger.info(`'${device.name}' does not support group symbolic tag reads`, true);
                }
                // next polling try single tag reads
                connSupportsTagGroup = false;
            };
        } else {
            //read one at a time
            for (var id in device.tags) {                
                if (device.tags[id].enipOptions?.tagType !== EnipTagType.symbolic) {
                    continue;
                }
                const aTag = conn.newTag(device.tags[id].address);
                await conn.readTag(aTag);
                logger.debug(`${device.name} Read symbolic tag ${device.tags[id].name} value ${aTag.value}`);
                items[id] = aTag.value === null ? '' : aTag.value;
            }
        }
        return items;        
    }

    /**
     * Update the Tags values read
     * @param {*} vars 
     */
    var _updateVarsValue = async (vars) => {
        const timestamp = new Date().getTime();
        var changed = {};
        for (const id in vars) {
            if (!utils.isNullOrUndefined(vars[id])) {
                
                var valueChanged = itemsMap[id].value !== vars[id];
                itemsMap[id].rawValue = vars[id];
                itemsMap[id].value = await deviceUtils.tagValueCompose(vars[id], varsValue[id] ? varsValue[id].value : null, itemsMap[id], runtime);
                varsValue[id] = { id: id, value: itemsMap[id].value, type: itemsMap[id].type, daq: itemsMap[id].daq, changed: valueChanged, timestamp: timestamp };
                if (this.addDaq && deviceUtils.tagDaqToSave(varsValue[id], timestamp)) {
                    changed[id] = varsValue[id];
                }
                varsValue[id].changed = false;
            }
        }        
        return changed;
    }

    var _ioConnectionEstablished = function () {
        numberOfIOScannersWaitingToConnect--;
    }
    var _waitForIOConnections = function () {

        return new Promise((resolve, reject) => {
            logger.debug(`${device.name} in waitingForIOConnections, numberOfIOScannersWaitingToConnect: ${numberOfIOScannersWaitingToConnect}, connectionAttempts: ${connectionAttempts}`);

            if (numberOfIOScannersWaitingToConnect > 0) {
                connectionAttempts--;
                if (connectionAttempts < 1) {
                    for (let ioconn of ioconnections) {
                        if (ioconn.lastError !== undefined) {
                            logger.error(`${device.name} Ethernet/ip IO module connection setup error ${ioconn.lastError}`);
                            if (ioconn.lastError.generalStatusCode === 1 && ioconn.lastError.extendedStatus === 0x106) {
                                logger.error(`${device.name} Ethernet/ip IO module connection ownership conflict`);
                            }
                        }
                    }
                    reject(`${device.name} unable to connect to IO module, connection attempts reached ${connectionAttempts}.`);
                    return;
                }
                setTimeout(() => { _waitForIOConnections().then(resolve).catch(reject); }, 500);
            } else {
                for (let ioconn of ioconnections) {
                    ioconn.removeListener('connected', _ioConnectionEstablished);
                }
                logger.debug(`${device.name} io connections finished connecting`);
                resolve('IO connections made.');
            }
        });
    }

      var _closeScanner = function (successCallback, errorCallback) {
        try {
            if (globalIOScanner) {
                globalIOScanner.socket.close(() => {
                    globalIOScanner = undefined;
                    logger.debug(`${device.name} scanner closed`);
                    successCallback(true);
                });
            } else {
                logger.debug(`${device.name} scanner not open, success`);
                successCallback(true);
            }
        } catch (err) {
            errorCallback(false);
        }
    }
    var _closeScannerWrapper = function () {
        return new Promise((resolve, reject) => {
            _closeScanner((successResponse) => {
                resolve(successResponse);
            }, (errorResponse) => {
                reject(errorResponse);
                return;
            });
        });
    }
    var _disconnectAll = async function () {
        logger.debug(`${device.name} disconnectAll!!!!!!`);
        //close each of the IO tcp connections
        for (let ioconn of ioconnections) {
            if (ioconn) {
                ioconn.run = false;
                try {
                    logger.debug(`${device.name} closing io connection...`);
                    //await ioconn.tcpController.disconnect();
                    await ioconn.disconnect();
                    logger.debug(`${device.name} io connection closed`);
                } catch (error) {
                    logger.debug(`${device.name} Error disconnecting io connection`);
                    logger.debug(error.toString());
                    //ioconn.tcpController.destroy();
                    //ioconn.tcpController._removeControllerEventHandlers();
                    logger.debug(`${device.name} forced io connection closed`);
                }
                const filteredConn = globalIOScanner.connections.filter(gioconn => {
                    const ret = gioconn !== ioconn;
                    return ret;
                });
                logger.debug(`filtered connections length ${filteredConn.length}`);
                ioconn = undefined;
                globalIOScanner.connections = filteredConn;
            }
            //ioconn.run = false; //stop the internal reconnect tries
        }
        ioconnections = [];
        //close the IO UDP listening port
        if (globalIOScanner?.connections?.length === 0) {
            const result = await _closeScannerWrapper();
        }
        //close the connection used to send explicit and symbolic messages
        if (conn !== undefined) {
            try {
                logger.debug(`${device.name} closing message connection`);
                await conn.disconnect();
                logger.debug(`${device.name} message connection closed`);
            } catch (error) {
                logger.error(`${device.name} Error disconnecting messaege connection`);
                logger.error(JSON.stringify(error));
                conn.destroy();
                conn._removeControllerEventHandlers();
                logger.debug(`${device.name} forced message connection closed`);
            }
           conn = undefined;
        }
    }
    var _mapIOTags = function () {
        for (const ioconn of ioconnections) {
            const tags = Object.values(device.tags);
            const connTags = tags?.filter(tag => (tag.enipOptions?.tagType === EnipTagType.assemblyIO && 
                tag.enipOptions?.ioOpt?.ioModuleId === ioconn.id));
            for (const tag of connTags) {
                //register the tag "map" with the ethernetip io connection
                if (tag.enipOptions.ioOpt.ioOutput) {
                    // will be written to output io table
                    if (tag.enipOptions.ioOpt.ioType === EnipIODataType.bit) {
                        ioconn.addOutputBit(tag.enipOptions.ioOpt.ioByteOffset, tag.enipOptions.ioOpt.ioBitOffset, tag.id);
                    } else if (tag.enipOptions.ioOpt.ioType === EnipIODataType.integer16) {
                        ioconn.addOutputInt(tag.enipOptions.ioOpt.ioByteOffset, tag.id);
                    }
                } else {                    
                    // will be read from input io table
                    if (tag.enipOptions.ioOpt.ioType === EnipIODataType.bit) {
                        ioconn.addInputBit(tag.enipOptions.ioOpt.ioByteOffset, tag.enipOptions.ioOpt.ioBitOffset, tag.id);
                    } else if (tag.enipOptions.ioOpt.ioType === EnipIODataType.integer16) {
                        ioconn.addInputInt(tag.enipOptions.ioOpt.ioByteOffset, tag.id);
                    }
                }
            }
        }
    }
    var _makeIOConnection = async function (addr, ioport) {        
        ioconnections = [];
        numberOfIOScannersWaitingToConnect = 0;
        connectionAttempts = 5;
        if (device.modules !== undefined) {
            const modules = Object.values(device.modules);
            if (modules.length > 0) {
                logger.debug(`${device.name} Make IO Connections`);
                numberOfIOScannersWaitingToConnect = modules.length;
                // if (globalIOScanner !== undefined) {
                //     //ioscanner.socket.close();
                //     await globalIOScanner.socket[Symbol.asyncDispose]();
                //     globalIOScanner = undefined;
                // }
                if (globalIOScanner === undefined) {
                    logger.debug(`${device.name} globalIOScanner undefined, creating new and binding to UDP socket`);
                    globalIOScanner = new STEthernetIp.IO.Scanner();
                    await globalIOScanner.bind(2222, '0.0.0.0');
                    logger.debug(`${device.name} globalIOScanner bind successful`);
                }
                let totalTimeout = 0;
                for (const module of modules) {
                    const config = {
                        configInstance: {
                            assembly: module.configurationInstance,
                            size: module.configurationSize
                        },
                        outputInstance: {
                            assembly: module.outputInstance,
                            size: module.outputSize
                        },
                        inputInstance: {
                            assembly: module.inputInstance,
                            size: module.inputSize
                        }
                    }
                    // Add a connection with (device config, rpi, ip_address)
                    const ioconn = globalIOScanner.addConnection(config, module.rpi, addr, ioport, false);
                    ioconn.id = module.id;
                    totalTimeout += ioconn.tcpController.timeout_sp;
                    let self = this;
                    ioconn.on('connected', _ioConnectionEstablished);
                    ioconn.on('disconnected', () => {
                        logger.debug(`${device.name} IOController timed out receiving UDP packets`);
                    });
                    //track various socket events for debugging purposes
                    //can be removed
                    ioconn.tcpController.on('error', (error)=> {
                        logger.debug(`${device.name} IOController enip socket error ${error}`);
                        //ioconn.tcpController.established_conn = false;            
                    });                    
                    ioconn.tcpController.on('end', (msg) => {
                        logger.debug(`${device.name} IOController enip socket end ${msg}`);
                        //ioconn.tcpController.established_conn = false;
                    });
                    ioconn.tcpController.on('close', (msg) => {
                        logger.debug(`${device.name} IOController enip socket close ${msg}`);
                        //ioconn.tcpController.established_conn = false;
                    });
                    ioconn.tcpController.on('timeout', (msg) => {
                        logger.debug(`${device.name} IOController enip socket end ${msg}`);
                        //ioconn.tcpController.established_conn = false;
                    });
                    await ioconn.connect();
                    ioconnections.push(ioconn);                                       
                }
                _mapIOTags();
                connectionAttempts = Math.trunc(totalTimeout/500);
                // Above does forwardOpen async, returns before connection is open
                // connection is not marked open until first UDP packet (acutal data) is received
                return _waitForIOConnections(totalTimeout);
            }
        }
        return true;
    }

    //create a message connection to the ethernet/ip device
    var _createConnection = async function () {
        var addr = device.property.address;
        if (device.property.address.indexOf(':') !== -1) {
            var addr = device.property.address.substring(0, device.property.address.indexOf(':'));
           // var temp = device.property.address.substring(device.property.address.indexOf(':') + 1);
            //port = parseInt(temp);
        }
        const aconn = new STEthernetIp.Controller();
        // track various socket events for debugging purposes
        aconn.on('error', (error)=> {
            logger.debug(`${device.name} Controller enip socket error ${error}`);
            //aconn.established_conn = false;            
        });
        aconn.on('end', (msg) => {
            logger.debug(`${device.name} Controller enip socket end ${msg}`);
            //aconn.established_conn = false;
        });
        aconn.on('close', (msg) => {
            logger.debug(`${device.name} Controller enip socket close ${msg}`);
            //aconn.established_conn = false;
        });
        aconn.on('timeout', (msg) => {
            logger.debug(`${device.name} Controller enip socket end ${msg}`);
            //aconn.established_conn = false;
        });
        if (device.property.options) {
            const path = Buffer.alloc(2);
            path.writeUInt8(device.property.rack, 0);
            path.writeUInt8(device.property.slot, 1);
            await aconn.connect(addr, path, false);
        } else {
            await aconn.connect(addr, Buffer.from([]), false);            
        }
        return aconn;
    }
    /**
     * Connect to the ethernet/IP device.  Several connections at once are possible.
     * 0-n IO Connections, one per IO table.  The ethernet/IP IO client binds to UDP
     * port 2222 (default) to recieve IO data.  For each IO connection/table a separate
     * TCP connection is made by the ethernet/IP client to setup/manage the IO data that
     * is exchanged.
     * 
     * If explicit messages (getAttributeSingle/sendAttributeSingle) or proprietary 
     * Rockwell symbolic messages are exchanged, an additional TCP connection is made.
     */
    var _connect = async function () {

        await _disconnectAll();
        var port = 44818;
        var addr = device.property.address;
        var ioport = device.property.ioport;
        if (device.property.address.indexOf(':') !== -1) {
            var addr = device.property.address.substring(0, device.property.address.indexOf(':'));
            var temp = device.property.address.substring(device.property.address.indexOf(':') + 1);
            port = parseInt(temp);
        }

        conn = await _createConnection();

        // conn = new STEthernetIp.Controller();
        // if (device.property.options) {
        //     const path = Buffer.alloc(2);
        //     path.writeUInt8(device.property.rack, 0);
        //     path.writeUInt8(device.property.slot, 1);
        //     await conn.connect(addr, path, false);
        // } else {
        //     await conn.connect(addr, Buffer.from([]), false);            
        // }
        logger.debug(`${device.name} ethernet/ip explicit/symbolic conn is now connected!!!!`);
        await _makeIOConnection(addr, device.property.ioport).catch(error => {
            logger.debug(`${device.name} _makeIOConnections failed`);
            logger.debug(error);
            throw (error);
        });
    }

    /**
     * Emit the PLC connection status
     * @param {*} status 
     */
    var _emitStatus = function (status) {
        lastStatus = status;
        events.emit('device-status:changed', { id: device.id, status: status });
    }
    
    /**
     * Emit the webapi Tags values array { id: <name>, value: <value>, type: <type> }
     * @param {*} values 
     */
    var _emitValues = function (values) {
        events.emit('device-value:changed', { id: device.id, values: values });
    }

    /**
     * Used to manage the async connection and polling automation (that not overloading)
     * @param {*} check 
     */
    var _checkWorking = function (check, isPolling=false) {
        if (check && working) {
            overloading++;
            logger.warn(`'${device.name}' working (connection || polling=${isPolling}) overload! ${overloading}`);
            // !The driver don't give the break connection
            return false;
            // if (overloading >= 3) {
            // this causes too many problems with the connections maintained by the ethernetip api
            // as the sockets that it may be waiting on, will be closed here
            // better to let them timeout and reconnect in the connect method
            //     await _disconnectAll(); 
            // } else {
            //     return false;
            // }
        }
        working = check;
        overloading = 0;
        return true;
    }
}

module.exports = {
    init: function (settings) {
        console.log('init plugin Ethernet/IP');
    },
    create: function (data, logger, events, manager, runtime) {
        // To use with plugin
        try { STEthernetIp = require('st-ethernet-ip'); } catch { }
        if (!STEthernetIp && manager) { try { STEthernetIp = manager.require('st-ethernet-ip'); } catch { } }
        if (!STEthernetIp) return null;
        return new GenericEthernetIPclient(data, logger, events, runtime);
    },
    browseForDevices: async function (manager, logger) {
        let library;
        try {
            library = manager && manager.require('st-ethernet-ip');
        } catch (error) {
            throw new Error(`Unable to load st-ethernet-ip: ${error.message || error}`);
        }
        if (!library || !library.Browser) {
            throw new Error('st-ethernet-ip does not export Browser');
        }
        const browser = new library.Browser(51687, '0.0.0.0', false);
        try {
            browser.start();
            await new Promise(resolve => setTimeout(resolve, 6500));
            return browser.deviceList;
        } finally {
            browser.stop();
            if (browser.socket) {
                await new Promise(resolve => browser.socket.close(resolve));
            }
        }
    }
}
