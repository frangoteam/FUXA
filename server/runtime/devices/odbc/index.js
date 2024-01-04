/**
 * 'odbc': odbc wrapper to communicate with Database 
 */

'use strict';
var odbc;
const utils = require('../../utils');
const deviceUtils = require('../device-utils');

function ODBCclient(_data, _logger, _events) {
    var data = JSON.parse(JSON.stringify(_data)); // Current Device data { id, name, tags, enabled, ... }
    var logger = _logger;
    var events = _events; // Events to commit change to runtime

    /**
     * initialize the device type 
     */
    this.init = function (_type) {
        console.error('Not supported!');
    }

    /**
     * Connect to device
     * Emit connection status to clients, clear all Tags values
     */
    this.connect = function () {
        console.error('Not supported!');
        // events.emit('device-status:changed', { id: data.id, status: 'connect-ok' });
        // events.emit('device-status:changed', { id: data.id, status: 'connect-error' });
    }


    /**
     * Disconnect the device
     * Emit connection status to clients, clear all Tags values
     */
    this.disconnect = function () {
        console.error('Not supported!');
        // events.emit('device-status:changed', { id: data.id, status: 'connect-off' });
    }

    /**
     * Read values in polling mode 
     * Update the tags values list, save in DAQ if value changed or in interval and emit values to clients
     */
    this.polling = async function () {
        console.error('Not supported!');
        // events.emit('device-value:changed', { id: data.name, values: values });
    }

    /**
     * Load Tags attribute to read with polling
     */
    this.load = function (_data) {
        console.error('Not supported!');
    }

    /**
     * Return Tags values array { id: <name>, value: <value> }
     */
    this.getValues = function () {
        console.error('Not supported!');
    }

    /**
     * Return Tag value { id: <name>, value: <value>, ts: <lastTimestampValue> }
     */
    this.getValue = function (tagid) {
        console.error('Not supported!');
    }

    /**
     * Return connection status 'connect-off', 'connect-ok', 'connect-error', 'connect-busy'
     */
    this.getStatus = function () {
        console.error('Not supported!');
    }

    /**
     * Return Tag property to show in frontend
     */
    this.getTagProperty = function (tagid) {
        console.error('Not supported!');
    }

    /**
     * Set the Tag value to device
     */
    this.setValue = function (tagid, value) {
        console.error('Not supported!');
    }

    /**
     * Return if device is connected
     */
    this.isConnected = function () {
        console.error('Not supported!');
    }

    /**
     * Bind the DAQ store function and default daqInterval value in milliseconds
     */
    this.bindAddDaq = function (fnc) {
        this.addDaq = fnc;                         // Add the DAQ value to db history
    }

    /**
     * Return the timestamp of last read tag operation on polling
     * @returns 
     */
    this.lastReadTimestamp = () => {
        console.error('Not supported!');
    }
}

/**
 * Return tables list
 */
function getTables(endpointUrl) {
    return new Promise( async function (resolve, reject) {
        if (loadOdbcLib()) { 
            try {
                const connectionConfig = {
                    connectionString: 'DSN=MYDSN'+ endpointUrl,
                    connectionTimeout: 10,
                    loginTimeout: 10,
                }
                const connection = await odbc.connect(connectionConfig);
                // if (err) {
                //     reject('getendpoints-connect-error: ' + err.message);
                // } else {
                //     const endpoints = client.getEndpoints().then(endpoints => {
                //         const reducedEndpoints = endpoints.map(endpoint => ({ 
                //             endpointUrl: endpoint.endpointUrl, 
                //             securityMode: endpoint.securityMode.toString(), 
                //             securityPolicy: endpoint.securityPolicyUri.toString(),
                //         }));
                //         resolve( reducedEndpoints);
                //         client.disconnect();
                //     }, reason => {
                //         reject('getendpoints-error: ' + reason);
                //         client.disconnect();
                //     });
                // }
            } catch (err) {
                reject('getendpoints-error: ' + err);
            }
        } else {
            reject('getendpoints-error: node-opcua not found!');
        }
    });
}

function loadOdbcLib() {
    if (!odbc) {
        try { odbc = require('odbc'); } catch { }
        if (!odbc && manager) { try { odbc = manager.require('odbc'); } catch { } }
    }
    return (odbc) ? true : false;
}

module.exports = {
    init: function (settings) {
        // deviceCloseTimeout = settings.deviceCloseTimeout || 15000;
    },
    create: function (data, logger, events, manager) {
        if (!loadOdbcLib()) return null;
        return new ODBCclient(data, logger, events);
    },
    getTables: getTables
}