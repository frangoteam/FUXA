/**
 * Device interface managed with StateMachine INIT/IDLE/POLLING
 */

'use strict';
var S7client = require('./s7');
var OpcUAclient = require('./opcua');
var MODBUSclient = require('./modbus');
var BACNETclient = require('./bacnet');

var deviceCloseTimeout = 1000;
var DEVICE_CHECK_STATUS_INTERVAL = 5000;
var DEVICE_POLLING_INTERVAL = 3000;             // with DAQ enabled, will be saved only changed values in this interval
var DEVICE_DAQ_MIN_INTERVAL = 60000;            // with DAQ enabled, interval to save DAQ value anyway !!bigger as DEVICE_POLLING_INTERVAL

function Device(data, logger, _events) {
    var property = { id: data.id, name: data.name };        // Device property (name, id)
    var status = DeviceStatusEnum.INIT;                     // Current status (StateMachine)
    var events = _events;                                   // Events to commit change to runtime
    var comm;                                               // Interface to OPCUA/S7/.. Device
    var currentCmd = null;                                  // Current Command (StateMachine)
    var deviceCheckStatus = null;                           // TimerInterval to check Device status (connection)
    var devicePolling = null;                               // TimerInterval to polling read device value

    if (data.type === DeviceEnum.S7) {
        comm = S7client.create(data, logger, events);
    } else if (data.type === DeviceEnum.OPCUA) {
        comm = OpcUAclient.create(data, logger, events);
    } else if (data.type === DeviceEnum.ModbusRTU || data.type === DeviceEnum.ModbusTCP) {
        comm = MODBUSclient.create(data, logger, events);        
    } else if (data.type === DeviceEnum.BACnet) {
        comm = BACNETclient.create(data, logger, events);        
    }

    /**
     * Start StateMachine, init and start TimerInterval to check Device status
     */
    this.start = function () {
        currentCmd = DeviceCmdEnum.START;
        if (status === DeviceStatusEnum.INIT) {
            logger.info(property.name + ': ' + currentCmd);
            var self = this;
            this.checkStatus();
            deviceCheckStatus = setInterval(function () {
                self.checkStatus();
            }, DEVICE_CHECK_STATUS_INTERVAL);
        }
    }

    /**
     * Stop StateMachine, Close Device connection, break all TimerInterval (Device status/polling)
     */
    this.stop = function () {
        return new Promise(function (resolve, reject) {
            currentCmd = DeviceCmdEnum.STOP;
            logger.info(property.name + ': ' + currentCmd);
            if (devicePolling) {
                clearInterval(devicePolling);
                devicePolling = null;
            }
            if (deviceCheckStatus) {
                clearInterval(deviceCheckStatus);
                deviceCheckStatus = null;
            }
            comm.disconnect().then(function () {
                status = DeviceStatusEnum.INIT;
                resolve();
            });
        });
    }

    /**
     * Check the Device connection, Reconnect
     */
    this.checkStatus = function () {
        if (status === DeviceStatusEnum.INIT && currentCmd === DeviceCmdEnum.START) {
            this.connect().then(function () {
                status = DeviceStatusEnum.IDLE;
            }).catch(function (err) {
                // devices.woking = null;
            });
        } else if (status === DeviceStatusEnum.IDLE && !comm.isConnected()) {
            status = DeviceStatusEnum.INIT;
            if (devicePolling) {
                clearInterval(devicePolling);
                devicePolling = null;
            }
        }
    }

    /**
     * Call Device to polling
     */
    this.polling = function () {
        comm.polling();
    }

    /**
     * Call Device to connect and start TimerInterval for read value polling
     */
    this.connect = function () {
        var self = this;
        if (data.type === DeviceEnum.ModbusRTU) {
            comm.init(MODBUSclient.ModbusTypes.RTU);
        } else if (data.type === DeviceEnum.ModbusTCP) {
            comm.init(MODBUSclient.ModbusTypes.TCP);
        }
        return comm.connect().then(function () {
            devicePolling = setInterval(function () {
                self.polling();
            }, DEVICE_POLLING_INTERVAL);
        });
    }

    /**
     * Call Device to disconnect 
     */
    this.disconnect = function () {
        return comm.disconnect();
    }

    /**
     * Call Device to load Tags propperty in local for polling read values
     */
    this.load = function (data) {
        return comm.load(data);
    }

    /**
     * Call Device to retrun Tags with values
     */
    this.getValues = function () {
        return comm.getValues();
    }

    /**
     * Call Device to get Tag value with Timestamp
     */
    this.getValue = function (id, value) {
        return comm.getValue(id);
    }

    /**
     * Call Device to return current status
     */
    this.getStatus = function () {
        return comm.getStatus();
    }

    /**
     * Call Device to set Tag value
     */
    this.setValue = function (id, value) {
        return comm.setValue(id, value);
    }

    /**
     * Call Device to return browser result Tags/Nodes (only OPCUA)
     */
    this.browse = function (path) {
        return new Promise(function (resolve, reject) {
            if (data.type === DeviceEnum.OPCUA) {
                comm.browse(path).then(function (result) {
                    resolve(result);
                }).catch(function (err) {
                    reject(err);
                });
            } else if (data.type === DeviceEnum.BACnet) {
                comm.browse(path).then(function (result) {
                    resolve(result);
                }).catch(function (err) {
                    reject(err);
                });
            } else {
                reject('Browse not supported!');
            }
        });
    }

    /**
     * Call Device to return Tag/Node attribute (only OPCUA)
     */
    this.readNodeAttribute = function(node) {
        return new Promise(function (resolve, reject) {
            if (data.type === DeviceEnum.OPCUA) {
                comm.readAttribute(node).then(function (result) {
                    resolve(result);
                }).catch(function (err) {
                    reject(err);
                });
            } else {
                reject('Read Node attribute not supported!');
            }
        });
    }

    /**
     * Call Device to bind the DAQ store function
     */
    this.bindSaveDaqValue = function (fnc) {
        comm.bindAddDaq(fnc, DEVICE_DAQ_MIN_INTERVAL);
        //return comm.addDaq = fnc;
    }

    /**
     * Call Device to return Tag property
     */
    this.getTagProperty = function (id) {
        return comm.getTagProperty(id);
    }

    /**
     * Bind function to ask project stored property (security)
     */
    this.bindGetProperty = function (fnc) {
        if (data.type === DeviceEnum.OPCUA) {
            comm.bindGetProperty(fnc);
        }
    }

    this.load(data);
}

