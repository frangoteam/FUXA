/*
* Script manager: check and run scheduled script, run script call from frontend
*/

'use strict';

const MyScriptModule = require('./msm');

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
                    scriptModule.runTestScript(script);
                } else {
                    logger.info(`Run script ${script.name}`);
                    scriptModule.runScript(script);
                }
                // this.runtime.project.getScripts();
                resolve(`Script OK: ${script.name}`);
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
            scriptModule.init(_getSystemFunctions());
            resolve();
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
            runtime.project.getScripts().then((scripts) => {
                if (scripts) {
                    var lr = scriptModule.loadScripts(scripts);
                    Object.values(scripts).forEach((script) => {
                        if (script.scheduling && script.scheduling.interval) {
                            schedulingMap[script.name] = new ScriptSchedule(script);
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
        return sysFncs;
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
var ScriptsStatusEnum = {
    INIT: 'init',
    LOAD: 'load',
    IDLE: 'idle',
}

function ScriptSchedule(script) {
    this.id = script.id;
    this.name = script.name;
    this.scheduling = script.scheduling;
    this.lastRun = 0;

    this.isToRun = function(time) {
        return (time - this.lastRun > this.scheduling.interval * 1000);
    }
}