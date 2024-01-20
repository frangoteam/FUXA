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
        return new Promise((resolve, reject) => {
            reject('Not supported!');
        })
        // events.emit('device-status:changed', { id: data.id, status: 'connect-ok' });
        // events.emit('device-status:changed', { id: data.id, status: 'connect-error' });
    }


    /**
     * Disconnect the device
     * Emit connection status to clients, clear all Tags values
     */
    this.disconnect = function () {
        console.error('Not supported!');
        return new Promise((resolve, reject) => {
            reject('Not supported!');
        })
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
function getTables(endpoint, fncGetProperty) {
    return new Promise( async function (resolve, reject) {
        if (loadOdbcLib()) { 
            var connection;
            try {
                var security
                await fncGetProperty({query: 'security', name: endpoint.id}).then((result, error) => {
                    if (result) {
                        security = utils.JsonTryToParse(result.value);
                    }
                });
                var connectionsString = endpoint.address;
                if (endpoint.uid || security.uid) {
                    connectionsString += `;UID=${endpoint.uid || security.uid}`;
                }
                if (endpoint.pwd || security.pwd) {
                    connectionsString += `;PWD=${endpoint.pwd || security.pwd}`;
                }
                const connectionConfig = {
                    connectionString: connectionsString,//'DSN=TestDatabase;UID=SA;PWD=Pippo-07',//+ endpointUrl,
                    connectionTimeout: 10,
                    loginTimeout: 10,
                }
                connection = await odbc.connect(connectionConfig)
                var tables = await connection.tables(null, 'dbo', null, null);
                if (tables.length <= 0) {
                    tables = await connection.tables(null, null, null, null);
                }
                const resultEndpoints = tables.map(table => table.TABLE_NAME);
                resolve(resultEndpoints);
            } catch (err) {
                reject('getendpoints-error: ' + err);
            }
            if (connection) {
                connection.close();
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