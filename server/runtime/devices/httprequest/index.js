/**
 * 'http': webapi wrapper to manage REST API request
 */
'use strict';
const axios = require('axios');
function HTTPclient(_data, _logger, _events) {
}

function parseData(data, property) {
    if (property.format === 'CSV') {

    }
}

function parseCSV(data) {

}

/**
 * Return the result of http request
 */
function getRequestResult(property) {
    return new Promise(function (resolve, reject) {
        try {
            if (property.method === 'GET') {
                axios.get(property.address).then(res => {
                    // console.log(res.data.id);
                    // console.log(res.data.title);
                    resolve(parseData(res.data, property));
                }).catch(err => {
                    reject(err);
                });
            } else {
                reject('getrequestresult-error: method is missing!');
            }
        } catch (err) {
            reject('getrequestresult-error: ' + err);
        }
    });
}

module.exports = {
    // init: function (settings) {
    //     // deviceCloseTimeout = settings.deviceCloseTimeout || 15000;
    // },
    // create: function (data, logger, events, manager) {
    //     try { opcua = require('node-opcua'); } catch { }
    //     if (!opcua && manager) { try { opcua = manager.require('node-opcua'); } catch { } }
    //     if (!opcua) return null;
    //     return new HTTPclient(data, logger, events);
    // },
    getRequestResult: getRequestResult
}