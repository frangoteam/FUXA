/*
* Notificator manager: check, save, send mails to notificate alarms, events
*/

'use strict';
const nodemailer = require('nodemailer');
// const notifystorage = require('./notifystorage');

var NOTIFY_CHECK_STATUS_INTERVAL = 1000 * 60;
var MILLI_MINUTE = 60000;

function NotificatorManager(_runtime) {
    var runtime = _runtime;
    var events = runtime.events;        // Events to commit change to runtime
    var settings = runtime.settings;    // Settings
    var logger = runtime.logger;        // Logger
    var notifyCheckStatus = null;       // TimerInterval to check Notificator status
    var working = false;                // Working flag to manage overloading of check notificator status
    var notificationsSubsctiption = {}; // Notifications matrix, grupped by subscriptions type
    var status = NotifyStatusEnum.INIT; // Current status (StateMachine)
    var clearNotifications = false;     // Flag to clear current notifications from DB
    var lastCheck = 0;                  // Timestamp to check intervall only in IDLE
    var subscriptionStatus = {};        // Status of subscription, to check if there are some change
    var notificationsFound = 0;         // Notifications found to check 

    /**
     * Start TimerInterval to check Notifications
     */
    this.start = function () {
        return new Promise(function (resolve, reject) {
            logger.info('notificator check start', true);
            notifyCheckStatus = setInterval(function () {
                _checkStatus();     // check in 20 seconds interval
            }, 20000);
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
            resolve();
            // notifystorage.clearNotifications(all).then((result) => {
            //     resolve(true);
            // }).catch(function (err) {
            //     reject(err);
            // });
        });
    }

    this.forceCheck = function () {
        lastCheck = 0;
        _checkStatus();
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
            if (notificationsFound) {
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
    }

    /**
     * Init Notificator database
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
            notificationsFound = 0;
            runtime.project.getNotifications().then(function (result) {
                if (result) {
                    result.forEach(notification => {
                        if (notification.enabled) {
                            Object.keys(notification.subscriptions).forEach(sub => {
                                if (notification.subscriptions[sub]) {
                                    if (!notificationsSubsctiption[sub]) {
                                        notificationsSubsctiption[sub] = [];
                                    }
                                    var temp = new Notification(notification.id, notification.name, notification.type);
                                    temp.receiver = notification.receiver;
                                    temp.delay = notification.delay;
                                    temp.interval = notification.interval;
                                    temp.enabled = notification.enabled;
                                    temp.text = notification.text;
                                    temp.subscriptions = notification.subscriptions;
                                    temp.options = notification.options;
                                    notificationsSubsctiption[sub].push(temp);
                                    notificationsFound++;
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
            resolve();
            // if (clearNotifications) {
            //     notifystorage.clearNotifications().then(result => {
            //         resolve();
            //         clearNotifications = false;
            //     }).catch(function (err) {
            //         logger.error('notificator.clear-current.failed: ' + err);
            //         reject(err);
            //     });
            // } else {
            //     notifystorage.getNotifications().then(result => {
            //         Object.keys(notificationsSubsctiption).forEach(subkey => {
            //             notificationsSubsctiption[subkey].forEach(notification => {
            //                 var currentNotify = result.find(currentNotify => currentNotify.id === notification.id);
            //                 if (currentNotify) {
            //                     notification.ontime = currentNotify.ontime;
            //                     notification.notifytime = currentNotify.notifytime;
            //                 }
            //             });
            //         });
            //         resolve();
            //     }).catch(function (err) {
            //         logger.error('notificator.load-current.failed: ' + err);
            //         reject(err);
            //     });
            // }
        });
    }

    /**
     * Check Notifications status
     */
    var _checkNotifications = function () {
        return new Promise(function (resolve, reject) {
            var time = new Date().getTime();
            // check alarms categorie subscriptions
            runtime.alarmsMgr.getAlarmsStatus().then(alarmsStatus => {
                Object.keys(alarmsStatus).forEach(stkey => {
                    if (alarmsStatus[stkey]) {
                        if ((notificationsSubsctiption[stkey] && notificationsSubsctiption[stkey].length)) {
                            var statusChanged = !subscriptionStatus[stkey] || subscriptionStatus[stkey] < alarmsStatus[stkey];
                            for (var i = 0; i < notificationsSubsctiption[stkey].length; i++) {
                                var notification = notificationsSubsctiption[stkey][i];
                                if (notification.checkToNotify(time, statusChanged)) {
                                    try {
                                        // get alarms summary in text format
                                        var alarmsSummary = runtime.alarmsMgr.getAlarmsString(stkey) || 'FUXA Alarms Error!';
                                        var mail = new MailMessage(null, notification.receiver, notification.name, alarmsSummary);
                                        runtime.notificatorMgr.sendMail(mail, null).then(function () {
                                            notification.setNotify(time, stkey);
                                            logger.info(`notificator.notify.successful: ${new Date()} ${notification.name} ${stkey} ${alarmsSummary}`);
                                        }).catch(function (senderr) {
                                            logger.error(`notificator.notify.send.failed: ${senderr}`);
                                        });
                                    } catch (e) {
                                        logger.error(`notificator.notify.failed: ${err}`);
                                    }
                                }
                            }
                        }
                    } else if (subscriptionStatus[stkey]) {
                        // to reset 
                        for (var i = 0; i < notificationsSubsctiption[stkey].length; i++) {
                            var notification = notificationsSubsctiption[stkey][i];
                            notification.reset();
                            logger.info(`notificator.notify.toreset: ${notification.name} ${stkey}`);
                        }
                    }
                    subscriptionStatus[stkey] = alarmsStatus[stkey];
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
                        host: smtpServer.host,
                        port: smtpServer.port,
                        secure: (smtpServer.port === 465) ? true : false, // true for 465, false for other ports
                        auth: {
                            user: smtpServer.username,
                            pass: smtpServer.password
                        }
                    });
                    if (!msg.from || smtpServer.mailsender) {
                        msg.from = smtpServer.mailsender || smtpServer.username;
                    }
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

    this.sendMailMessage = function (from, to, subj, text, html, attachments) {
        let mail = new MailMessage(from, to, subj, text, html, attachments);
        return this.sendMail(mail, null);
    }

    // check if alarms status chenaged
    events.on('alarms-status:changed', this.forceCheck);
}

module.exports = {
    create: function (runtime) {
        return new NotificatorManager(runtime);
    },
    createMessage: function(from, to, subj, text, html, attachments) {
        return new MailMessage(from, to, subj, text, html, attachments);
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
    this.notifytype = '';
    this.enabled = true;
    this.text;
    this.subscriptions = {};
    this.options;

    this.hasSubscriptions = function () {
        return Object.keys(this.subscriptions).length ? true : false;
    }

    this.checkToNotify = function (time, changed) {
        if (!this.ontime) {
            this.ontime = time;
            return false;
        }
        var result = true;
        if (this.ontime + (this.delay * MILLI_MINUTE) > time) {
            result = false;
        } else if (this.notifytime && (this.interval <= 0 || this.notifytime + (this.interval * MILLI_MINUTE) > time)) {
            result = false;
        } else if (changed) { // !this.notifytime
            this.ontime = time;
            result = true;
        }
        return result;
    }

    this.setNotify = function (time, type) {
        this.notifytime = time;
        this.notifytype = type;
    }

    this.reset = function () {
        this.ontime = 0;
        this.notifytime = 0;
        this.notifytype = '';
    }
}

function MailMessage(from, to, subj, text, html, attachments) {
    this.from = from;
    this.to = to;
    this.subject = subj;
    this.text = text;
    this.html = html;
    this.attachments = attachments;
}