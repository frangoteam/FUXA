/*
* Users manager: read, write, add, remove, ... and save 
*/

'use strict';

const usrstorage = require('./usrstorage');

const version = '1.00';
var settings;                   // Application settings
var logger;                     // Application logger

/**
 * Init Users resource
 * @param {*} _settings 
 * @param {*} log 
 */
function init(_settings, log) {
    settings = _settings;
    logger = log;

    // Init Users database
    return new Promise(function (resolve, reject) {
        usrstorage.init(settings, logger).then(result => {
            logger.info('users.usrstorage-init successful!', true);
            if (result) {
                resolve();
            } else {
                usrstorage.setDefault().then(result => {
                    logger.info('users.usrstorage-set-default successful!', true);
                    resolve();
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
            }).catch(function (err) {
                logger.error(`users.usrstorage-set-users-list failed! ${err}`);
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

module.exports = {
    init: init,
    getUsers: getUsers,
    setUsers: setUsers,
    removeUsers: removeUsers,
    findOne: findOne
};