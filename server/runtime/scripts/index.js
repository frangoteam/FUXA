/*
* Script manager: check and run scheduled script, run script call from frontend
*/

'use strict';

const MyScriptModule = require('./msm');
const nodeSchedule = require('node-schedule');
const utils = require('../utils');

var SCRIPT_CHECK_STATUS_INTERVAL = 1000;

function ScriptsManager(_runtime) {
    var runtime = _runtime;
    var events = runtime.events;        // Events to commit change to runtime
    var settings = runtime.settings;    // Settings
    var logger = runtime.logger;        // Logger
    var scriptsCheckStatus = null;      // TimerInterval to check scripts manager status
    var working = false;                // Working flag to manage overloading of check notificator status
    var status = ScriptsStatusEnum.INIT;// Current status (StateMachine)
    var lastCheck = 0;                  // Timestamp to check intervall only in IDLE
    var schedulingMap = {};             // Mapped script mit scheduling
    var scriptModule = MyScriptModule.create(events, logger);

    /**
     * Start TimerInterval to check Scripts
     */
    this.start = function () {
        return new Promise(function (resolve, reject) {
            logger.info('scripts.start-checkstatus', true);
            scriptsCheckStatus = setInterval(function () {
                _checkStatus();
            }, SCRIPT_CHECK_STATUS_INTERVAL);
        });
    }

    /**
     * Stop StateMachine, break TimerInterval (_checkStatus)
     */
    this.stop = function () {
        return new Promise(function (resolve, reject) {
            logger.info('scripts.stop-checkstatus!', true);
            if (scriptsCheckStatus) {
                clearInterval(scriptsCheckStatus);
                scriptsCheckStatus = null;
                status = ScriptsStatusEnum.INIT;
                working = false;
            }
            resolve();
        });
    }

    this.reset = function () {
        // this.clear();
        status = ScriptsStatusEnum.LOAD;
    }

    this.updateScript = function (script) {
        this.reset();
    }

    this.removeScript = function (script) {
        this.reset();
    }

    /**
     * Run script, <script> {id, name, parameters: <ScriptParam> {name, type: <ScriptParamType>[tagid, value], value: any} }
     * @returns
     */
    this.runScript = function (script) {
        return new Promise(async function (resolve, reject) {
            try {
                if (script.test) {
                    const result = await scriptModule.runTestScript(script);
                    resolve(result !== null ? result : `Script OK: ${script.name}`);
                } else {
                    if (!script.notLog) {
                        logger.info(`Run script ${script.name}`);
                    }
                    const result = await scriptModule.runScript(script);
                    resolve(result);
                }
            } catch (err) {
                reject(err);
            }
        });
    }

    this.isAuthorised = function (_script, groups) {
        try {
            const st = scriptModule.getScript(_script);
            var admin = (groups === -1 || groups === 255) ? true : false;
            if (admin || (st && (!st.permission || st.permission & groups))) {
                return true;
            }
        } catch (err) {
            logger.error(err);
        }
        return false;
    }

    this.sysFunctionExist = (functionName) => {
        const sysFncs = _getSystemFunctions();
        return !!sysFncs[functionName];
    }

    this.runSysFunction = (functionName, params) => {
        return scriptModule.runSysFunction(functionName, params);
    }

    /**
     * Check the Scripts state machine
     */
    var _checkStatus = function () {
        if (status === ScriptsStatusEnum.INIT) {
            if (_checkWorking(true)) {
                _init().then(function () {
                    status = ScriptsStatusEnum.LOAD;
                    _checkWorking(false);
                }).catch(function (err) {
                    _checkWorking(false);
                });
            }
        } else if (status === ScriptsStatusEnum.LOAD) {
            if (_checkWorking(true)) {
                _loadProperty().then(function () {
                    _checkWorking(false);
                    status = ScriptsStatusEnum.IDLE;
                }).catch(function (err) {
                    _checkWorking(false);
                });
            }
        } else if (status === ScriptsStatusEnum.IDLE) {
            const time = new Date().getTime();
            Object.keys(schedulingMap).forEach((name) => {
                const script = schedulingMap[name];
                if (script.isToRun(time)) {
                    try {
                        scriptModule.runScriptWithoutParameter(script);
                        script.lastRun = time;
                    } catch (err) {
                        if (err.message) {
                            logger.error(err.message);
                        } else {
                            logger.error(err);
                        }
                    }
                }
            });
        }
    }

    /**
     * Init Scripts manager
     */
    var _init = function () {
        return new Promise(function (resolve, reject) {
            try {
                scriptModule.init(_getSystemFunctions());
                resolve();
            } catch (err) {
                logger.error(err);
            }
        });
    }

    var _checkWorking = function (check) {
        if (check && working) {
            logger.warn('scripts manager working (check) overload!');
            return false;
        }
        working = check;
        return true;
    }

    /**
     * Load Scripts property in local for check
     */
    var _loadProperty = function () {
        return new Promise(function (resolve, reject) {
            schedulingMap = {};
            try {
                nodeSchedule.gracefulShutdown();
            } catch (e) {
                logger.error(e);
            }
            runtime.project.getScripts().then((scripts) => {
                if (scripts) {
                    var lr = scriptModule.loadScripts(scripts);
                    Object.values(scripts).forEach((script) => {
                        if (script.scheduling) {
                            const scriptSchedule = new ScriptSchedule(script);
                            if (script.scheduling.interval && script.mode != 'CLIENT') {
                                schedulingMap[script.name] = scriptSchedule;
                            } else if (script.scheduling.mode === ScriptSchedulingMode.scheduling) {
                                try {
                                    scriptSchedule.getScheduleRules().forEach((scheduleRule) => {
                                        logger.info(`Load script-schedule ${script.name} - ${JSON.stringify(scheduleRule)}`);
                                        nodeSchedule.scheduleJob(scheduleRule, function() {
                                            scriptModule.runScriptWithoutParameter(script);
                                        });
                                    });
                                } catch (er) {
                                    logger.error(er);
                                }
                            }
                        }
                    });
                    resolve(lr.messages);
                } else {
                    resolve();
                }
            }).catch(function (err) {
                reject(err);
            });
        });
    }

    var _getSystemFunctions = function () {
        var sysFncs = {};
        sysFncs['$getTag'] = runtime.devices.getTagValue;
        sysFncs['$setTag'] = runtime.devices.setTagValue;
        sysFncs['$getTagId'] = runtime.devices.getTagId;
        sysFncs['$setView'] = _setCommandView;
        sysFncs['$enableDevice'] = runtime.devices.enableDevice;
        sysFncs['$getDevice'] = runtime.devices.getDevice;
        sysFncs['$getTagDaqSettings'] = runtime.devices.getTagDaqSettings;
        sysFncs['$setTagDaqSettings'] = runtime.devices.setTagDaqSettings;
        sysFncs['$getDeviceProperty'] = runtime.devices.getDeviceProperty;
        sysFncs['$setDeviceProperty'] = runtime.devices.setDeviceProperty;
        sysFncs['$getHistoricalTags'] = runtime.devices.getHistoricalTags;

        return sysFncs;
    }

    var _setCommandView = function (view, force) {
        let command = { command: ScriptCommandEnum.SETVIEW, params: [view, force] };
        runtime.scriptSendCommand(command);
    }
}

