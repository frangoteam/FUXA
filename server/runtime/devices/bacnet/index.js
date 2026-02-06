/**
 * BACnet Client Driver
 */

'use strict';
var bacnet;
const utils = require('../../utils');
const deviceUtils = require('../device-utils');

function BACNETclient(_data, _logger, _events, _runtime) {

    var runtime = _runtime;
    var data = _data;                   // Current Device data { id, name, tags, enabled, ... }
    var logger = _logger;               // Logger
    var working = false;                // Working flag to manage overloading polling and connection
    var connected = false;              // Connected flag
    var lastStatus = '';                // Last Device status
    var events = _events;               // Events to commit change to runtime
    var client = null;

    var varsValue = {};                 // Signale to send to frontend { id, type, value }
    var requestItemsMap = {};           // Map of request (JSON, CSV, XML, ...) {key: item path, value: tag}
    var objectsMapToRead = {};
    // var getProperty = null;             // Function to ask property
    var lastTimestampValue;             // Last Timestamp of asked values
    var overloading = 0;                // Overloading counter to mange the break connection

    var devices = {};                   // Devices found { id, maxApdu, segmentation, vendorId }

    /**
     * Connect the client to BACnet device
     */
    this.connect = function () {
        return new Promise(function (resolve, reject) {
            if (data.property) {
                try {
                    if (_checkWorking(true)) {
                        logger.info(`'${data.name}' try to open BACnet`, true);
                        _connect().then( res => {
                            logger.info(`'${data.name}' connected!`, true);
                            _emitStatus('connect-ok');
                            connected = true;
                            resolve();
                            _checkWorking(false);
                        }, reason => {
                            logger.error(`'${data.name}' connect failed! ${reason}`);
                            _emitStatus('connect-error');
                            _clearVarsValue();
                            reject();
                            _checkWorking(false);
                            client.close();
                            client = null;
                        });
                    } else {
                        reject();
                    }
                } catch (err) {
                    logger.error(`'${data.name}' try to connect error! ${err}`);
                    _emitStatus('connect-error');
                    _clearVarsValue();
                    reject();
                    _checkWorking(false);
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
     * Disconnect the BACnet client
     */
    this.disconnect = function () {
        return new Promise(function (resolve, reject) {
            try {
                if (client && connected) {
                    client.close();
                    client = null;
                }
                resolve(true);
            } catch (err) {
                if (err) {
                    logger.error(`'${data.name}' disconnect failure! ${err}`);
                }
                reject();
            }
            connected = false;
            monitored = false;
            _checkWorking(false);
            _emitStatus('connect-off');
            _clearVarsValue();
        });
    }

    /**
     * Browse Devices Objects, read the objects of gived device
     */
    this.browse = function (node) {
        return new Promise(function (resolve, reject) {
            if (!node) {
                _askName(Object.values(devices)).then(res => {
                    resolve(Object.values(devices));
                });
            } else if (node.id) {
                if (_checkWorking(true)) {
                    try {
                        if (node.parent) {      // BACnet object => read property
                            _checkWorking(false);
                        } else {                // BACnet device => read object list
                            _readObjectList(node.id).then(result => {
                                resolve(result);
                                _checkWorking(false);
                            }, err => {
                                reject();
                                _checkWorking(false);
                            });
                        }
                    } catch (err) {
                        if (err) {
                            logger.error(`'${data.name}' browse failure! ${err}`);
                        }
                        reject();
                        _checkWorking(false);
                    }
                }
            } else {
                reject();
                _checkWorking(false);
            }
        });
    }

    // Next function wraps the API client.readPropertyMultiple call into a Promise
    // and handles the callbacks with resolve and reject.
    // https://stackoverflow.com/questions/5010288/how-to-make-a-function-wait-until-a-callback-has-been-called-using-node-js
    this.apiFunctionWrapper = function (deviceAddress, requestArray) {
        return new Promise((resolve, reject) => {
            client.readPropertyMultiple(deviceAddress, requestArray, async (err, value) => {
                if (err) {
                    logger.error(`'${data.name}' readPropertyMultiple error! ${err}`);
                    reject(err);
                }
                resolve(value);
            });
        });
    }

    /**
     * Take the current Objects (Tags) value (only changed), Reset the change flag, Emit Tags value
     * Save DAQ value
     */
    this.polling = async function () {
        if (_checkWorking(true)) {
            for (var deviceId in objectsMapToRead) {
                try {
                    const deviceAddress = _getDeviceAddress(devices[deviceId]);
                    //wrap the client.readPropertyMultiple in a promise so the callback can be awaited
                    const value = await this.apiFunctionWrapper(deviceAddress, objectsMapToRead[deviceId]);

                    if (!(value && value.values && value.values[0] && value.values[0].values)) {
                        logger.error(`'${data.name}' readPropertyMultiple error! unknow`);
                    } else if (value.values && value.values.length) {
                        let result = [];
                        value.values.forEach(bacData => {
                            if (bacData.objectId && bacData.values && bacData.values[0].id === bacnet.enum.PropertyIdentifier.PRESENT_VALUE) {
                                let address = _formatId(bacData.objectId.type, bacData.objectId.instance);
                                if (bacData.values[0].value && bacData.values[0].value.type === bacnet.enum.ApplicationTag.ERROR ||
                                    bacData.values[0].value.length > 0 && bacData.values[0].value[0].type === bacnet.enum.ApplicationTag.ERROR ) {
                                        logger.error(`'${data.name}' readPropertyMultiple error! errorClass: ${bacData.values[0].value[0].value.errorClass}, errorCode: ${bacData.values[0].value[0].value.errorCode}`);
                                } else {
                                    result.push({
                                        address: address,
                                        rawValue: bacData.values[0].value[0].value,
                                        type: bacData.objectId.type
                                    });
                                }
                            }
                        });
                        if (result.length) {
                            let varsValueChanged = await _updateVarsValue(deviceId, result);
                            lastTimestampValue = new Date().getTime();
                            _emitValues(varsValue);
                            if (this.addDaq && !utils.isEmptyObject(varsValueChanged)) {
                                this.addDaq(varsValueChanged, data.name, data.id);
                            }
                        }
                    }
                    if (lastStatus !== 'connect-ok') {
                        _emitStatus('connect-ok');
                    }
                } catch (err) {
                    if (err) {
                        logger.error(`'${data.name}' readPropertyMultiple error! ${err}`);
                    }
                }
            }
            _checkWorking(false);
        } else {
            _emitStatus('connect-busy');
        }

    }

    /**
     * Load Objects (Tags) to read by polling
     */
    this.load = function (_data) {
        data = JSON.parse(JSON.stringify(_data));
        try {
            requestItemsMap = {};
            var count = Object.keys(data.tags).length;
            for (var id in data.tags) {
                if (!requestItemsMap[data.tags[id].memaddress]) {
                    requestItemsMap[data.tags[id].memaddress] = {};
                }
                requestItemsMap[data.tags[id].memaddress][data.tags[id].address] = data.tags[id];
            }
            objectsMapToRead = {};
            for (var deviceId in requestItemsMap) {
                objectsMapToRead[deviceId] = [];
                for (var tagId in requestItemsMap[deviceId]) {
                    let obj = _extractId(requestItemsMap[deviceId][tagId].address);
                    objectsMapToRead[deviceId].push({objectId: {type: obj.type, instance: obj.instance}, properties: [{id: bacnet.enum.PropertyIdentifier.PRESENT_VALUE}]});
                }
            }
            logger.info(`'${data.name}' data loaded (${count})`, true);
        } catch (err) {
            logger.error(`'${data.name}' load error! ${err}`);
        }
    }

    /**
     * Return Objects (Tags) values array { id: <name>, value: <value>, type: <type> }
     */
    this.getValues = function () {
        return data.tags;
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
     * Return Device status Connected/Disconnected 'connect-off', 'connect-ok', 'connect-error'
     */
    this.getStatus = function () {
        return lastStatus;
    }

    /**
     * Return Objects (Tag) property
     */
    this.getTagProperty = function (id) {
        if (data.tags[id]) {
            return { id: id, name: data.tags[id].name, type: data.tags[id].type, format: data.tags[id].format};
        } else {
            return null;
        }
    }

    /**
     * Set Tag value, used to set value from frontend
     */
    this.setValue = async function (tagId, value) {
        if (data.tags[tagId]) {
            var obj = _extractId(data.tags[tagId].address);
            value = await deviceUtils.tagRawCalculator(value, data.tags[tagId], runtime);
            _writeProperty(_getDeviceAddress(devices[data.tags[tagId].memaddress]), obj, value).then(result => {
                logger.info(`'${data.name}' setValue(${tagId}, ${result})`, true, true);
            }, reason => {
                if (reason && reason.stack) {
                    logger.error(`'${data.name}' _writeProperty error! ${reason.stack}`);
                } else {
                    logger.error(`'${data.name}' _writeProperty error! ${reason}`);
                }
            });
            return true;
        }
        return false;
    }

    /**
     * Is Connected true/false
     */
    this.isConnected = function () {
        return connected;
    }

    /**
     * Set the callback to set value to DAQ
     */
    this.bindAddDaq = function (fnc) {
        this.addDaq = fnc;                          // Add the DAQ value to db history
    }
    this.addDaq = null;                             // Callback to add the DAQ value to db history

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
     * Connect the client to device
     * Listening after broadcast query
     * @param {*} callback
     */
    var _connect = function() {
        return new Promise(function (resolve, reject) {
            var ipInterface = data.property.address || '0.0.0.0';
            if (data.property.address && data.property.address.indexOf(':') !== -1) {
                ipInterface = data.property.address.substring(0, data.property.address.indexOf(':'));
                var port = data.property.address.substring(data.property.address.indexOf(':') + 1);
            }
            var settings = {
                interface: ipInterface,
                port: parseInt(port) || 47808,
                adpuTimeout: parseInt(data.property.adpuTimeout) || 6000
            }
            var tryExplicit = false;
            if (data.property.broadcastAddress) {
                settings['broadcastAddress'] = data.property.broadcastAddress || '0.0.0.255';
                tryExplicit = settings['broadcastAddress'].indexOf('255') === -1;
            }

            if (utils.getNetworkInterfaces().indexOf(ipInterface) === -1) {
                reject(`'${data.name}' selected interface don't exist!`);
                return;
            }
            console.log(settings);
            client = new bacnet(settings);
            //  let options = { maxSegments: bacnet.enum.MaxSegments.MAX_SEG2, maxAdpu: bacnet.enum.MaxAdpu.MAX_APDU1476 };
            //  client.deviceCommunicationControl(ipAddress, 0, bacnet.enum.EnableDisable.DISABLE, (err, value) => {
            //     console.log('value: ', value);
            //   });
             let tdelay = setTimeout(() => {
                reject('timeout');
            }, 5000);
            devices = {};
            try {
                client.on('iAm', (device) => {
                    if (device && device.payload &&  device.payload.deviceId && !devices[device.id]) {
                        if (tdelay) {
                            clearTimeout(tdelay);
                        }
                        device = {
                            ...device.payload,
                            ...device.header,
                            id: device.payload.deviceId,
                            name: 'DeviceId ' + device.payload.deviceId
                        };
                        devices[device.id] = device;
                        resolve();
                    }
                });
                client.whoIs();
                if (tryExplicit) {
                    setTimeout(() => {
                        client.whoIs({deviceIPAddress: settings['broadcastAddress']});
                    }, 2000);
                }

            } catch (err) {
                reject(err);
                if (tdelay) {
                    clearTimeout(tdelay);
                }
            }
        });
    }

    /**
     * Ask all devices name
     * @param {*} devices
     */
    var _askName = function (devices) {
        return new Promise(async function (resolve, reject) {
            var readfnc = [];
            if (devices.length) {
                for (var index in devices) {
                    var device = devices[index];
                    try {
                        let rp = await _readProperty(_getDeviceAddress(device), { type: bacnet.enum.ObjectType.DEVICE, instance: device.deviceId}, bacnet.enum.PropertyIdentifier.OBJECT_NAME);
                        if (rp) {
                            readfnc.push(rp);
                        }
                    } catch (err) {
                        logger.error(`'${data.name}' _readProperty error! ${err}`);
                    }
                }
                Promise.all(readfnc).then(results => {
                    if (results) {
                        for (var index in results) {
                            var device = _getDevice(results[index].instance);
                            if (device) {
                                device.name = results[index].value;
                                device.class = _getObjectClass(device.type);
                            }
                        }
                    }
                    resolve();
                }, reason => {
                    if (reason) {
                        if (reason.stack) {
                            logger.error(`'${data.name}' _askName error! ${reason.stack}`);
                        } else if (reason.message) {
                            logger.error(`'${data.name}' _askName error! ${reason.message}`);
                        }
                    } else {
                        logger.error(`'${data.name}' _askName error! ${reason}`);
                    }
                    reject();
                });
            } else {
                reject();
            }
        });
    }

    /**
     * Read Objects list of device, in Device Object
     * @param {*} instance
     */
    var _readObjectList = function(instance) {
        return new Promise(function (resolve, reject) {
            client.readProperty(_getDeviceAddress(devices[instance]), {type: bacnet.enum.ObjectType.DEVICE, instance: instance}, bacnet.enum.PropertyIdentifier.OBJECT_LIST, (err, value) => {
                if (err) {
                    logger.error(`'${data.name}' _readObjectList error! ${err}`);
                } else if (value && value.values && value.values.length) {
                    var objects = [];
                    var readfnc = [];
                    for (var index in value.values) {
                        var object = value.values[index].value;
                        object.parent = instance;
                        if (_isObjectToShow(object.type)) {
                            objects.push(object);
                            try {
                                readfnc.push(_readProperty(_getDeviceAddress(devices[instance]), { type: object.type, instance: object.instance}, bacnet.enum.PropertyIdentifier.OBJECT_NAME));
                            } catch (error) {
                                logger.error(`'${data.name}' _readObjectList error! ${error}`);
                            }
                        }
                    }
                    Promise.all(readfnc).then(results => {
                        if (results) {
                            for (var index in results) {
                                if (results[index]) {
                                    var object = _getObject(objects, results[index].type, results[index].instance);
                                    if (object) {
                                        object.id = _formatId(object.type, object.instance);
                                        object.name = results[index].value;
                                        object.class = _getObjectClass(object.type);
                                    }
                                }
                            }
                        }
                        resolve(objects);
                    }, reason => {
                        if (reason) {
                            if (reason.stack) {
                                logger.error(`'${data.name}' _readObjectList error! ${reason.stack}`);
                            } else if (reason.message) {
                                logger.error(`'${data.name}' _readObjectList error! ${reason.message}`);
                            }
                        } else {
                            logger.error(`'${data.name}' _readObjectList error! ${reason}`);
                        }
                        reject(reason);
                    });
                }
            });
        });
    }

    /**
     * Read Object property, Object are defined with type and instance
     * @param {*} bacobj
     * @param {*} property
     */
    var _readProperty = function(address, bacobj, property) {
        return new Promise(function (resolve, reject) {
            client.readProperty(address, bacobj, property, (err, value) => {
                if (err) {
                    resolve();
                } else if (value && value.values && value.values[0] && value.values[0].value) {
                    resolve({ type: bacobj.type, instance: bacobj.instance, value: value.values[0].value });
                } else {
                    resolve();
                }
            });
        });
    }

    var _writeProperty = function(address, bacobj, value) {
        return new Promise(function (resolve, reject) {
            var tvalue = {type: bacnet.enum.ApplicationTag.NULL, value: value};
            bacobj.type = parseInt(bacobj.type);
            bacobj.instance = parseInt(bacobj.instance);
            if (bacobj.type === bacnet.enum.ObjectType.ANALOG_INPUT ||
                bacobj.type === bacnet.enum.ObjectType.ANALOG_OUTPUT ||
                bacobj.type === bacnet.enum.ObjectType.ANALOG_VALUE) {
                tvalue.type = bacnet.enum.ApplicationTag.REAL;
                tvalue.value = parseFloat(value);
            } else if (bacobj.type === bacnet.enum.ObjectType.BINARY_INPUT ||
                bacobj.type === bacnet.enum.ObjectType.BINARY_OUTPUT ||
                bacobj.type === bacnet.enum.ObjectType.BINARY_VALUE) {
                tvalue.type = bacnet.enum.ApplicationTag.ENUMERATED;
                tvalue.value = parseInt(value);
            }

            client.writeProperty(address, bacobj, bacnet.enum.PropertyIdentifier.PRESENT_VALUE, [tvalue], { priority: 16 }, (err, result) => {
                if (err) {
                    reject(err);
                    console.error('value: ', err);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Return the Device
     * @param {*} deviceId
     */
    var _getDevice = function (deviceId) {
        for (var id in devices) {
            if (devices[id].deviceId === deviceId) {
                return devices[id];
            }
        }
        return null;
    }

    /**
     * Search and return the object
     * @param {*} objs
     * @param {*} type
     * @param {*} instance
     */
    var _getObject = function (objs, type, instance) {
        for (var index in objs) {
            if (objs[index] && objs[index].type === type && objs[index].instance === instance) {
                return objs[index];
            }
        }
        return null;
    }

    /**
     * Return the object class text
     * @param {*} type
     */
    var _getObjectClass = function (type) {
        if (type === bacnet.enum.ObjectType.DEVICE) {
            return 'Device';
        } else if (type === bacnet.enum.ObjectType.ANALOG_INPUT) {
            return 'Variable';
        } else if (type === bacnet.enum.ObjectType.ANALOG_OUTPUT) {
            return 'Variable';
        } else if (type === bacnet.enum.ObjectType.ANALOG_VALUE) {
            return 'Variable';
        } else if (type === bacnet.enum.ObjectType.BINARY_INPUT) {
            return 'Variable';
        } else if (type === bacnet.enum.ObjectType.BINARY_OUTPUT) {
            return 'Variable';
        } else if (type === bacnet.enum.ObjectType.BINARY_VALUE) {
            return 'Variable';
        } else {
            return 'Object';
        }
    }

    /**
     * Return if is a object to shoe and config (only Analog and Digital)
     * @param {*} type
     */
    var _isObjectToShow = function (type) {
        if (type === bacnet.enum.ObjectType.DEVICE) {
            return false;
        } else if (type === bacnet.enum.ObjectType.ANALOG_INPUT) {
            return true;
        } else if (type === bacnet.enum.ObjectType.ANALOG_OUTPUT) {
            return true;
        } else if (type === bacnet.enum.ObjectType.ANALOG_VALUE) {
            return true;
        } else if (type === bacnet.enum.ObjectType.BINARY_INPUT) {
            return true;
        } else if (type === bacnet.enum.ObjectType.BINARY_OUTPUT) {
            return true;
        } else if (type === bacnet.enum.ObjectType.BINARY_VALUE) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * Update the Tags values read
     * @param {*} vars
     */
    var _updateVarsValue = async (deviceId, vars) => {
        const timestamp = new Date().getTime();
        var someval = false;
        var changed = {};
        for (var index in vars) {
            var address = vars[index].address;
            if (requestItemsMap[deviceId][address]) {
                var tag = requestItemsMap[deviceId][address];
                if (!varsValue[tag.id] || varsValue[tag.id].value !== vars[index].value) {
                    changed[tag.id] = { id: tag.id, value: vars[index].value, type: vars[index].type, daq: tag.daq };
                    varsValue[tag.id] = changed[tag.id];
                }
                varsValue[tag.id].changed = varsValue[tag.id].rawValue !== vars[index].rawValue;
                if (!utils.isNullOrUndefined(vars[index].rawValue)) {
                    varsValue[tag.id].rawValue = vars[index].rawValue;
                    varsValue[tag.id].value = await deviceUtils.tagValueCompose(vars[index].rawValue, varsValue[tag.id] ? varsValue[tag.id].value : null, tag, runtime);
                    vars[index].value = varsValue[tag.id].value;
                    if (this.addDaq && deviceUtils.tagDaqToSave(varsValue[tag.id], timestamp)) {
                        changed[tag.id] = { id: tag.id, value: varsValue[tag.id].value, type: vars[index].type, daq: tag.daq, timestamp: timestamp };
                        varsValue[tag.id] = changed[tag.id];
                    }
                    varsValue[tag.id].timestamp = timestamp;
                }
                varsValue[tag.id].changed = false;
                someval = true;
            }
        }
        if (someval) {
            return changed;
        }
        return null;
    }

    /**
     * Clear local Tags value by set all to null
     */
    var _clearVarsValue = function () {
        for (let id in varsValue) {
            varsValue[id].value = null;
        }
        _emitValues(varsValue);
    }

    /**
     * Return formatted object id
     * @param {*} type
     * @param {*} instance
     */
    var _formatId = function (type, instance) {
        return type + '-' + instance;
    }

    /**
     * Return id and type from formatted id
     * @param {*} id
     */
    var _extractId = function (id) {
        let tks = id.split('-');
        return { type: tks[0], instance: tks[1] };
    }

    /**
     * To manage a overloading connection
     * @param {*} check
     */
    var _checkWorking = function (check) {
        if (check && working) {
            logger.warn(`'${data.name}' working (connection || polling) overload! ${overloading}`);
            if (overloading >= 3) {
                client.close();
            } else {
                return false;
            }
        }
        overloading = 0;
        working = check;
        return true;
    }

    /**
     * Emit Objects (Tags) in application
     * @param {*} values
     */
    var _emitValues = function (values) {
        events.emit('device-value:changed', { id: data.name, values: values });
    }

    /**
     * Emit status in application
     * @param {*} status
     */
    var _emitStatus = function (status) {
        lastStatus = status;
        events.emit('device-status:changed', { id: data.name, status: status });
    }

    var _getDeviceAddress = function (device) {
        return device.address || device.sender.address;
    }
}

module.exports = {
    init: function (settings) {
        // deviceCloseTimeout = settings.deviceCloseTimeout || 15000;
    },
    create: function (data, logger, events, manager, runtime) {
        try { bacnet = require('node-bacnet'); } catch { }
        if (!bacnet && manager) { try { bacnet = manager.require('node-bacnet'); } catch { } }
        if (!bacnet) return null;
        return new BACNETclient(data, logger, events, runtime);
    }
}