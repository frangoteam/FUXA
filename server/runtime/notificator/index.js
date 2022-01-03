/*
* Notificator manager: check, save, send mails to notificate alarms, events
*/

'use strict';
const nodemailer = require('nodemailer');

function NotificatorManager(_runtime) {
    var runtime = _runtime;
    var events = runtime.events;        // Events to commit change to runtime
    var settings = runtime.settings;    // Settings
    var logger = runtime.logger;        // Logger

    /**
     * Send mail
     * @param {*} alarmname 
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

function MailMessage(from, to, subj, text, html) {
    this.from = from;
    this.to = to;
    this.subject = subj;
    this.text = text;
    this.html = html;
}