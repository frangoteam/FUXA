/*
* ApiKeys manager: read, write, add, remove, ... and save
*/

'use strict';

const apiKeysStorage = require('./apiKeysStorage');

const version = '1.00';
var settings;                   // Application settings
var logger;                     // Application logger
var apiKeysMap;                 // ApiKeys map for permission

/**
 * Init ApiKeys resource
 * @param {*} _settings
 * @param {*} log
 */
function init(_settings, log) {
    settings = _settings;
    logger = log;
    apiKeysMap = new Map();

    // Init ApiKeys database
    return new Promise(function (resolve, reject) {
        apiKeysStorage.init(settings, logger).then(result => {
            logger.info('apikeys.apiKeysStorage-init successful!', true);
            if (result) {
                _loadApiKeys();
            }
            resolve();
        }).catch(function (err) {
            logger.error(`apikeys.apiKeysStorage-init failed ${err}`);
            reject(err);
        });
    });
}

/**
 * Get the ApiKeys list
 */
function getApiKeys() {
    return new Promise(function (resolve, reject) {
        apiKeysStorage.getApiKeys().then(drows => {
            var apiKeys = [];
            for (var id = 0; id < drows.length; id++) {
                apiKeys.push(JSON.parse(drows[id].value));
            }
            resolve(apiKeys);
        }).catch(function (err) {
            logger.error(`apikeys.apiKeysStorage-get-roles-list failed! ${err}`);
            reject(err);
        });
    });
}

/**
 * Set the ApiKeys
 */
function setApiKeys(query) {
    return new Promise(function (resolve, reject) {
        if (query && query.length) {
            apiKeysStorage.setApiKeys(query).then(() => {
                resolve();
            }).catch(function (err) {
                logger.error(`apikeys.apiKeysStorage-set-ApiKey failed! ${err}`);
                reject(err);
            });
        } else {
            reject();
        }
    });
}

/**
 * Remove the ApiKeys
 */
function removeApiKeys(apiKeys) {
    return new Promise(function (resolve, reject) {
        if (apiKeys && apiKeys.length) {
            apiKeysStorage.removeApiKeys(apiKeys).then(() => {
                resolve();
            }).catch(function (err) {
                logger.error(`apikeys.apiKeysStorage-remove-ApiKeys failed! ${err}`);
                reject(err);
            });
        } else {
            reject();
        }
    });
}

/**
 * Return user info with permission { roles, groups }
 * @param {*} username
 * @returns
 */
function getApiKeysMapCache(key) {
    return apiKeysMap.get(key);
}

function _loadApiKeys() {
    getApiKeys().then(apiKeys => {
        for (var id = 0; id < apiKeys.length; id++) {
            try {
                // const info = JSON.parse(apiKeys[id].info);
                // usersMap.set(users[id].username, { info: info, groups: users[id].groups });
            } catch (e) {
                logger.error(`apikeys.apiKeysStorage-apiKeys failed! ${e}`);
            }
        }
    }).catch(function (err) {
        logger.error(`apikeys.apiKeysStorage-apiKeys failed! ${err}`);
    });
}

module.exports = {
    init: init,
    getApiKeys: getApiKeys,
    setApiKeys: setApiKeys,
    removeApiKeys: removeApiKeys,
    getApiKeysMapCache: getApiKeysMapCache
};