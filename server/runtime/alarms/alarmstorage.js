/**
 *  Module to manage the alarms in a database
 *  Table: 'alarms', 'chronicle'
 */

'use strict';

const fs = require('fs');
const path = require('path');
var sqlite3 = require('sqlite3').verbose();

var settings        // Application settings
var logger;         // Application logger
var db_alarms;      // Database of alarms

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
        var dbfile = path.join(settings.workDir, 'alarms.fuxap.db');
        var dbfileExist = fs.existsSync(dbfile);

        db_alarms = new sqlite3.Database(dbfile, function (err) {
            if (err) {
                logger.error('alarmsstorage.failed-to-bind: ' + err);
                reject();
            }
            logger.info('alarmsstorage.connected-to ' + dbfile + ' database.', true);
        });
        // prepare query
        var sql = "CREATE TABLE if not exists alarms (nametype TEXT PRIMARY KEY, type TEXT, status TEXT, ontime INTEGER, offtime INTEGER, acktime INTEGER);";
        sql += "CREATE TABLE if not exists chronicle (Sn INTEGER, nametype TEXT, type TEXT, status TEXT, text TEXT, grp TEXT, ontime INTEGER, offtime INTEGER, acktime INTEGER, userack TEXT, PRIMARY KEY(Sn AUTOINCREMENT));";
        db_alarms.exec(sql, function (err) {
            if (err) {
                logger.error('alarmsstorage.failed-to-bind: ' + err);
                reject();
            } else {
                resolve(dbfileExist);
            }
        });
    });
}

/**
 * Clear all Alarms from table
 */
function clearAlarms(all) {
    return new Promise(function (resolve, reject) {
        var sql = "DELETE FROM alarms;";
        if (all) {
            sql += "DELETE FROM chronicle;";
        }
        db_alarms.exec(sql, function (err, rows) {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

/**
 * Clear Alarms history
 */
function clearAlarmsHistory(dtlimit) {
    return new Promise(function (resolve, reject) {
        var sql = "DELETE FROM chronicle WHERE ontime < ?;";
        db_alarms.all(sql, [dtlimit.getTime()], function (err, rows) {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

/**
 * Return the Alarms list
 */
function getAlarms() {
    return new Promise(function (resolve, reject) {
        if (!db_alarms) {
            reject(false);
        } else {
            var sql = "SELECT * FROM alarms";
            db_alarms.all(sql, function (err, rows) {
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
 * Return the Alarms history
 */
 function getAlarmsHistory(from, to) {
    return new Promise(function (resolve, reject) {
        if (!db_alarms) {
            reject(false);
        } else {
            var start = from || 0;
            var end = to || Number.MAX_SAFE_INTEGER;
            var sql = "SELECT * FROM chronicle WHERE ontime BETWEEN ? and ? ORDER BY ontime DESC";
            db_alarms.all(sql, [start, end], function (err, rows) {
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
 * Set alarm value in database
 */
function setAlarms(alarms) {
    return new Promise(function (resolve, reject) {
        // prepare query
        if (alarms && alarms.length) {
            var sql = "";
            alarms.forEach(alr => {
                let grp = alr.subproperty.group || '';
                let status = alr.status || '';
                let userack = alr.userack || '';
                //is alarm condition is changed (if it is occured or acknowledged) insert or update record
                sql += "INSERT OR REPLACE INTO alarms (nametype, type, status, ontime, offtime, acktime) VALUES('" +
                    alr.getId() + "','" + alr.type + "','" + status + "','" + alr.ontime + "','" + alr.offtime + "','" + alr.acktime + "');" +
                    "INSERT OR REPLACE INTO chronicle (Sn, nametype, type, status, text, grp, ontime, offtime,  acktime, userack)" +
                    " VALUES ((SELECT Sn from chronicle WHERE ontime='" + alr.ontime + "' AND nametype='" + alr.getId() + "'),'" +
                    alr.getId() + "','" + alr.type + "','" + status + "','" + alr.subproperty.text + "','" + grp + "','" + alr.ontime + "','" + alr.offtime + "','" + alr.acktime + "','" + userack + "');";
                if (alr.toremove) {
                    //is alarm to be removed (if it is ok) delete it from db
                    sql += "DELETE FROM alarms WHERE nametype = '" + alr.getId() + "';";
                }
            });
            db_alarms.exec(sql, function (err) {
                if (err) {
                    logger.error('alarmsstorage.failed-to-set: ' + err);
                    reject();
                } else {
                    resolve();
                }
            });
        }
    });
}

/**
 * Remove alarm from database
 */
function removeAlarm(alarm) {
    return new Promise(function (resolve, reject) {
        // prepare query
        var sql = "DELETE FROM alarms WHERE nametype = '" + alarm.getId() + "'";
        db_alarms.exec(sql, function (err) {
            if (err) {
                logger.error('alarmsstorage.failed-to-remove: ' + err);
                reject();
            } else {
                resolve();
            }
        });
    });
}

/**
 * Close the database
 */
function close() {
    if (db_alarms) {
        db_alarms.close();
    }
}

module.exports = {
    init: init,
    close: close,
    getAlarms: getAlarms,
    getAlarmsHistory: getAlarmsHistory,
    setAlarms: setAlarms,
    clearAlarms: clearAlarms,
    clearAlarmsHistory: clearAlarmsHistory,
    removeAlarm: removeAlarm
};
