
/**
 * 'runtime': Manager the communication with frontend (socket.io)
 */

var Promise = require('bluebird');
var Events = require('./events');
var events = Events.create();
var devices = require('./devices');
var project = require('./project');
var users = require('./users');
var alarms = require('./alarms');
var notificator = require('./notificator');
var scripts = require('./scripts');
var plugins = require('./plugins');
var utils = require('./utils');
const daqstorage = require('./storage/daqstorage');
var jobs = require('./jobs');

var api;
var settings
var logger;
var io;
var alarmsMgr;
var notificatorMgr;
var scriptsMgr;
var jobsMgr;
var tagsSubscription = new Map();

function init(_io, _api, _settings, _log, eventsMain) {
    io = _io;
    settings = _settings;
    logger = _log;
    api = _api;
    // check runtime init dependency and send to main if ready
    var checkInit = function () {
        if (!events.listenerCount('init-plugins-ok') && !events.listenerCount('init-users-ok') && !events.listenerCount('init-project-ok')) {
            eventsMain.emit('init-runtime-ok');
        }
    }
    events.once('init-plugins-ok', checkInit);
    events.once('init-users-ok', checkInit);
    events.once('init-project-ok', checkInit);


    daqstorage.init(settings, logger);

    plugins.init(settings, logger).then(result => {
        logger.info('runtime init plugins successful!', true);
        events.emit('init-plugins-ok');
    }).catch(function (err) {
        logger.error('runtime.failed-to-init plugins');
    });


    users.init(settings, logger).then(result => {
        logger.info('runtime init users successful!', true);
        events.emit('init-users-ok');
    }).catch(function (err) {
        logger.error('runtime.failed-to-init users');
    });

    project.init(settings, logger).then(result => {
        logger.info('runtime init project successful!', true);
        events.emit('init-project-ok');
    }).catch(function (err) {
        logger.error('runtime.failed-to-init project');
    });
    alarmsMgr = alarms.create(runtime);
    notificatorMgr = notificator.create(runtime);
    scriptsMgr = scripts.create(runtime);
    jobsMgr = jobs.create(runtime);
    devices.init(runtime);

    events.on('project-device:change', updateDevice);
    events.on('device-value:changed', updateDeviceValues);
    events.on('device-status:changed', updateDeviceStatus);
    events.on('alarms-status:changed', updateAlarmsStatus);
    events.on('tag-change:subscription', subscriptionTagChange);
    events.on('script-console', scriptConsoleOutput);

    io.on('connection', async (socket) => {
        logger.info(`socket.io client connected`);        
        socket.tagsClientSubscriptions = [];
        // check authorizations
        if (settings.secureEnabled && !settings.secureOnlyEditor) {
            const token = socket.handshake.query.token;
            if (!token || token === 'null') {
                socket.disconnect();
                logger.error(`Token is missing!`);
            } else {
                try {
                    const authenticated = await api.authJwt.verify(token);
                    if (!authenticated) {
                        logger.error(`Token error!`);
                        socket.disconnect();
                    }
                } catch (error) {
                    logger.error(`Token error: ${error}`);
                    socket.disconnect();
                }
            }
        }
        // client ask device status
        socket.on(Events.IoEventTypes.DEVICE_STATUS, (message) => {
            if (message === 'get') {
                var adevs = devices.getDevicesStatus();
                for (var id in adevs) {
                    updateDeviceStatus({ id: id, status: adevs[id] });
                }
            } else {
                updateDeviceStatus(message);
            }
        });
        // client ask device property
        socket.on(Events.IoEventTypes.DEVICE_PROPERTY, (message) => {
            try {
                if (message && message.endpoint && message.type) {
                    devices.getSupportedProperty(message.endpoint, message.type).then(result => {
                        message.result = result;
                        io.emit(Events.IoEventTypes.DEVICE_PROPERTY, message);
                    }).catch(function (err) {
                        logger.error(`${Events.IoEventTypes.DEVICE_PROPERTY}: ${err}`);
                        message.error = err;
                        io.emit(Events.IoEventTypes.DEVICE_PROPERTY, message);
                    });
                } else {
                    logger.error(`${Events.IoEventTypes.DEVICE_PROPERTY}: wrong message`);
                    message.error = 'wrong message';
                    io.emit(Events.IoEventTypes.DEVICE_PROPERTY, message);
                }
            } catch (err) {
                logger.error(`${Events.IoEventTypes.DEVICE_PROPERTY}: ${err}`);
            }
        });
        // client ask device values
        socket.on(Events.IoEventTypes.DEVICE_VALUES, (message) => {
            try {
                if (message === 'get') {
                    var adevs = devices.getDevicesValues();
                    for (var id in adevs) {
                        updateDeviceValues({ id: id, values: adevs[id] });
                    }
                } else if (message.cmd === 'set' && message.var) {
                    devices.setDeviceValue(message.var.source, message.var.id, message.var.value, message.fnc);
                    // logger.info(`${Events.IoEventTypes.DEVICE_VALUES}: ${message.var.source} ${message.var.id} = ${message.var.value}`);
                }
            } catch (err) {
                logger.error(`${Events.IoEventTypes.DEVICE_VALUES}: ${err}`);
            }
        });
        // client ask device browse
        socket.on(Events.IoEventTypes.DEVICE_BROWSE, (message) => {
            try {
                if (message) {
                    if (message.device) {
                        devices.browseDevice(message.device, message.node, function (nodes) { 
                            io.emit(Events.IoEventTypes.DEVICE_BROWSE, nodes);
                        }).then(result => {
                            message.result = result;
                            io.emit(Events.IoEventTypes.DEVICE_BROWSE, message);
                        }).catch(function (err) {
                            logger.error(`${Events.IoEventTypes.DEVICE_BROWSE}: ${err}`);
                            message.error = err;
                            io.emit(Events.IoEventTypes.DEVICE_BROWSE, message);
                        });
                    }
                }
            } catch (err) {
                logger.error(`${Events.IoEventTypes.DEVICE_BROWSE}: ${err}`);
            }
        });
        // client ask device node attribute
        socket.on(Events.IoEventTypes.DEVICE_NODE_ATTRIBUTE, (message) => {
            try {
                if (message) {
                    if (message.device) {
                        devices.readNodeAttribute(message.device, message.node).then(result => {
                            io.emit(Events.IoEventTypes.DEVICE_NODE_ATTRIBUTE, message);
                        }).catch(function (err) {
                            logger.error(`${Events.IoEventTypes.DEVICE_NODE_ATTRIBUTE}: ${err}`);
                            message.error = err;
                            io.emit(Events.IoEventTypes.DEVICE_NODE_ATTRIBUTE, message);
                        });
                    }
                }
            } catch (err) {
                logger.error(`${Events.IoEventTypes.DEVICE_NODE_ATTRIBUTE}: ${err}`);
            }
        });
        // client query DAQ values
        socket.on(Events.IoEventTypes.DAQ_QUERY, (msg) => {
            try {
                if (msg && msg.from && msg.to && msg.sids && msg.sids.length) {
                    var dbfncs = [];
                    for (let i = 0; i < msg.sids.length; i++) {
                        dbfncs.push(daqstorage.getNodeValues(msg.sids[i], msg.from, msg.to));
                    }
                    Promise.all(dbfncs).then(values => {
                        io.emit(Events.IoEventTypes.DAQ_RESULT, { gid: msg.gid, result: values });
                    }, reason => {
                        if (reason && reason.stack) {
                            logger.error(`${Events.IoEventTypes.DAQ_QUERY}: ${reason.stack}`);
                        } else {
                            logger.error(`${Events.IoEventTypes.DAQ_QUERY}: ${reason}`);
                        }
                        io.emit(Events.IoEventTypes.DAQ_ERROR, { gid: msg.gid, error: reason });
                    });
                }
            } catch (err) {
                logger.error(`${Events.IoEventTypes.DAQ_QUERY}: ${err}`);
            }
        });
        // client ask alarms status
        socket.on(Events.IoEventTypes.ALARMS_STATUS, (message) => {
            if (message === 'get') {
                updateAlarmsStatus();
            }
        });
        // client ask host interfaces
        socket.on(Events.IoEventTypes.HOST_INTERFACES, (message) => {
            try {
                if (message === 'get') {
                    message = {};
                    utils.getHostInterfaces().then(result => {
                        message.result = result;
                        io.emit(Events.IoEventTypes.HOST_INTERFACES, message);
                    }).catch(function (err) {
                        logger.error(`${Events.IoEventTypes.HOST_INTERFACES}: ${err}`);
                        message.error = err;
                        io.emit(Events.IoEventTypes.HOST_INTERFACES, message);
                    });
                } else {
                    logger.error(`${Events.IoEventTypes.HOST_INTERFACES}: wrong message`);
                    message.error = 'wrong message';
                    io.emit(Events.IoEventTypes.HOST_INTERFACES, message);
                }
            } catch (err) {
                logger.error(`${Events.IoEventTypes.HOST_INTERFACES}: ${err}`);
            }
        });
        // client ask device webapi request and return result
        socket.on(Events.IoEventTypes.DEVICE_WEBAPI_REQUEST, (message) => {
            try {
                if (message && message.property) {
                    devices.getRequestResult(message.property).then(result => {
                        message.result = result;
                        io.emit(Events.IoEventTypes.DEVICE_WEBAPI_REQUEST, message);
                    }).catch(function (err) {
                        logger.error(`${Events.IoEventTypes.DEVICE_WEBAPI_REQUEST}: ${err}`);
                        message.error = err;
                        io.emit(Events.IoEventTypes.DEVICE_WEBAPI_REQUEST, message);
                    });
                } else {
                    logger.error(`${Events.IoEventTypes.DEVICE_WEBAPI_REQUEST}: wrong message`);
                    message.error = 'wrong message';
                    io.emit(Events.IoEventTypes.DEVICE_WEBAPI_REQUEST, message);
                }
            } catch (err) {
                logger.error(`${Events.IoEventTypes.DEVICE_WEBAPI_REQUEST}: ${err}`);
            }
        });
        // client ask device tags configurtions, used for connections that load tags dinamically (webapi)
        socket.on(Events.IoEventTypes.DEVICE_TAGS_REQUEST, (message) => {
            try {
                if (message && message.deviceId) {
                    devices.getDeviceTagsResult(message.deviceId).then(result => {
                        message.result = result;
                        io.emit(Events.IoEventTypes.DEVICE_TAGS_REQUEST, message);
                    }).catch(function (err) {
                        logger.error(`${Events.IoEventTypes.DEVICE_TAGS_REQUEST}: ${err}`);
                        message.error = err;
                        io.emit(Events.IoEventTypes.DEVICE_TAGS_REQUEST, message);
                    });
                } else {
                    logger.error(`${Events.IoEventTypes.DEVICE_TAGS_REQUEST}: wrong message`);
                    message.error = 'wrong message';
                    io.emit(Events.IoEventTypes.DEVICE_TAGS_REQUEST, message);
                }
            } catch (err) {
                logger.error(`${Events.IoEventTypes.DEVICE_TAGS_REQUEST}: ${err}`);
            }
        });
        socket.on(Events.IoEventTypes.DEVICE_TAGS_SUBSCRIBE, (message) => {
            try {
                socket.tagsClientSubscriptions = message.tagsId
            } catch (err) {
                logger.error(`${Events.IoEventTypes.DEVICE_TAGS_SUBSCRIBE}: ${err}`);
            }
        });
        socket.on(Events.IoEventTypes.DEVICE_TAGS_UNSUBSCRIBE, (message) => {
            try {
            } catch (err) {
                logger.error(`${Events.IoEventTypes.DEVICE_TAGS_UNSUBSCRIBE}: ${err}`);
            }
        });
    });
}

