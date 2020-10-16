/**
 *  Module to manage the users in a database
 *  Table: 'users' 
 */

'use strict';

const fs = require('fs');
const path = require('path');
var sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

var settings        // Application settings
var logger;         // Application logger
var db_usr;         // Database of users

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
        var dbfile = path.join(settings.workDir, 'users.fuxap.db');
        var dbfileExist = fs.existsSync(dbfile);
        db_usr = new sqlite3.Database(dbfile, function (err) {
            if (err) {
                logger.error('usrstorage.failed-to-bind: ' + err);
                reject();
            }
            logger.info('usrstorage.connected-to ' + dbfile + ' database.');
        });
        // prepare query
        var sql = "CREATE TABLE if not exists users (username TEXT PRIMARY KEY, password TEXT, groups INTEGER);";
        db_usr.exec(sql, function (err) {
            if (err) {
                logger.error('usrstorage.failed-to-bind: ' + err);
                reject();
            } else {
                resolve(dbfileExist);
            }
        });  
    });
}

/**
 * Set default users value in database (administrator)
 */
function setDefault() {
    return new Promise(function (resolve, reject) {
        // prepare query
        var sql = "";
        sql += "INSERT OR REPLACE INTO users (username, password, groups) VALUES('admin','"+ bcrypt.hashSync('123456', 10) + "','-1');";
        db_usr.exec(sql, function (err) {
            if (err) {
                logger.error('usrstorage.failed-to-set: ' + err);
                reject();
            } else {
                resolve();
            }
        });     
    });
}

/**
 * Return the Users list
 */
function getUsers(user) {
    return new Promise(function (resolve, reject) {
        var sql = "SELECT username, groups FROM users";
        if (user && user.username) {
            sql = "SELECT username, password, groups FROM users WHERE username = '" + user.username + "'";
        }
        db_usr.all(sql, function (err, rows) {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });   
    });
}

/**
 * Set user value in database
 */
function setUser(usr, pwd, groups) {
    return new Promise(function (resolve, reject) {
        // prepare query
        var exist = false;
        getUsers({username: usr}).then(function(data) {
            if (data && data.length) {
                exist = true;
            }
            var sql = "";
            if (pwd) {
                sql = "INSERT OR REPLACE INTO users (username, password, groups) VALUES('" + usr + "','"+ bcrypt.hashSync(pwd, 10) + "','" + groups + "');";
                if (exist) {
                    sql = "UPDATE users SET password = '"+ bcrypt.hashSync(pwd, 10) + "', groups = '" + groups + "' WHERE username = '" + usr + "';";
                }
            } else {
                sql = "INSERT OR REPLACE INTO users (username, groups) VALUES('" + usr + "','" + groups + "');";
                if (exist) {
                    sql = "UPDATE users SET groups = '" + groups + "' WHERE username = '" + usr + "';";
                }
            }
            db_usr.exec(sql, function (err) {
                if (err) {
                    logger.error('usrstorage.failed-to-set: ' + err);
                    reject();
                } else {
                    resolve();
                }
            });  
        }).catch(function(err) {
            reject();
        });   
    });
}

/**
 * Remove user from database
 */
function removeUser(usr) {
    return new Promise(function (resolve, reject) {
        // prepare query
        var sql = "DELETE FROM users WHERE username = '" + usr + "'";
        db_usr.exec(sql, function (err) {
            if (err) {
                logger.error('usrstorage.failed-to-remove: ' + err);
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
    if (db_usr) {
        db_usr.close();
    }
}

module.exports = {
    init: init,
    close: close,
    setDefault: setDefault,
    getUsers: getUsers,
    setUser: setUser,
    removeUser: removeUser
};