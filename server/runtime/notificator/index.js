/*
* Notificator manager: check, save, send mails to notificate alarms, events
*/

'use strict';
const nodemailer = require('nodemailer');
const notifystorage = require('./notifystorage');

var NOTIFY_CHECK_STATUS_INTERVAL = 1000 * 6;

function NotificatorManager(_runtime) {
    var runtime = _runtime;
    var events = runtime.events;        // Events to commit change to runtime
    var settings = runtime.settings;    // Settings
    var logger = runtime.logger;        // Logger
    var notifyCheckStatus = null;       // TimerInterval to check Notificator status
    var working = false;                // Working flag to manage overloading of check notificator status
    var notificationsSubsctiption = {}; // Notifications matrix, grupped by subscriptions type
    var notificationsProperty = {};     // Notifications property property list, key = notification.id
    var status = NotifyStatusEnum.INIT; // Current status (StateMachine)
    var clearNotifications = false;     // Flag to clear current notifications from DB
    var lastCheck = 0;                  // Timestamp to check intervall only in IDLE
    var subscription
    /**
     * Start TimerInterval to check Notifications
     */
     this.start = function () {
        return new Promise(function (resolve, reject) {
            logger.info('notificator check start', true);
            notifyCheckStatus = setInterval(function () {
                _checkStatus();
            }, 10000);
        });
    }

    /**
     * Stop StateMachine, break TimerInterval (_checkStatus)
     */
     this.stop = function () {
        return new Promise(function (resolve, reject) {
            logger.info('notificator.stop-checkstatus!', true);
            if (notifyCheckStatus) {
                clearInterval(notifyCheckStatus);
                notifyCheckStatus = null;
                status = NotifyStatusEnum.INIT;
                working = false;
            }
            resolve();
        });
    }

    this.reset = function () {
        this.clear();
        status = NotifyStatusEnum.LOAD;
    }

    this.clear = function () {
        clearNotifications = true;
    }

    this.clearNotifications = function (all) {
        return new Promise(function (resolve, reject) {
            notifystorage.clearNotifications(all).then((result) => {
                resolve(true);
            }).catch(function (err) {
                reject(err);
            });
        });
    }

    /**
     * Check the Notify state machine
     */
    var _checkStatus = function () {
        if (status === NotifyStatusEnum.INIT) {
            if (_checkWorking(true)) {
                _init().then(function () {
                    status = NotifyStatusEnum.LOAD;
                    _checkWorking(false);
                }).catch(function (err) {
                    _checkWorking(false);
                });
            }
        } else if (status === NotifyStatusEnum.LOAD) {
            if (_checkWorking(true)) {
                _loadProperty().then(function () {
                    _loadNotifications().then(function () {
                        status = NotifyStatusEnum.IDLE;
                        _checkWorking(false);
                    }).catch(function (err) {
                        _checkWorking(false);
                    });
                }).catch(function (err) {
                    _checkWorking(false);
                });
            }
        } else if (status === NotifyStatusEnum.IDLE) {
            var current = new Date().getTime();
            if (current - lastCheck > NOTIFY_CHECK_STATUS_INTERVAL) {
                lastCheck = current;
                if (_checkWorking(true)) {
                    _checkNotifications().then(function () {
                        _checkWorking(false);
                    }).catch(function (err) {
                        _checkWorking(false);
                    });
                }
            }
        }        
    }

    /**
     * Init Notificator database
     */
     var _init = function () {
        return new Promise(function (resolve, reject) {
            notifystorage.init(settings, logger).then(result => {
                logger.info('notificator.notifystorage-init-successful!', true);
                resolve();
            }).catch(function (err) {
                logger.error('notificator.notifystorage.failed-to-init: ' + err);
                reject(err);
            });
        });
    }

    var _checkWorking = function (check) {
        if (check && working) {
            logger.warn('notificator working (check) overload!');
            return false;
        }
        working = check;
        return true;
    }

    /**
     * Load Notifications property in local for check
     */
    var _loadProperty = function () {
        return new Promise(function (resolve, reject) {
            notificationsSubsctiption = {};
            notificationsProperty = {};
            runtime.project.getNotifications().then(function (result) {
                var notificationsFound = 0;
                if (result) {
                    result.forEach(notification => {
                        if (notification.enabled) {
                            Object.keys(notification.subscriptions).forEach(sub => {
                                if (notification.subscriptions[sub]) {
                                    if (!notificationsSubsctiption[sub]) {
                                        notificationsSubsctiption[sub] = [];
                                    }
                                    notificationsSubsctiption[sub].push(notification);
                                }
                            });
                        }
                    });
                }
                resolve();
            }).catch(function (err) {
                reject(err);
            });
        });
    }


    /**
     * Load current Notifications and merge with loaded property
     */
    var _loadNotifications = function () {
        return new Promise(function (resolve, reject) {
            if (clearNotifications) {
                notifystorage.clearNotifications().then(result => {
                    resolve();
                    clearNotifications = false;
                }).catch(function (err) {
                    logger.error('notificator.clear-current.failed: ' + err);
                    reject(err);
                });
            } else {
                notifystorage.getNotifications().then(result => {
                    Object.keys(notificationsSubsctiption).forEach(subkey => {
                        notificationsSubsctiption[subkey].forEach(notification => {
                            var currentNotify = result.find(currentNotify => currentNotify.id === notification.id);
                            if (currentNotify) {
                                notification.ontime = currentNotify.ontime;
                                notification.notifytime = currentNotify.notifytime;
                            }
                        });
                    });
                    resolve();
                }).catch(function (err) {
                    logger.error('notificator.load-current.failed: ' + err);
                    reject(err);
                });
            }
        });
    }

    /**
     * Check Notifications status
     */
     var _checkNotifications = function () {
        return new Promise(function (resolve, reject) {

            var time = new Date().getTime();
            var changed = [];
            runtime.alarmsMgr.getAlarmsStatus().then(alarmsStatus => {
                Object.keys(alarmsStatus).forEach(stkey => {
                    console.log(stkey);
                    if (alarmsStatus[stkey] && notificationsSubsctiption[stkey]) {

                    }
                });
                resolve(true);
            }).catch(function (err) {
                reject(err);
            });
        });
    }

    /**
     * Send mail
     * @returns 
     */
    this.sendMail = function (msg, smtp) {
        return new Promise(async function (resolve, reject) {
            try {
                var smtpServer = smtp || settings.smtp;
                if (smtpServer && smtpServer.host && smtpServer.port && smtpServer.username && smtpServer.password) {
                    const transporter = nodemailer.createTransport({ 
                        host: smtp.host, 
                        port: smtpServer.port,
                        secure: (smtpServer.port === 465) ? true : false, // true for 465, false for other ports
                        auth: {
                            user: smtpServer.username,
                            pass: smtpServer.password
                        }
                    });
                    let info = await transporter.sendMail(msg);
                    console.log(info.messageId);
                    resolve(`Message sent: ${info.messageId}`);
                } else {
                    reject('SMTP data error!');
                }                
            } catch (err) {
                reject(err);
            }
        });
    }
}

module.exports = {
    create: function (runtime) {
        return new NotificatorManager(runtime);
    }
}

/**
 * State of Notificator manager
 */
 var NotifyStatusEnum = {
    INIT: 'init',
    LOAD: 'load',
    IDLE: 'idle',
}

function Notification(id, name, type) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.receiver;
    this.delay = 1;
    this.interval = 0;
    this.ontime = 0;
    this.notifytime = 0;
    this.enabled = true;
    this.text;
    this.subscriptions = {};
    this.options;

    this.hasSubscriptions = function () {
        return Object.keys(this.subscriptions).length ? true : false;
    }
}

function MailMessage(from, to, subj, text, html) {
    this.from = from;
    this.to = to;
    this.subject = subj;
    this.text = text;
    this.html = html;
}