module.exports = {
    create: function (runtime) {
        return new ScriptsManager(runtime);
    }
}

/**
 * State of Scripts manager
 */
const ScriptsStatusEnum = {
    INIT: 'init',
    LOAD: 'load',
    IDLE: 'idle',
}

function ScriptSchedule(script) {
    this.id = script.id;
    this.name = script.name;
    this.scheduling = script.scheduling;
    this.lastRun = 0;
    this.created = new Date().getTime();

    this.isToRun = function(time) {
        if (this.scheduling.mode === ScriptSchedulingMode.start) {
            return !this.lastRun && (time - this.created > this.scheduling.interval * 1000);
        } else if (this.scheduling.mode !== ScriptSchedulingMode.scheduling) {
            return (time - this.lastRun > this.scheduling.interval * 1000);
        }
    }

    this.getScheduleRules = function() {
        let result = [];
        if (this.scheduling.schedules) {
            this.scheduling.schedules.forEach(schedule => {

                if (schedule.type === SchedulerType.date && schedule.date) {
                    var date = new Date(schedule.date);
                    if (schedule.time) {
                        const [hour, minute, seconds] = schedule.time.split(':');
                        if (hour) date.setHours(hour);
                        if (minute) date.setMinutes(minute);
                        if (seconds) date.setSeconds(seconds);
                    }
                    result.push(date);
                } else {
                    const rule = new nodeSchedule.RecurrenceRule();
                    if (!utils.isNullOrUndefined(schedule.hour)) rule.hour = schedule.hour;
                    if (!utils.isNullOrUndefined(schedule.minute)) rule.minute = schedule.minute;
                    if (schedule.days) {
                        rule.dayOfWeek = [];
                        if (schedule.days.includes('sun')) rule.dayOfWeek.push(0);
                        if (schedule.days.includes('mon')) rule.dayOfWeek.push(1);
                        if (schedule.days.includes('tue')) rule.dayOfWeek.push(2);
                        if (schedule.days.includes('wed')) rule.dayOfWeek.push(3);
                        if (schedule.days.includes('thu')) rule.dayOfWeek.push(4);
                        if (schedule.days.includes('fri')) rule.dayOfWeek.push(5);
                        if (schedule.days.includes('sat')) rule.dayOfWeek.push(6);
                    }
                    result.push(rule);
                }
            });
        }
        return result;
    }
}

const ScriptCommandEnum = {
    SETVIEW: 'SETVIEW',
}

const ScriptSchedulingMode = {
    interval: 'interval',
    start: 'start',
    scheduling: 'scheduling',
}

const SchedulerType = {
    weekly: 0,
    date: 1,
}