function start() {
    return new Promise(function (resolve, reject) {
        // load project
        project.load().then(result => {
            // start to comunicate with devices
            devices.start().then(function () {
                resolve(true);
            }).catch(function (err) {
                logger.error('runtime.failed-to-start-devices: ' + err);
                reject();
            });
            // start alarms manager
            alarmsMgr.start().then(function () {
                resolve(true);
            }).catch(function (err) {
                logger.error('runtime.failed-to-start-alarms: ' + err);
                reject();
            });
            // start notificator manager
            notificatorMgr.start().then(function () {
                resolve(true);
            }).catch(function (err) {
                logger.error('runtime.failed-to-start-notificator: ' + err);
                reject();
            });
            // start scripts manager
            scriptsMgr.start().then(function () {
                resolve(true);
            }).catch(function (err) {
                logger.error('runtime.failed-to-start-scripts: ' + err);
                reject();
            });
            // start jobs manager
            jobsMgr.start().then(function () {
                resolve(true);
            }).catch(function (err) {
                logger.error('runtime.failed-to-start-jobs: ' + err);
                reject();
            });            
        }).catch(function (err) {
            logger.error('runtime.failed-to-start: ' + err);
            reject();
        });
    });
}

function stop() {
    return new Promise(function (resolve, reject) {
        devices.stop().then(function () {
        }).catch(function (err) {
            logger.error('runtime.failed-to-stop-devices: ' + err);
        });
        alarmsMgr.stop().then(function () {
        }).catch(function (err) {
            logger.error('runtime.failed-to-stop-alarms: ' + err);
        });
        notificatorMgr.stop().then(function () {
        }).catch(function (err) {
            logger.error('runtime.failed-to-stop-notificatorMgr: ' + err);
        });
        scriptsMgr.stop().then(function () {
        }).catch(function (err) {
            logger.error('runtime.failed-to-stop-scriptsMgr: ' + err);
        });
        jobsMgr.stop().then(function () {
        }).catch(function (err) {
            logger.error('runtime.failed-to-stop-jobsMgr: ' + err);
        });        
        resolve(true);
    });
}

