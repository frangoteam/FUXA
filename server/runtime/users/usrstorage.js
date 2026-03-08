/**
 *  Module to manage the users in a database
 *  Table: 'users'
 */

'use strict';

const fs = require('fs');
const path = require('path');
var sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const { forEach } = require('async');

var settings        // Application settings
var logger;         // Application logger
var db_usr;         // Database of users

function _run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db_usr.run(sql, params, function (err) {
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
        var dbfile = path.join(settings.workDir, 'users.fuxap.db');
        var dbfileExist = fs.existsSync(dbfile);
        db_usr = new sqlite3.Database(dbfile, function (err) {
            if (err) {
                logger.error(`usrstorage.bind failed! ${err}`);
                reject();
            }
            logger.info(`usrstorage.connected ${dbfile} database`, true);
        });
        // prepare query
        var sql = "CREATE TABLE if not exists users (username TEXT PRIMARY KEY, fullname TEXT, password TEXT, groups INTEGER, info TEXT);";
        sql += "CREATE TABLE if not exists roles (name TEXT PRIMARY KEY, value TEXT);";
        db_usr.exec(sql, function (err) {
            if (err) {
                logger.error(`usrstorage.bind failed! ${err}`);
                reject();
            } else {
                const columnsToAdd = [{ name: 'fullname', type: 'TEXT' },
                { name: 'info', type: 'TEXT' }];
                _checkUpdate(columnsToAdd).then(() => {
                    resolve(dbfileExist);
                }).catch(() => {
                    resolve(dbfileExist);
                });
            }
        });
    });
}

function _checkUpdate(columnsToAdd) {
    return new Promise(function (resolve, reject) {

        const addColumn = (column, callback) => {
            const { name, type } = column;
            const addColumnQuery = `ALTER TABLE users ADD COLUMN ${name} ${type};`;

            db_usr.run(addColumnQuery, err => {
                if (err) {
                    if (!err.message.includes('duplicate column name')) {
                        logger.error(`usrstorage._checkUpdate error! ${err}`);
                    }
                }
                callback();
            });
        };

        const addColumnsInSerie = index => {
            if (index < columnsToAdd.length) {
                addColumn(columnsToAdd[index], () => {
                    addColumnsInSerie(index + 1);
                });
            } else {
                resolve();
            }
        };
        addColumnsInSerie(0);
    });
}

/**
 * Set default users value in database (administrator)
 */
function setDefault() {
    return new Promise(function (resolve, reject) {
        const sql = "INSERT OR REPLACE INTO users (username, fullname, password, groups) VALUES(?, ?, ?, ?)";
        const params = ['admin', 'Administrator Account', bcrypt.hashSync('123456', 10), -1];
        _run(sql, params).then(() => {
            resolve();
        }).catch((err) => {
            logger.error(`usrstorage.set failed! ${err}`);
            reject();
        });
    });
}

/**
 * Return the Users list
 */
function getUsers(user) {
    return new Promise(function (resolve, reject) {
        var sql = "SELECT username, fullname, password, groups, info FROM users";
        var params = [];
        if (user && user.username) {
            sql += " WHERE username = ?";
            params = [user.username];
        }
        db_usr.all(sql, params, (error, rows) => {
            if (error) {
                reject(error);
            } else {
                resolve(rows);
            }
        });
    });
}

/**
 * Set user value in database
 */
function setUser(usr, fullname, pwd, groups, info) {
    return new Promise(function (resolve, reject) {
        getUsers({ username: usr }).then(function (data) {
            const exist = data && data.length;
            let sql = '';
            let params = [];
            if (pwd) {
                const hashedPwd = bcrypt.hashSync(pwd, 10);
                if (exist) {
                    sql = "UPDATE users SET password = ?, info = ?, groups = ?, fullname = ? WHERE username = ?";
                    params = [hashedPwd, info, groups, fullname, usr];
                } else {
                    sql = "INSERT OR REPLACE INTO users (username, fullname, password, groups, info) VALUES(?, ?, ?, ?, ?)";
                    params = [usr, fullname, hashedPwd, groups, info];
                }
            } else if (exist) {
                sql = "UPDATE users SET groups = ?, info = ?, fullname = ? WHERE username = ?";
                params = [groups, info, fullname, usr];
            } else {
                sql = "INSERT OR REPLACE INTO users (username, fullname, groups, info) VALUES(?, ?, ?, ?)";
                params = [usr, fullname, groups, info];
            }
            _run(sql, params).then(() => {
                resolve();
            }).catch((err) => {
                logger.error(`usrstorage.set failed! ${err}`);
                reject();
            });
        }).catch(function () {
            reject();
        });
    });
}

/**
 * Remove user from database
 */
function removeUser(usr) {
    return new Promise(function (resolve, reject) {
        var sql = "DELETE FROM users WHERE username = ?";
        _run(sql, [usr]).then(() => {
            resolve();
        }).catch((err) => {
            logger.error(`usrstorage.remove failed! ${err}`);
            reject();
        });
    });
}

/**
 * Return the Roles list
 */
function getRoles() {
    return new Promise(function (resolve, reject) {
        var sql = "SELECT value FROM roles";
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
 * Set roles value in database
 */
function setRoles(roles) {
    return new Promise(async function (resolve, reject) {
        try {
            const sql = "INSERT OR REPLACE INTO roles (name, value) VALUES(?, ?)";
            for (const role of roles) {
                const value = JSON.stringify(role);
                await _run(sql, [role.id, value]);
            }
            resolve();
        } catch (err) {
            logger.error(`usrstorage.set role failed! ${err}`);
            reject();
        }
    });
}

/**
 * Remove roles from database
 */
function removeRoles(roles) {
    return new Promise(async function (resolve, reject) {
        try {
            const sql = "DELETE FROM roles WHERE name = ?";
            for (const role of roles) {
                await _run(sql, [role.id]);
            }
            resolve();
        } catch (err) {
            logger.error(`usrstorage.remove role failed! ${err}`);
            reject();
        }
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
    removeUser: removeUser,
    getRoles: getRoles,
    setRoles: setRoles,
    removeRoles: removeRoles
};
