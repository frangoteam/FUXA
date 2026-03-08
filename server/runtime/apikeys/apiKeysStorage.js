/**
 *  Module to manage the apikeys in a database
 *  Table: 'apikeys'
 */

'use strict';

const fs = require('fs');
const path = require('path');
var sqlite3 = require('sqlite3').verbose();

var settings        // Application settings
var logger;         // Application logger
var db_apikeys;     // Database of apikeys

function _run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db_apikeys.run(sql, params, function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(this);
            }
        });
    });
}

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
        var dbfile = path.join(settings.workDir, 'apikeys.fuxap.db');
        var dbfileExist = fs.existsSync(dbfile);
        db_apikeys = new sqlite3.Database(dbfile, function (err) {
            if (err) {
                logger.error(`apiKeysStorage.bind failed! ${err}`);
                reject();
            }
            logger.info(`apiKeysStorage.connected ${dbfile} database`, true);
        });
        // prepare query
        var sql = "CREATE TABLE if not exists apikeys (name TEXT PRIMARY KEY, value TEXT);";
        db_apikeys.exec(sql, function (err) {
            if (err) {
                logger.error(`apiKeysStorage.bind failed! ${err}`);
                reject();
            } else {
                resolve(dbfileExist);
            }
        });
    });
}

/**
 * Return the ApiKeys list
 */
function getApiKeys() {
    return new Promise(function (resolve, reject) {
        var sql = "SELECT value FROM apikeys";
        db_apikeys.all(sql, function (err, rows) {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

/**
 * Set ApiKeys value in database
 */
function setApiKeys(apiKeys) {
    return new Promise(async function (resolve, reject) {
        try {
            const sql = "INSERT OR REPLACE INTO apikeys (name, value) VALUES(?, ?)";
            for (var i = 0; i < apiKeys.length; i++) {
                const apiKey = apiKeys[i];
                var value = JSON.stringify(apiKey);
                await _run(sql, [apiKey.id, value]);
            }
            resolve();
        } catch (err) {
            logger.error(`apiKeysStorage.set apikeys failed! ${err}`);
            reject();
        }
    });
}

/**
 * Remove ApiKeys from database
 */
function removeApiKeys(apiKeys) {
    return new Promise(async function (resolve, reject) {
        try {
            const sql = "DELETE FROM apikeys WHERE name = ?";
            for (var i = 0; i < apiKeys.length; i++) {
                const apiKey = apiKeys[i];
                await _run(sql, [apiKey.id]);
            }
            resolve();
        } catch (err) {
            logger.error(`apiKeysStorage.remove apikeys failed! ${err}`);
            reject();
        }
    });
}

/**
 * Close the database
 */
function close() {
    if (db_apikeys) {
        db_apikeys.close();
    }
}

module.exports = {
    init: init,
    close: close,
    getApiKeys: getApiKeys,
    setApiKeys: setApiKeys,
    removeApiKeys: removeApiKeys
};
