'use strict';

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const writeInterval = 5000;

function CurrentTagReadings(_settings, _log) {

    const settings = _settings;     // Application settings
    const logger = _log;            // Application logger
    var db_current = null;          // Database of project
    const dataQueue = new Map();    // Tags map

    /**
     * Bind the database resource by create the table if not exist
     */
    var _bind = function () {
        return new Promise(function (resolve, reject) {
            var dbfile = path.join(settings.dbDir, 'currentTagReadings.db');
            var dbfileExist = fs.existsSync(dbfile);
            db_current = new sqlite3.Database(dbfile, function (err) {
                if (err) {
                    logger.error(`currentstorage.bind failed! ${err}`);
                    reject();
                }
                logger.info(`currentstorage.connected-to ${dbfile} database`, true);
            });
            // prepare query
            var sql = "CREATE TABLE if not exists currentValues (tagId TEXT PRIMARY KEY, deviceId TEXT, value TEXT);";
            db_current.exec(sql, function (err) {
                if (err) {
                    logger.error(`currentstorage.bind failed! ${err}`);
                    reject();
                } else {
                    resolve(dbfileExist);
                }
            });  
        });
    }

    /**
     * Write dataQueue in database
     */
    var _writeValues = async function() {
        if (dataQueue.size > 0) {
            const stmt = db_current.prepare("INSERT OR REPLACE INTO currentValues (tagId, deviceId, value) VALUES (?, ?, ?)");
            for (const [tagid, tag] of dataQueue) {
                await new Promise((resolve, reject) => {
                    stmt.run(tagid, tag.deviceId, tag.value, function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
            }
            stmt.finalize();
            dataQueue.clear();
        }
    }

    /**
     * Insert the list of values in database tables, if exist replace the value
     * @param {*} tags [{ tagid, deviceId, value}]
     */
    this.setValues = function (tags) {
        for (const tag of tags) {
            dataQueue.set(tag.id, tag);
        }
    }

    /**
     * Get a list of values per device
     * @param {*} deviceId
     */
    this.getValuesByDeviceId = function (deviceId) {
        return new Promise(function (resolve, reject) {
            var sql = "SELECT tagId, value FROM currentValues WHERE deviceId = ?";
            db_current.all(sql, [deviceId], function (err, rows) {
                if (err) {
                    console.error(err);
                    reject(err);
                } else {
                    const result = rows.map(row => ({ id: row.tagId, value: row.value }));
                    resolve(result);
                }
            });
        });
    }

    /**
     * Close the database
     */
    this.close = function () {
        if (db_current) {
            db_current.close();
        }
    }

    /**
     * Clear all table in database
     */
    this.clearAll = function () {
        return new Promise(function (resolve, reject) {
            if (!db_current) {
                reject('currentstorage.clear failed! (db_current)');
            }
            // prepare query
            var sql = "DELETE FROM currentValues;";
            db_current.exec(sql, function (err) {
                if (err) {
                    logger.error(`currentstorage.clear failed! ${err}`);
                    reject();
                } else {
                    resolve(true);
                }
            });
            dataQueue.clear();
        });
    }

    _bind().then(result => {
        logger.info('currentstorage init successful!', true);
        setInterval(async () => {
            try {
                if (db_current) {
                    await _writeValues();
                }
            } catch (error) {
                logger.error(`currentstorage.writeValues failed! ${error}`);
            }
        }, writeInterval);
    }).catch(function (err) {
        logger.error(`currentstorage.failed-to-init ${err}`);
    });
}

module.exports = {
    create: function (data, logger) {
        return new CurrentTagReadings(data, logger);
    },
};