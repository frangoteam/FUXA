
/**
 * 'runtime': Manager the communication with frontend (socket.io)
 */

var Promise = require('bluebird');
var devices = require("./devices");
var project = require("./project");
var events = require("./events");
const daqstorage = require('./storage/daqstorage');

var apiDevice;
var settings
var logger;
var io;

function init(_io, _api, _settings, log) {
    io = _io;
    settings = _settings;
    logger = log;
    if (!project.init(settings, logger)) {
        logger.error("runtime.failed-to-init");
    }
    if (!daqstorage.init(settings, logger)) {
        logger.error("daqstorage.failed-to-init");
    }

    events.on("project:change", updateProject);
    events.on("project-device:change", updateDevice);
    events.on("device-value:changed", updateDeviceValues);
    events.on("device-status:changed", updateDeviceStatus);

    if (_api) {
        apiDevice = _api;
    }
    devices.init(runtime);
    logger.info("runtime init successful!");

    io.on('connection', (socket) => {
        logger.info('io client connected');

        // client ask device status
        socket.on('device-status', (message) => {
            if (message === 'get') {
                var adevs = devices.getDevicesStatus();
                for (var id in adevs) {
                    updateDeviceStatus({ id: id, status: adevs[id] });
                }
            } else {
                updateDeviceStatus(message);
            }
        });
        // client ask device values
        socket.on('device-values', (message) => {
            try {
                if (message === 'get') {
                    var adevs = devices.getDevicesValues();
                    for (var id in adevs) {
                        updateDeviceValues({ id: id, values: adevs[id] });
                    }
                } else if (message.cmd === 'set' && message.var) {
                    devices.setDeviceValue(message.var.source, message.var.name, message.var.value)
                }
            } catch (err) {
                logger.error('socket.on:device-values error: ' + err);
            }
        });
        // client ask device browse
        socket.on('device-browse', (message) => {
            try {
                if (message) {
                    if (message.device) {
                        devices.browseDevice(message.device, message.node).then(result => {
                            message.result = result;
                            io.emit("device-browse", message);
                        }).catch(function (err) {
                            logger.error('devices browse error: ' + err);
                            message.error = err;
                            io.emit("device-browse", message);
                        });
                    }
                }
            } catch (err) {
                logger.error('socket.on:device-values error: ' + err);
            }
        });
        // client ask device node attribute
        socket.on('device-node-attribute', (message) => {
            try {
                if (message) {
                    if (message.device) {
                        devices.readNodeAttribute(message.device, message.node).then(result => {
                            // message.result = result;
                            io.emit("device-node-attribute", message);
                        }).catch(function (err) {
                            logger.error('device node attribute error: ' + err);
                            message.error = err;
                            io.emit("device-node-attribute", message);
                        });
                    }
                }
            } catch (err) {
                logger.error('socket.on:device-values error: ' + err);
            }
        });
        // client query DAQ values
        socket.on('daq-query', (msg) => {
            try {
                if (msg && msg.from && msg.to && msg.sids && msg.sids.length) {
                    console.log('>' + new Date(msg.from).toString() + ' ' + new Date(msg.to).toString());
                    var dbfncs = [];
                    for (let i = 0; i < msg.sids.length; i++) {
                        let tks = msg.sids[i].split('^~^');
                        dbfncs.push(daqstorage.getNodeValues(tks[0], tks[1], msg.from, msg.to));
                    }
                    var result = {};
                    Promise.all(dbfncs).then(values => {
                        for (var x = 0; x < values.length; x++) {
                            for (var y = 0; y < values[x].length; y++) {
                                if (!result[values[x][y].dt]) {
                                    result[values[x][y].dt] = Array(msg.sids.length + 1).fill(null);
                                    result[values[x][y].dt][0] = values[x][y].dt;
                                } 
                                result[values[x][y].dt][x + 1] = values[x][y].value;
                            }
                        }
                        let res = []
                        Object.keys(result).sort().forEach(k => {
                            res.push(result[k]);
                        });
                        io.emit('daq-result', {gid: msg.gid, values: res });
                    }, reason => {
                        if (reason.stack) {
                            logger.error('getDaqValue error: ' + reason.stack);
                        } else {
                            logger.error('getDaqValue error: ' + reason);
                        }
                        reject(reason);
                    });
                }
            } catch (err) {
                logger.error('socket.on:daq-query error: ' + err);
            }
        });
    });
}

function start() {
    return new Promise(function (resolve, reject) {
        // check to start
        devices.start().then(function () {
            // devices.woking = null;
        }).catch(function (err) {
            logger.error('devices start error: ' + err);
        });
        resolve(true);
    });
}

function stop() {
    return new Promise(function (resolve, reject) {
        devices.stop().then(function () {

        }).catch(function (err) {
            logger.error('devices stop error: ' + err);
        });
        resolve(true);
    });
}

function updateProject(event) {
    return new Promise(function (resolve, reject) {
        try {
            if (devices.isWoking()) {
                reject();
            }
            var changed = project.updateProject();
            if (changed === true) { // reset all
                devices.update();
            } else {
                for (var id in project.getDevices()) {
                    // manage: to remove, to update, to add
                    events.emit("project-device:change", { id: id, retain: true });
                }
            }
            resolve(true);
        } catch (err) {
            if (err.stack) {
                logger.error(err.stack);
            } else {
                logger.error(err);
            }
            reject();
        }
    });
}


function updateDevice(event) {
    console.log('emit updateDevice: ' + event);
}

/**
 * Transmit the device values to all frontend
 * @param {*} event 
 */
function updateDeviceValues(event) {
    // console.log('emit updateDeviceValues: ' + event);
    try {
        let values = Object.values(event.values);
        io.emit('device-values', { id: event.id, values: values });
    } catch (err) {
    }
}

/**
 * Transmit the device status to all frontend
 * @param {*} event 
 */
function updateDeviceStatus(event) {
    // console.log('emit updateDeviceStatus: ' + event);
    try {
        io.emit('device-status', event);
    } catch (err) {
    }
}

var runtime = module.exports = {
    init: init,
    project: project,
    start: start,
    stop: stop,

    get io() { return io },
    get logger() { return logger },
    get settings() { return settings },
    get daqStorage() { return daqstorage },
    events: events,
    updateProject: updateProject

}