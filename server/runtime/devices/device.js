'use strict';

var S7client = require('./s7');
var OpcUAclient = require('./opcua');

var deviceCloseTimeout = 1000;
var DEVICE_CHECK_STATUS_INTERVAL = 5000;
var DEVICE_POLLING_INTERVAL = 1000;

function Device(data, logger, _events) {
    var property = { id: data.id, name: data.name };
    var status = DeviceStatusEnum.INIT;
    var events = _events;
    var comm;
    var currentCmd = null;
    var deviceCheckStatus = null;
    var devicePolling = null;

    if (data.type === DeviceEnum.S7) {
        comm = S7client.create(data, logger, events);
    } else if (data.type === DeviceEnum.OPCUA) {
        comm = OpcUAclient.create(data, logger, events);
    }

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

    this.stop = function () {
        return new Promise(function (resolve, reject) {
            currentCmd = DeviceCmdEnum.STOP;
            logger.info(currentCmd + ': ' + property.name);
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

    this.polling = function () {
        comm.polling();
    }

    this.connect = function () {
        var self = this;
        return comm.connect().then(function () {
            devicePolling = setInterval(function () {
                self.polling();
            }, DEVICE_POLLING_INTERVAL);
        });
    }

    this.disconnect = function () {
        return comm.disconnect();
    }

    this.load = function (data) {
        return comm.load(data);
    }

    this.getValues = function () {
        return comm.getValues();
    }

    this.getStatus = function () {
        return comm.getStatus();
    }

    this.setValue = function (sigid, value) {
        return comm.setValue(sigid, value);
    }

    this.browse = function (path) {
        return new Promise(function (resolve, reject) {
            if (data.type === DeviceEnum.OPCUA) {
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

    this.bindSaveDaqValue = function (fnc) {
        return comm.addDaq = fnc;
    }

    this.getTagProperty = function (id) {
        return comm.getTagProperty(id);
    }

    this.load(data);
}

module.exports = {
    init: function (settings) {
        // deviceCloseTimeout = settings.deviceCloseTimeout || 15000;
    },
    create: function (data, logger, events) {
        return new Device(data, logger, events);
    }
}

var DeviceEnum = {
    S7: "SiemensS7",
    OPCUA: "OPCUA"
}

var DeviceStatusEnum = {
    INIT: "init",
    IDLE: "idle",
    POLLING: "polling"
}

var DeviceCmdEnum = {
    STOP: 'stop',
    START: 'start',
    CONNECT: 'connect'
}