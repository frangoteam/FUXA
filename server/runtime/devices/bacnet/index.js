/**
 * BACnet Client Driver
 */

'use strict';
const bacnet = require('bacstack');

function BACNETclient(_data, _logger, _events) {

    var data = _data;                   // Current Device data { id, name, tags, enabled, ... }
    var logger = _logger;               // Logger
    var working = false;                // Working flag to manage overloading polling and connection
    var connected = false;              // Connected flag
    var lastStatus = '';                // Last Device status
    var events = _events;               // Events to commit change to runtime
    var client = null;

    var varsValue = {};                 // Signale to send to frontend { id, type, value }
    var daqInterval = 0;                // To manage minimum interval to save a DAQ value
    var lastDaqInterval = 0;            // To manage minimum interval to save a DAQ value
    // var getProperty = null;             // Function to ask property
    var lastTimestampValue;             // Last Timestamp of asked values

    var devices = {};                   // Devices found { id, maxApdu, segmentation, vendorId }
    var ipAddress = null;
    var port = 47808;

    /**
     * Connect the client to BACnet device
     */
    this.connect = function () {
        return new Promise(function (resolve, reject) {
            if (data.property && data.property.address) {
                try {
                    if (_checkWorking(true)) {
                        logger.info(data.name + ': try to connect ' + data.property.address);
                        _connect(data.property.address).then( res => {
                            logger.info(data.name + ': connected!');
                            _emitStatus('connect-ok');
                            connected = true;
                            resolve();
                            _checkWorking(false);
                        }, reason => {
                            logger.error(data.name + ': connect failed! ' + reason);
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
                    logger.error(data.name + ': try to connect error! ' + err);
                    _emitStatus('connect-error');
                    _clearVarsValue();
                    reject();
                    _checkWorking(false);
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
                    logger.error(data.name + ': disconnect failure, ' + err);
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
                            logger.error(data.name + ': browse failure, ' + err);
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

    /**
     * Take the current Objects (Tags) value (only changed), Reset the change flag, Emit Tags value
     * Save DAQ value
     */
    this.polling = function () {
        if (_checkWorking(true) ) {
            var readObjects = [];
            for (var tagId in data.tags) {
                let obj = _extractId(tagId);
                readObjects.push({objectId: {type: obj.type, instance: obj.instance}, properties: [{id: bacnet.enum.PropertyIds.PROP_PRESENT_VALUE}]});
            }
            if (readObjects.length) {
                try {
                    client.readPropertyMultiple(ipAddress, readObjects, (err, value) => {
                        if (err) {        
                            logger.error(data.name + ' readPropertyMultiple error: ' + err);
                        } else {
                            const tmp = {};
                            if (!(value && value.values && value.values[0] && value.values[0].values)) {
                                logger.error(data.name + ' readPropertyMultiple error: unknow');
                            } else if (value.values && value.values.length) {
                                let result = [];
                                let errors = [];
                                value.values.forEach(data => { 
                                    if (data.objectId && data.values && data.values[0].id === bacnet.enum.PropertyIds.PROP_PRESENT_VALUE) {
                                        let id = _formatId(data.objectId.type, data.objectId.instance);
                                        if (data.values[0].value && data.values[0].value.type === bacnet.enum.ApplicationTags.BACNET_APPLICATION_TAG_ERROR) {
                                            errors.push({ id: id, value: data.values[0].value.value, type:  data.objectId.type });    
                                        } else {
                                            result.push({ id: id, value: data.values[0].value[0].value, type:  data.objectId.type });    
                                        }
                                    }
                                });
                                if (result.length) {
                                    let varsValueChanged = _updateVarsValue(result);
                                    lastTimestampValue = new Date().getTime();
                                    _emitValues(Object.values(varsValue));
                                    if (this.addDaq) {
                                        var current = new Date().getTime();
                                        if (current - daqInterval > lastDaqInterval) {
                                            this.addDaq(varsValue);
                                            lastDaqInterval = current;
                                        } else if (varsValueChanged) {
                                            this.addDaq(varsValueChanged);
                                        }
                                    }
                                }
                            }
                            if (lastStatus !== 'connect-ok') {
                                _emitStatus('connect-ok');                    
                            }
                        }
                        _checkWorking(false);
                    });
                } catch {
                    _checkWorking(false);
                }
            } else {
                _checkWorking(false);
            }
        } else {
            _emitStatus('connect-busy');                    
        }

    }

    /**
     * Load Objects (Tags) to read by polling
     */
    this.load = function (_data) {
        data = JSON.parse(JSON.stringify(_data));
        var count = Object.keys(data.tags).length;
        logger.info(data.name + ': data loaded (' + count + ')');
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
            let prop = { id: id, name: data.tags[id].name, type: data.tags[id].type };
            return prop;
        } else {
            return null;
        }
    }

    /**
     * Set Tag value, used to set value from frontend
     */
    this.setValue = function (sigid, value) {
        if (data.tags[sigid]) {
            var obj = _extractId(data.tags[sigid].address);
            _writeProperty(obj, value).then(result => {
                logger.info('setValue : ' + sigid + '=' + result);
            }, reason => {
                if (reason && reason.stack) {
                    logger.error(data.name + ' _writeProperty error: ' + reason.stack);
                } else {
                    logger.error(data.name + ' _writeProperty error: ' + reason);
                }
            });
        }
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
    this.bindAddDaq = function (fnc, intervalToSave) {
        this.addDaq = fnc;                          // Add the DAQ value to db history
        daqInterval = intervalToSave;
    }
    this.addDaq = null;                             // Callback to add the DAQ value to db history

    /**
     * Connect the client to device
     * Listening after broadcast query
     * @param {*} callback 
     */
    var _connect = function(endpointUrl) {
        return new Promise(function (resolve, reject) {
            ipAddress = endpointUrl;
            if (endpointUrl.indexOf(':') !== -1) {
                ipAddress = endpointUrl.substring(0, endpointUrl.indexOf(':'));
                var temp = endpointUrl.substring(endpointUrl.indexOf(':') + 1);
                port = parseInt(temp);
            }
            client = new bacnet({ apduTimeout: 6000, port: port,
                //broadcastAddress: ({}).broadcast,
                // interface: (nics[settings.nic] || {}).address,
                // broadcastAddress: (nics[settings.nic] || {}).broadcast,
             });
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
                    if (device.deviceId && !devices[device.id]) {
                        if (tdelay) {
                            clearTimeout(tdelay);
                        }
                        device = {...device, id: device.deviceId, name: 'Device ' + device.deviceId + ' (' + ipAddress + ':' + port + ')' };
                        devices[device.id] = device;
                        resolve();
                    }
                });
                client.whoIs();
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
     * @param {*} devs 
     */
    var _askName = function (devs) {
        return new Promise(function (resolve, reject) {
            var readfnc = [];
            if (devs.length) {
                for (var index in devs) {
                    var device = devs[index];
                    try {
                        readfnc.push(_readProperty({ type: bacnet.enum.ObjectTypes.OBJECT_DEVICE, instance: device.deviceId}, bacnet.enum.PropertyIds.PROP_OBJECT_NAME));
                    } catch (error) {
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
                            logger.error(data.name + ' _askName error: ' + reason.stack);
                        } else if (reason.message) {
                            logger.error(data.name + ' _askName error: ' + reason.message);
                        }
                    } else {
                        logger.error(data.name + ' _askName error: ' + reason);
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
            client.readProperty(ipAddress, {type: bacnet.enum.ObjectTypes.OBJECT_DEVICE, instance: instance}, bacnet.enum.PropertyIds.PROP_OBJECT_LIST, (err, value) => {
                if (err) {
                    logger.error(data.name + ' _readObjectList error: ' + err);
                } else if (value && value.values && value.values.length) {
                    var objects = [];
                    var readfnc = [];
                    for (var index in value.values) {
                        var object = value.values[index].value;
                        object.parent = instance;
                        if (_isObjectToShow(object.type)) {
                            objects.push(object);
                            try {
                                readfnc.push(_readProperty({ type: object.type, instance: object.instance}, bacnet.enum.PropertyIds.PROP_OBJECT_NAME));
                            } catch (error) {
                                logger.error(data.name + ' _readObjectList error: ' + error);
                            }
                        }
                    }
                    Promise.all(readfnc).then(results => {
                        if (results) {
                            for (var index in results) {
                                var object = _getObject(objects, results[index].type, results[index].instance);
                                if (object) {
                                    object.id = _formatId(object.type, object.instance);
                                    object.name = results[index].value;
                                    object.class = _getObjectClass(object.type);
                                }
                            }
                        }
                        resolve(objects);          
                    }, reason => {
                        if (reason) {
                            if (reason.stack) {
                                logger.error(data.name + ' _readObjectList error: ' + reason.stack);
                            } else if (reason.message) {
                                logger.error(data.name + ' _readObjectList error: ' + reason.message);
                            }
                        } else {
                            logger.error(data.name + ' _readObjectList error: ' + reason);
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
    var _readProperty = function(bacobj, property) {
        return new Promise(function (resolve, reject) {
            client.readProperty(ipAddress, bacobj, property, (err, value) => {
                if (err) {
                    reject(err);
                } else if (value && value.values && value.values[0] && value.values[0].value) {
                    resolve({ type: bacobj.type, instance: bacobj.instance, value: value.values[0].value });
                } else {
                    reject('unknow error');
                }
            });
        });
    }

    var _writeProperty = function(bacobj, value) {
        return new Promise(function (resolve, reject) {
            var tvalue = {type: bacnet.enum.ApplicationTags.BACNET_APPLICATION_TAG_NULL, value: value};
            bacobj.type = parseInt(bacobj.type);
            bacobj.instance = parseInt(bacobj.instance);
            if (bacobj.type === bacnet.enum.ObjectTypes.OBJECT_ANALOG_INPUT || 
                bacobj.type === bacnet.enum.ObjectTypes.OBJECT_ANALOG_OUTPUT || 
                bacobj.type === bacnet.enum.ObjectTypes.OBJECT_ANALOG_VALUE) {
                tvalue.type = bacnet.enum.ApplicationTags.BACNET_APPLICATION_TAG_REAL;
                tvalue.value = parseFloat(value);
            } else if (bacobj.type === bacnet.enum.ObjectTypes.OBJECT_BINARY_INPUT || 
                bacobj.type === bacnet.enum.ObjectTypes.OBJECT_BINARY_OUTPUT || 
                bacobj.type === bacnet.enum.ObjectTypes.OBJECT_BINARY_VALUE) {
                tvalue.type = bacnet.enum.ApplicationTags.BACNET_APPLICATION_TAG_ENUMERATED;
                tvalue.value = parseInt(value);
            }

            client.writeProperty(ipAddress, bacobj, bacnet.enum.PropertyIds.PROP_PRESENT_VALUE, [tvalue], { priority: 16 }, (err, result) => {
                if (err) {
                    reject(err);
                    console.log('value: ', err);
                } else {
                    resolve();
                    console.log('value: ', result);
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
            if (objs[index].type === type && objs[index].instance === instance) {
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
        if (type === bacnet.enum.ObjectTypes.OBJECT_DEVICE) {
            return 'Device';
        } else if (type === bacnet.enum.ObjectTypes.OBJECT_ANALOG_INPUT) {
            return 'Variable';
        } else if (type === bacnet.enum.ObjectTypes.OBJECT_ANALOG_OUTPUT) {
            return 'Variable';
        } else if (type === bacnet.enum.ObjectTypes.OBJECT_ANALOG_VALUE) {
            return 'Variable';
        } else if (type === bacnet.enum.ObjectTypes.OBJECT_BINARY_INPUT) {
            return 'Variable';
        } else if (type === bacnet.enum.ObjectTypes.OBJECT_BINARY_OUTPUT) {
            return 'Variable';
        } else if (type === bacnet.enum.ObjectTypes.OBJECT_BINARY_VALUE) {
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
        if (type === bacnet.enum.ObjectTypes.OBJECT_DEVICE) {
            return false;
        } else if (type === bacnet.enum.ObjectTypes.OBJECT_ANALOG_INPUT) {
            return true;
        } else if (type === bacnet.enum.ObjectTypes.OBJECT_ANALOG_OUTPUT) {
            return true;
        } else if (type === bacnet.enum.ObjectTypes.OBJECT_ANALOG_VALUE) {
            return true;
        } else if (type === bacnet.enum.ObjectTypes.OBJECT_BINARY_INPUT) {
            return true;
        } else if (type === bacnet.enum.ObjectTypes.OBJECT_BINARY_OUTPUT) {
            return true;
        } else if (type === bacnet.enum.ObjectTypes.OBJECT_BINARY_VALUE) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * Update the Tags values read
     * @param {*} vars 
     */
    var _updateVarsValue = function (vars) {
        var someval = false;
        var changed = {};
        for (var index in vars) {
            let id = vars[index].id;
            if (!varsValue[id] || varsValue[id].value !== vars[index].value) {
                changed[id] = { id: vars[index].id, value: vars[index].value, type: vars[index].type };
                varsValue[id] = changed[id];
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
            logger.error(data.name + ' working (connection || polling) overload!');
            return false;
        }
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
}

module.exports = {
    init: function (settings) {
        // deviceCloseTimeout = settings.deviceCloseTimeout || 15000;
    },
    create: function (data, logger, events) {
        return new BACNETclient(data, logger, events);
    }
}