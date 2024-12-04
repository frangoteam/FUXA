/*
* Users manager: read, write, add, remove, ... and save 
*/

'use strict';

const usrstorage = require('./usrstorage');

const version = '1.00';
var settings;                   // Application settings
var logger;                     // Application logger
var usersMap;                   // User map for permission

/**
 * Init Users resource
 * @param {*} _settings 
 * @param {*} log 
 */
function init(_settings, log) {
    settings = _settings;
    logger = log;
    usersMap = new Map();

    // Init Users database
    return new Promise(function (resolve, reject) {
        usrstorage.init(settings, logger).then(result => {
            logger.info('users.usrstorage-init successful!', true);
            if (result) {
                resolve();
                _loadUsers();
            } else {
                usrstorage.setDefault().then(result => {
                    logger.info('users.usrstorage-set-default successful!', true);
                    resolve();
                    _loadUsers();
                }).catch(function (err) {
                    logger.error(`users.usrstorage.set-default failed! ${err}`);
                    resolve();
                });
            }
        }).catch(function (err) {
            logger.error(`users.usrstorage-init failed ${err}`);
            reject(err);
        });
    });
}

/**
 * Get the users list
 */
function getUsers(user) {
    return new Promise(function (resolve, reject) {
        usrstorage.getUsers(user).then(drows => {
            if (drows.length > 0) {
                resolve(drows);
            } else {
                resolve();
            }
        }).catch(function (err) {
            logger.error(`users.usrstorage-get-users-list failed! ${err}`);
            reject(err);
        });
    });
}

/**
 * Set the user
 */
function setUsers(query) {
    return new Promise(function (resolve, reject) {
        if (query.username) {
            usrstorage.setUser(query.username, query.fullname, query.password, query.groups, query.info).then(() => {
                resolve();
                const info = JSON.parse(query.info);
                usersMap.set(query.username, { info: info, groups: query.groups });
            }).catch(function (err) {
                logger.error(`users.usrstorage-set-users failed! ${err}`);
                reject(err);
            });
        } else {
            reject();
        }
    });
}

/**
 * Remove the user
 */
function removeUsers(username) {
    return new Promise(function (resolve, reject) {
        if (username) {
            usrstorage.removeUser(username).then(() => {
                resolve();
            }).catch(function (err) {
                logger.error(`users.usrstorage-remove-users failed! ${err}`);
                reject(err);
            });
        } else {
            reject();
        }
    });
}

/**
 * Get the roles list
 */
function getRoles() {
    return new Promise(function (resolve, reject) {
        usrstorage.getRoles().then(drows => {
            var roles = [];
            for (var id = 0; id < drows.length; id++) {
                roles.push(JSON.parse(drows[id].value));
            }
            resolve(roles);
        }).catch(function (err) {
            logger.error(`users.usrstorage-get-roles-list failed! ${err}`);
            reject(err);
        });
    });
}

/**
 * Set the role
 */
function setRoles(query) {
    return new Promise(function (resolve, reject) {
        if (query && query.length) {
            usrstorage.setRoles(query).then(() => {
                resolve();
            }).catch(function (err) {
                logger.error(`users.usrstorage-set-role failed! ${err}`);
                reject(err);
            });
        } else {
            reject();
        }
    });
}

/**
 * Remove the role
 */
function removeRoles(roles) {
    return new Promise(function (resolve, reject) {
        if (roles && roles.length) {
            usrstorage.removeRoles(roles).then(() => {
                resolve();
            }).catch(function (err) {
                logger.error(`users.usrstorage-remove-role failed! ${err}`);
                reject(err);
            });
        } else {
            reject();
        }
    });
}

/**
 * Find the user
 */
function findOne(user) {
    return new Promise(function (resolve, reject) {
        usrstorage.getUsers(user).then(drows => {
            if (drows.length > 0) {
                resolve(drows);
            } else {
                resolve();
            }
        }).catch(function (err) {
            logger.error(`users.usrstorage-find-user failed! ${err}`);
            reject(err);
        });
    });
}

/**
 * Return user info with permission { roles, groups }
 * @param {*} username 
 * @returns 
 */
function getUserCache(username) {
    return usersMap.get(username);
}

function _loadUsers() {
    getUsers().then(users => {
        for (var id = 0; id < users.length; id++) {
            try {
                const info = JSON.parse(users[id].info);
                usersMap.set(users[id].username, { info: info, groups: users[id].groups });
            } catch (e) {
                logger.error(`users.usrstorage-loadUsers failed! ${e}`);
            }
        }
    }).catch(function (err) {
        logger.error(`users.usrstorage-loadUsers failed! ${err}`);
    });
}

module.exports = {
    init: init,
    getUsers: getUsers,
    setUsers: setUsers,
    removeUsers: removeUsers,
    getRoles: getRoles,
    setRoles: setRoles,
    removeRoles: removeRoles,
    findOne: findOne,
    getUserCache: getUserCache
};