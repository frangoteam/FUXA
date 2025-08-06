
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
var socketPool = new Map();
var socketMutex = new Map();

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


    daqstorage.init(settings, logger, runtime);

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

    project.init(settings, logger, runtime).then(result => {
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
        logger.info(`socket.io client connected ${socket.id}`);
        socket.tagsClientSubscriptions = [];
        // check authorizations
        if (settings.secureEnabled && !settings.secureOnlyEditor) {
            var token = socket.handshake.query.token;
            if (!socket.handshake.query.token || socket.handshake.query.token === 'null') {
                token = api.authJwt.getGuestToken();
            }
            try {
                const authenticated = await api.authJwt.verify(token);
                if (!authenticated && token !== api.authJwt.getGuestToken()) {
                    logger.error(`Token is missing!`);
                    socket.disconnect();
                } else {
                    logger.info(`Client connected with ${token === api.authJwt.getGuestToken() ? 'guest access' : 'authenticated token'}`);
                }
            } catch (error) {
                logger.error(`Token error: ${error}`);
                if (token !== api.authJwt.getGuestToken()) {
                    socket.disconnect();
                }
            }
        }

        socket.on('disconnect', (reason) => {
            logger.info('socket.io disconnection:', socket.id, 'reason', reason);
        });

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
                    const TIME_CHUNK_SIZE = 60 * 60 * 1000 * 6; // Dimensione del chunk in millisecondi (ad esempio, 1 ora)
                    const timeChunks = utils.chunkTimeRange(msg.from, msg.to, msg.chunked ? TIME_CHUNK_SIZE : 0);
                    const processChunks = async () => {
                        var counter = 1;
                        for (const chunk of timeChunks) {
                            try {
                                var dbfncs = [];
                                for (let i = 0; i < msg.sids.length; i++) {
                                    dbfncs.push(daqstorage.getNodeValues(msg.sids[i], chunk.start, chunk.end));
                                }
                                const values = await Promise.all(dbfncs);
                                io.emit(Events.IoEventTypes.DAQ_RESULT, {
                                    gid: msg.gid,
                                    result: values,
                                    chunk: {
                                        index: counter++,
                                        of: timeChunks.length
                                    }
                                });
                            } catch (error) {
                                logger.error(`${Events.IoEventTypes.DAQ_QUERY}: ${error.stack || error}`);
                                io.emit(Events.IoEventTypes.DAQ_ERROR, { gid, error });
                                return;
                            }
                        }
                    }
                    processChunks();
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
                if (message.sendLastValue) {
                    var adevs = devices.getDevicesValues();
                    for (var id in adevs) {
                        updateDeviceValues({ id: id, values: adevs[id] });
                    }
                }
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
        socket.on(Events.IoEventTypes.DEVICE_ENABLE, (message) => {
            try {
                devices.enableDevice(message.deviceName, message.enable);
            } catch (err) {
                logger.error(`${Events.IoEventTypes.DEVICE_ENABLE}: ${err}`);
            }
        });
    });

    setInterval(() => {
        io.emit(Events.IoEventTypes.ALIVE, { message: 'FUXA server is alive!' });
    }, 10000);
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
            Array.from(io.sockets.sockets.values()).forEach((socket) => {
                const tags = Object.values(event.values).filter((tag) => {
                    return socket.tagsClientSubscriptions.includes(tag.id);
                });
                socket.emit(Events.IoEventTypes.DEVICE_VALUES, {
                    id: event.id,
                    values: tagsToSend(tags)
                });
            });
        } else {
            io.emit(Events.IoEventTypes.DEVICE_VALUES, {
                id: event.id,
                values: tagsToSend(event.values)
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

function tagsToSend(tags) {
    return Object.values(tags).map(tag => ({
        id: tag.id,
        value: tag.value,
        timestamp: tag.timestamp
    }));
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

/**
 *
 * @param {*} userPermission
 * @param {*} contextPermission script permission could be permission or permissionRoles
 * @param {*} type only for Role enabled and first 8 bitmask
 * @returns true/false
 */
function checkPermissionEnabled(userPermission, contextPermission, type) {
    var admin = (userPermission === -1 || userPermission === 255) ? true : false;
    if (userPermission.info && userPermission.info.roles) {
        if (contextPermission[type]) {
            return userPermission.info.roles.some(role => contextPermission[type].includes(role));
        }
    } else if (admin || (st && (!contextPermission || contextPermission & userPermission))) {
        return true;
    }
}

/**
 * for Role show/enabled or 16 bitmask (0-7 enabled / 8-15 show)
 * @param {*} userPermission
 * @param {*} contextPermission permission could be permission or permissionRoles
 * @param {*} forceUndefined return true if params are undefined/null/0
 * @param {*} onlyWithPermission return true if context.permissionRoles or context.permission are undefined/null/0
 * @returns { show: true/false, enabled: true/false }
 */
function checkPermission(userPermission, context, forceUndefined = false, onlyWithPermission = false) {
    if (!userPermission && !context) {
        // No user and No context
        return { show: forceUndefined || !settings.secureEnabled, enabled: forceUndefined || !settings.secureEnabled };
    }
    if (userPermission === -1 || userPermission === 255 || utils.isNullOrUndefined(context)) {
        // admin
        return { show: true, enabled: true };
    }
    const contextPermission = settings.userRole ? context.permissionRoles : context.permission;
    if (onlyWithPermission && contextPermission === undefined) {
        // No context permission, should be used only to check items
        return { show: true, enabled: true };
    }
    if (settings.userRole) {
        if (userPermission && !contextPermission) {
            return { show: true, enabled: false };
        }
    } else {
        if (userPermission && !context && !contextPermission) {
            return { show: true, enabled: false };
        }
    }
    var result = { show: false, enabled : false };
    if (settings.userRole) {
        if (userPermission && userPermission.info && userPermission.info.roles) {
            let voidRole = { show: true, enabled: true };
            if (contextPermission.show && contextPermission.show.length) {
                result.show = userPermission.info.roles.some(role => contextPermission.show.includes(role));
                voidRole.show = false;
            }
            if (contextPermission.enabled && contextPermission.enabled.length) {
                result.enabled = userPermission.info.roles.some(role => contextPermission.enabled.includes(role));
                voidRole.enabled = false;
            }
            if (voidRole.show && voidRole.enabled) {
                return voidRole;
            }
        } else {
            result.show = contextPermission && contextPermission.show && contextPermission.show.length ? false : true;
            result.enabled = contextPermission && contextPermission.enabled && contextPermission.enabled.length ? false : true;
        }
    } else {
        if (userPermission) {
            var mask = (contextPermission >> 8);
            result.show = (mask) ? mask & userPermission : 1;
            mask = (contextPermission & 255);
            result.enabled = (mask) ? mask & userPermission : 1;
        } else {
            result.show = contextPermission ? false : true;
            result.enabled = contextPermission ? false : true;
        }
    }
    return result;
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
    checkPermissionEnabled: checkPermissionEnabled,
    checkPermission: checkPermission,
    get socketPool() { return socketPool },
    get socketMutex() {return socketMutex }
}
