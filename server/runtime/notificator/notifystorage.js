/**
 *  Module to manage the notifications in a database
 *  Table: 'alarms', 'chronicle'
 */

'use strict';

const fs = require('fs');
const path = require('path');
var sqlite3 = require('sqlite3').verbose();

var settings            // Application settings
var logger;             // Application logger
var db_notifications;   // Database of notifications

/**
 * Init and bind the database resource
 * @param {*} _settings 
 * @param {*} _log 
 */
function init(_settings, _log) {
    settings = _settings;
    logger = _log;

    return _bind();
}

/**
 * Bind the database resource by create the table if not exist
 */
function _bind() {
    return new Promise(function (resolve, reject) {
        var dbfile = path.join(settings.workDir, 'notifications.fuxap.db');
        var dbfileExist = fs.existsSync(dbfile);

        db_notifications = new sqlite3.Database(dbfile, function (err) {
            if (err) {
                logger.error('notifystorage.failed-to-bind: ' + err);
                reject();
            }
            logger.info('notifystorage.connected-to ' + dbfile + ' database.', true);
        });
        // prepare query
        var sql = "CREATE TABLE if not exists notifications (nametype TEXT PRIMARY KEY, type TEXT, status TEXT, ontime INTEGER, offtime INTEGER, acktime INTEGER);";
        sql += "CREATE TABLE if not exists chronicle (Sn INTEGER, id TEXT, name TEXT, type TEXT, status TEXT, text TEXT, grp TEXT, ontime INTEGER, offtime INTEGER, acktime INTEGER, userack TEXT, PRIMARY KEY(Sn AUTOINCREMENT));";
        db_notifications.exec(sql, function (err) {
            if (err) {
                logger.error('notifystorage.failed-to-bind: ' + err);
                reject();
            } else {
                resolve(dbfileExist);
            }
        });
    });
}

/**
 * Clear all Notifications from table
 */
function clearNotifications(all) {
    return new Promise(function (resolve, reject) {
        var sql = "DELETE FROM notifications;";
        if (all) {
            sql += "DELETE FROM chronicle;";
        }
        db_notifications.exec(sql, function (err, rows) {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

/**
 * Return the Notifications list
 */
function getNotifications() {
    return new Promise(function (resolve, reject) {
        if (!db_notifications) {
            reject(false);
        } else {
            var sql = "SELECT * FROM notifications";
            db_notifications.all(sql, function (err, rows) {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        }
    });
}

/**
 * Return the Notifications history
 */
 function getNotificationsHistory(from, to) {
    return new Promise(function (resolve, reject) {
        if (!db_notifications) {
            reject(false);
        } else {
            // var sql = "SELECT * FROM history WHERE dt BETWEEN ? and ? ORDER BY dt ASC";
            // db_notifications.all(sql, [from, to], function (err, rows) {
            var sql = "SELECT * FROM chronicle ORDER BY ontime DESC";
            db_notifications.all(sql, function (err, rows) {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        }
    });
}

/**
 * Set Notifications value in database
 */
function setNotifications(notifications) {
    return new Promise(function (resolve, reject) {
        // prepare query
        if (notifications && notifications.length) {
            var sql = "";
            notifications.forEach(alr => {
                let grp = alr.subproperty.group || '';
                let status = alr.status || '';
                let userack = alr.userack || '';
                //is alarm condition is changed (if it is occured or acknowledged) insert or update record
                sql += "INSERT OR REPLACE INTO notifications (nametype, type, status, ontime, offtime, acktime) VALUES('" +
                    alr.getId() + "','" + alr.type + "','" + status + "','" + alr.ontime + "','" + alr.offtime + "','" + alr.acktime + "');" +
                    "INSERT OR REPLACE INTO chronicle (Sn, nametype, type, status, text, grp, ontime, offtime,  acktime, userack)" +
                    " VALUES ((SELECT Sn from chronicle WHERE ontime='" + alr.ontime + "' AND nametype='" + alr.getId() + "'),'" +
                    alr.getId() + "','" + alr.type + "','" + status + "','" + alr.subproperty.text + "','" + grp + "','" + alr.ontime + "','" + alr.offtime + "','" + alr.acktime + "','" + userack + "');";
                if (alr.toremove) {
                    //is alarm to be removed (if it is ok) delete it from db
                    sql += "DELETE FROM notifications WHERE nametype = '" + alr.getId() + "';";
                }
            });
            db_notifications.exec(sql, function (err) {
                if (err) {
                    logger.error('notifystorage.failed-to-set: ' + err);
                    reject();
                } else {
                    resolve();
                }
            });
        }
    });
}

/**
 * Close the database
 */
function close() {
    if (db_notifications) {
        db_notifications.close();
    }
}

/**
 * Remove Notification from database
 */
 function removeNotification(notification) {
    return new Promise(function (resolve, reject) {
        // prepare query
        var sql = "DELETE FROM notifications WHERE id = '" + notification.id + "'";
        db_notifications.exec(sql, function (err) {
            if (err) {
                logger.error('notificationsstorage.failed-to-remove: ' + err);
                reject();
            } else {
                resolve();
            }
        });
    });
}

module.exports = {
    init: init,
    close: close,
    getNotifications: getNotifications,
    getNotificationsHistory: getNotificationsHistory,
    setNotifications: setNotifications,
    clearNotifications: clearNotifications,
    removeNotification: removeNotification
};
