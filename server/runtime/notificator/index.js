/*
* Notificator manager: check, save, send mails to notificate alarms, events
*/

'use strict';
const nodemailer = require('nodemailer');
const notifystorage = require('./notifystorage');

var NOTIFY_CHECK_STATUS_INTERVAL = 1000 * 60;

function NotificatorManager(_runtime) {
    var runtime = _runtime;
    var events = runtime.events;        // Events to commit change to runtime
    var settings = runtime.settings;    // Settings
    var logger = runtime.logger;        // Logger
    var notifyCheckStatus = null;       // TimerInterval to check Notificator status
    var working = false;                // Working flag to manage overloading of check notificator status
    var status = NotifyStatusEnum.INIT; // Current status (StateMachine)

    /**
     * Start TimerInterval to check Notifications
     */
     this.start = function () {
        return new Promise(function (resolve, reject) {
            logger.info('notificator check start', true);
            notifyCheckStatus = setInterval(function () {
                _checkStatus();
            }, NOTIFY_CHECK_STATUS_INTERVAL);
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
        status = NotifyStatusEnum.LOAD;
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
                // _loadProperty().then(function () {
                //     _loadAlarms().then(function () {
                //         status = NotifyStatusEnum.IDLE;
                //         _emitAlarmsChanged();
                //         _checkWorking(false);
                //     }).catch(function (err) {
                //         _checkWorking(false);
                //     });
                // }).catch(function (err) {
                //     _checkWorking(false);
                // });
            }
        } else if (status === NotifyStatusEnum.IDLE) {
            if (_checkWorking(true)) {
                // _checkAlarms().then(function (changed) {
                //     if (changed) {
                //         _emitAlarmsChanged();
                //     }
                //     _checkWorking(false);
                // }).catch(function (err) {
                //     _checkWorking(false);
                // });
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

function MailMessage(from, to, subj, text, html) {
    this.from = from;
    this.to = to;
    this.subject = subj;
    this.text = text;
    this.html = html;
}