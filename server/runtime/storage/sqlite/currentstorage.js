'use strict';

const fs = require('fs');
const path = require('path');
var sqlite3 = require('sqlite3').verbose();

var settings        // Application settings
var logger;         // Application logger
var db_current;     // Database of project

function CurrentTagReadings(_settings, _log) {

    const settings = _settings;
    const logger = _log;

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
     * Insert the list of values in database tables, if exist replace the value
     * @param {*} tags [{ tagid, deviceId, value}]
     */
    this.setValues = function (tags) {
        return new Promise(function (resolve, reject) {
            // prepare query
            var sql = "";
            for(var i = 0; i < tags.length; i++) {
                // var value = JSON.stringify(tags[i].value).replace(/\'/g,"''");
                sql += "INSERT OR REPLACE INTO values (tagId, deviceId, value) VALUES('" + tags[i].tagId + "','" + tags[i].deviceId + "','" + tags[i].value + "');";
            }
            db_current.exec(sql, function (err) {
                if (err) {
                    logger.error(`currentstorage.set failed! ${err}`);
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
            // prepare query
            var sql = "DELETE FROM values;";
            db_current.exec(sql, function (err) {
                if (err) {
                    logger.error(`currentstorage.clear failed! ${err}`);
                    reject();
                } else {
                    resolve(true);
                }
            });  
        });
    }

    _bind().then(result => {
        logger.info('currentstorage init successful!', true);
    }).catch(function (err) {
        logger.error(`currentstorage.failed-to-init ${err}`);
    });
}

module.exports = {
    create: function (data, logger) {
        return new CurrentTagReadings(data, logger);
    },
};