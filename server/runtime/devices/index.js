'use strict';
var Device = require("./device");

var deviceList = [];
var activeDevices = {};
var runtime;
var wokingStatus;

function init(_runtime) {
    runtime = _runtime;
    if (runtime.project) {
        load();
    }
    // init device from settings
}

function start() {
    wokingStatus = 'starting';
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
        devices.load();
        devices.start().then(function () {
            // devices.woking = null;
        }).catch(function (err) {
            console.log('devices start error');
            // devices.woking = null;
        });
    }).catch(function (err) {
        console.log('devices stop error');
        // devices.woking = null;
    });
}

/**
 * Load the device from project and add or remove of active device for the management 
 */
function load() {
    var devices = runtime.project.getDevices();
    activeDevices = {};
    // check existing or to add new 
    for (var id in devices) {
        if (devices[id].enabled) {
            if (activeDevices[id]) {
                // device exist
                activeDevices[id].load(devices[id]);
                runtime.logger.info("device exist: " + devices[id].id);
            } else {
                // device create
                activeDevices[id] = Device.create(devices[id], runtime.logger, runtime.events);
                runtime.logger.info("device created: " + devices[id].id);
            }
        }
    }
    // remove device not used
    for (var id in activeDevices) {
        if (Object.keys(devices).indexOf(id) < 0) {
            runtime.logger.info("device removed: " + devices[id].id);
        }
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

var devices = module.exports = {
    init: init,
    start: start,
    stop: stop,
    load: load,
    update: update,
    getDevicesStatus: getDevicesStatus,
    getDevicesValues: getDevicesValues,
    setDeviceValue: setDeviceValue,
    isWoking: isWoking
}
