/*
* Script manager: check and run scheduled script, run script call from frontend
*/

'use strict';

var SCRIPT_CHECK_STATUS_INTERVAL = 1000;

function ScriptsManager(_runtime) {
    var runtime = _runtime;
    var events = runtime.events;        // Events to commit change to runtime
    var settings = runtime.settings;    // Settings
    var logger = runtime.logger;        // Logger
    var scriptsCheckStatus = null;      // TimerInterval to check scripts manager status
    var working = false;                // Working flag to manage overloading of check notificator status
    // var notificationsSubsctiption = {}; // Notifications matrix, grupped by subscriptions type
    var status = ScriptsStatusEnum.INIT;// Current status (StateMachine)
    // var clearNotifications = false;     // Flag to clear current notifications from DB
    var lastCheck = 0;                  // Timestamp to check intervall only in IDLE
    // var subscriptionStatus = {};        // Status of subscription, to check if there are some change
    // var notificationsFound = 0;         // Notifications found to check 

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
        this.clear();
        status = ScriptsStatusEnum.LOAD;
    }

    this.updateScript = function (script) {

    }

    this.removeScript = function (script) {

    }
    
    // this.clear = function () {
    //     clearNotifications = true;
    // }

    // this.clearNotifications = function (all) {
    //     return new Promise(function (resolve, reject) {
    //         resolve();
    //         // notifystorage.clearNotifications(all).then((result) => {
    //         //     resolve(true);
    //         // }).catch(function (err) {
    //         //     reject(err);
    //         // });
    //     });
    // }

    // this.forceCheck = function () {
    //     lastCheck = 0;
    //     _checkStatus();
    // }

    /**
     * Run script, <script> {id, name, parameters: <ScriptParam> {name, type: <ScriptParamType>[tagid, value], value: any} }
     * @returns 
     */
    this.runScript = function (script) {
        return new Promise(async function (resolve, reject) {
            try {
                resolve(`Script OK: ${script.name}`);
            } catch (err) {
                reject(err);
            }
        });
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
                    _loadScripts().then(function () {
                        status = ScriptsStatusEnum.IDLE;
                        _checkWorking(false);
                    }).catch(function (err) {
                        _checkWorking(false);
                    });
                }).catch(function (err) {
                    _checkWorking(false);
                });
            }
        } else if (status === ScriptsStatusEnum.IDLE) {
            // if (notificationsFound) {
            //     var current = new Date().getTime();
            //     if (current - lastCheck > NOTIFY_CHECK_STATUS_INTERVAL) {
            //         lastCheck = current;
            //         if (_checkWorking(true)) {
            //             _checkNotifications().then(function () {
            //                 _checkWorking(false);
            //             }).catch(function (err) {
            //                 _checkWorking(false);
            //             });
            //         }
            //     }
            // }
        }
    }

    /**
     * Init Scripts manager
     */
    var _init = function () {
        return new Promise(function (resolve, reject) {
            resolve();
            // notifystorage.init(settings, logger).then(result => {
            //     logger.info('notificator.notifystorage-init-successful!', true);
            //     resolve();
            // }).catch(function (err) {
            //     logger.error('notificator.notifystorage.failed-to-init: ' + err);
            //     reject(err);
            // });
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
            notificationsSubsctiption = {};
            notificationsFound = 0;
            runtime.project.getScripts().then(function (result) {
                // if (result) {
                //     result.forEach(notification => {
                //         if (notification.enabled) {
                //             Object.keys(notification.subscriptions).forEach(sub => {
                //                 if (notification.subscriptions[sub]) {
                //                     if (!notificationsSubsctiption[sub]) {
                //                         notificationsSubsctiption[sub] = [];
                //                     }
                //                     var temp = new Notification(notification.id, notification.name, notification.type);
                //                     temp.receiver = notification.receiver;
                //                     temp.delay = notification.delay;
                //                     temp.interval = notification.interval;
                //                     temp.enabled = notification.enabled;
                //                     temp.text = notification.text;
                //                     temp.subscriptions = notification.subscriptions;
                //                     temp.options = notification.options;
                //                     notificationsSubsctiption[sub].push(temp);
                //                     notificationsFound++;
                //                 }
                //             });
                //         }
                //     });
                // }
                resolve();
            }).catch(function (err) {
                reject(err);
            });
        });
    }

    // // check if alarms status chenaged
    // events.on('alarms-status:changed', this.forceCheck);
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