/**
 * Return the property (security mode) supported from device
 * @param {*} endpoint 
 * @param {*} type 
 */
function getSupportedProperty(endpoint, type) {
    return new Promise(function (resolve, reject) {
        if (type === DeviceEnum.OPCUA) {
            OpcUAclient.getEndPoints(endpoint).then(function (result) {
                resolve(result);
            }).catch(function (err) {
                reject(err);
            });
        // } else if (type === DeviceEnum.BACnet) {
        //     BACNETclient.getEndPoints(endpoint).then(function (result) {
        //         resolve(result);
        //     }).catch(function (err) {
        //         reject(err);
        //     });
        } else {
            reject('getSupportedProperty not supported!');
        }
    });
}

module.exports = {
    init: function (settings) {
        // deviceCloseTimeout = settings.deviceCloseTimeout || 15000;
    },
    create: function (data, logger, events) {
        return new Device(data, logger, events);
    },
    getSupportedProperty: getSupportedProperty
}

/**
 * Device type supported
 */
var DeviceEnum = {
    S7: 'SiemensS7',
    OPCUA: 'OPCUA',
    ModbusRTU: 'ModbusRTU',
    ModbusTCP: 'ModbusTCP',
    BACnet: 'BACnet'
}

/**
 * State of StateMachine
 */
var DeviceStatusEnum = {
    INIT: 'init',
    IDLE: 'idle',
    POLLING: 'polling'
}

/**
 * Command of StateMachine
 */
var DeviceCmdEnum = {
    STOP: 'stop',
    START: 'start',
    CONNECT: 'connect'
}