function update(cmd, data) {
    return new Promise(function (resolve, reject) {
        try {
            if (cmd === project.ProjectDataCmdType.SetDevice) {
                devices.updateDevice(data);
                alarmsMgr.reset();
            } else if (cmd === project.ProjectDataCmdType.DelDevice) {
                devices.removeDevice(data);
                alarmsMgr.reset();
            } else if (cmd === project.ProjectDataCmdType.SetAlarm || cmd === project.ProjectDataCmdType.DelAlarm) {
                alarmsMgr.reset();
                notificatorMgr.reset();
            } else if (cmd === project.ProjectDataCmdType.SetNotification || cmd === project.ProjectDataCmdType.DelNotification) {
                notificatorMgr.reset();
            } else if (cmd === project.ProjectDataCmdType.SetScript) {
                scriptsMgr.updateScript(data);
            } else if (cmd === project.ProjectDataCmdType.DelScript) {
                scriptsMgr.removeScript(data);
            } else if (cmd === project.ProjectDataCmdType.SetReport || cmd === project.ProjectDataCmdType.DelReport) {
                jobsMgr.reset();
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

function restart(clear) {
    return new Promise(function (resolve, reject) {
        try {
            stop().then(function () {
                if (clear) {
                    alarmsMgr.clear();
                    notificatorMgr.clear();
                }
                logger.info('runtime.update-project: stopped!', true);
                start().then(function () {
                    logger.info('runtime.update-project: restart!');
                    resolve(true);
                }).catch(function (err) {
                    logger.error('runtime.update-project-start: ' + err);
                    reject();
                });
            }).catch(function (err) {
                logger.error('runtime.update-project-stop: ' + err);
                reject();
            });
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
    try {
        //!TOFIX
        if (settings.broadcastAll === false) {
            Object.values(io.sockets.sockets).forEach((socket) => {
                const tags = Object.values(event.values).filter((tag) => {
                    return socket.tagsClientSubscriptions.includes(tag.id);
                });
                socket.emit(Events.IoEventTypes.DEVICE_VALUES, {
                    id: event.id,
                    values: Object.values(tags)
                });
            });
        } else {
            io.emit(Events.IoEventTypes.DEVICE_VALUES, { 
                id: event.id,
                values: Object.values(event.values) 
            });
        }
        tagsSubscription.forEach((key, value) => {
            if (event.values[value]) {
                events.emit('tag-value:changed', event.values[value]);
            }
        });
    } catch (err) {
    }
}

function subscriptionTagChange(tagid) {
    try {
        tagsSubscription.set(tagid, true);
    } catch (err) {
    }
}

/**
 * Transmit the device status to all frontend
 * @param {*} event
 */
function updateDeviceStatus(event) {
    try {
        io.emit(Events.IoEventTypes.DEVICE_STATUS, event);
    } catch (err) {
    }
}

/**
 * Transmit the alarms status to all frontend
 */
function updateAlarmsStatus() {
    try {
        alarmsMgr.getAlarmsStatus().then(function (result) {
            io.emit(Events.IoEventTypes.ALARMS_STATUS, result);
        }).catch(function (err) {
            if (err) {
                logger.error('runtime.failed-to-update-alarms: ' + err);
            }
        });
    } catch (err) {
        logger.error('runtime.failed-to-update-alarms: ' + err);
    }
}

/**
 * Trasmit the scripts console output
 * @param {*} output 
 */
function scriptConsoleOutput(output) {
    try {
        io.emit(Events.IoEventTypes.SCRIPT_CONSOLE, output);
    } catch (err) {
    }
}

/**
 * Trasmit the scripts command to frontend (clients)
 * @param {*} command
 * @param {*} parameters
 */
 function scriptSendCommand(command) {
    try {
        io.emit(Events.IoEventTypes.SCRIPT_COMMAND, command);
    } catch (err) {
    }
}

var runtime = module.exports = {
    init: init,
    project: project,
    users: users,
    plugins: plugins,
    start: start,
    stop: stop,
    update: update,
    restart: restart,

    get io() { return io },
    get logger() { return logger },
    get settings() { return settings },
    get devices() { return devices },
    get daqStorage() { return daqstorage },
    get alarmsMgr() { return alarmsMgr },
    get notificatorMgr() { return notificatorMgr },
    get scriptsMgr() { return scriptsMgr },
    get jobsMgr() { return jobsMgr },
    events: events,
    scriptSendCommand: scriptSendCommand,
}
