'use strict';
var Device = require("./device");

var deviceList = [];
var activeDevices = {};
var runtime;
var wokingStatus;

function init(_runtime) {
    runtime = _runtime;
    // if (runtime.project) {
    //     load();
    // }
    // init device from settings
}

function start() {
    wokingStatus = 'starting';
    devices.load();
    return new Promise(function (resolve, reject) {
        runtime.logger.info("devices-start all (" + Object.keys(activeDevices).length + ")");
        // var deviceStartfnc = [];
        for (var id in activeDevices) {
            activeDevices[id].start();
            // deviceStartfnc.push(activeDevices[id].start);
        }
        resolve();
        wokingStatus = null;
    });
}

function stop() {
    wokingStatus = 'stopping';
    return new Promise(function (resolve, reject) {
        runtime.logger.info("devices-stop all (" + Object.keys(activeDevices).length + ")");
        var deviceStopfnc = [];
        for (var id in activeDevices) {
            // activeDevices[id].stop();
            deviceStopfnc.push(activeDevices[id].stop());
        }
        return Promise.all(deviceStopfnc).then(values => {
            console.log(values);
            resolve(true);
            wokingStatus = null;
        }, reason => {
            console.log(reason);
            resolve(reason);
            wokingStatus = null;
        });
    });
}

function update() {
    devices.stop().then(function () {
        devices.start().then(function () {
            // devices.woking = null;
        }).catch(function (err) {
            runtime.logger.error('devices start error');
            // devices.woking = null;
        });
    }).catch(function (err) {
        runtime.logger.error('devices stop error');
        // devices.woking = null;
    });
}

function updateDevice(device) {
    if (!activeDevices[device.name]) {
        devices.loadDevice(device);
        if (device.enabled) {
            activeDevices[device.name].start();
        }
    } else {
        activeDevices[device.name].stop().then(function () {
            devices.loadDevice(device);
            if (device.enabled) {
                activeDevices[device.name].start();
            }
        }).catch(function (err) {
            runtime.logger.error('Update Device ' + device.name + ' stop error');
            // devices.woking = null;
        });
    }
}

/**
 * Load the device from project and add or remove of active device for the management 
 */
function load() {
    var tempdevices = runtime.project.getDevices();
    activeDevices = {};
    runtime.daqStorage.reset();
    // check existing or to add new 
    for (var id in tempdevices) {
        if (tempdevices[id].enabled) {
            devices.loadDevice(tempdevices[id]);
        }
    }
    // log remove device not used
    for (var id in activeDevices) {
        if (Object.keys(tempdevices).indexOf(id) < 0) {
            runtime.logger.info("device removed: " + id);
        }
    }
}

function loadDevice(device) {
    if (activeDevices[device.name]) {
        // device exist
        runtime.logger.info(device.name + ': device exist');
        activeDevices[device.name].load(device);
    } else {
        // device create
        runtime.logger.info(device.name + ': device created');
        activeDevices[device.name] = Device.create(device, runtime.logger, runtime.events);
    }
    if (runtime.settings.daqEnabled) {
        var fncToSaveDaqValue = runtime.daqStorage.addDaqNode(device.name, activeDevices[device.name].getTagProperty);
        activeDevices[device.name].bindSaveDaqValue(fncToSaveDaqValue);
    }
}

function getDevicesStatus() {
    var adev = {};
    for (var id in activeDevices) {
        adev[id] = activeDevices[id].getStatus();
    }
    return adev;
}

function getDevicesValues() {
    var adev = {};
    for (var id in activeDevices) {
        adev[id] = activeDevices[id].getValues();
    }
    return adev;
}

function isWoking() {
    return (wokingStatus) ? true : false;
}

function setDeviceValue(deviceid, sigid, value) {
    if (activeDevices[deviceid]) {
        activeDevices[deviceid].setValue(sigid, value);
    }
}

function browseDevice(deviceid, node) {
    return new Promise(function (resolve, reject) {
        if (activeDevices[deviceid] && activeDevices[deviceid].browse) {
            activeDevices[deviceid].browse(node).then(function (result) {
                resolve(result);
            }).catch(function (err) {
                reject(err);
            });
        } else {
            reject('Device not found!');
        }
    });
}

function readNodeAttribute(deviceid, node) {
    return new Promise(function (resolve, reject) {
        if (activeDevices[deviceid] && activeDevices[deviceid].readNodeAttribute) {
            activeDevices[deviceid].readNodeAttribute(node).then(function (result) {
                resolve(result);
            }).catch(function (err) {
                reject(err);
            });
        } else {
            reject('Device not found!');
        }
    });
}

var devices = module.exports = {
    init: init,
    start: start,
    stop: stop,
    load: load,
    loadDevice: loadDevice,
    update: update,
    updateDevice: updateDevice,
    getDevicesStatus: getDevicesStatus,
    getDevicesValues: getDevicesValues,
    setDeviceValue: setDeviceValue,
    browseDevice: browseDevice,
    readNodeAttribute: readNodeAttribute,
    isWoking: isWoking
}
