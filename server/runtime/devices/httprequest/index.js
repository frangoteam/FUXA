/**
 * 'http': webapi wrapper to manage REST API request
 */
'use strict';
const axios = require('axios');

function HTTPclient(_data, _logger, _events) {
    var data = _data;                   // Current webapi data
    var logger = _logger;               // Logger var working = false;                // Working flag to manage overloading polling and connection
    var working = false;                // Working flag to manage overloading polling and connection
    var connected = false;              // Connected flag
    var events = _events;               // Events to commit change to runtime
    var lastStatus = '';                // Last webapi status
    var varsValue = [];                 // Signale to send to frontend { id, type, value }
    var requestItemsMap = {};           // Map of request (JSON, CSV, XML, ...)
    var overloading = 0;                // Overloading counter to mange the break connection
    var daqInterval = 0;                // Min save DAQ value interval, used to store DAQ too if the value don't change (milliseconds)
    var lastTimestampRequest;           // Last Timestamp request

    /**
     * Connect the client by make a request
     */
    this.connect = function () {
        return new Promise(function (resolve, reject) {
            if (data.property && data.property.address) {
                try {
                    if (_checkWorking(true)) {
                        logger.info(`'${data.name}' try to connect ${data.property.address}`, true);
                        // make request
                        // s7client.ConnectTo(data.property.address, data.property.rack, data.property.slot, function (err) {
                        //     if (err) {
                        //         logger.error(`'${data.name}' connect failed! ${err}`);
                        //         _emitStatus('connect-error');
                                _clearVarsValue();
                        //         reject();
                        //     } else {
                        //         logger.info(`'${data.name}' connected!`, true);
                                _emitStatus('connect-ok');
                                resolve();
                            connected = true;
                            lastTimestampRequest = new Date().getTime();

                        //     }
                            _checkWorking(false);
                        // });
                    } else {
                        reject();
                    }
                } catch (err) {
                    logger.error(`'${data.name}' try to connect error! ${err}`);
                    _checkWorking(false);
                    connected = false;
                    _emitStatus('connect-error');
                    _clearVarsValue();
                    reject();
                }
            } else {
                logger.error(`'${data.name}' missing connection data!`);
                connected = false;
                _emitStatus('connect-failed');
                _clearVarsValue();
                reject();
            }
        });
    }

    /**
     * Disconnect the client
     * Emit connection status to clients, clear all Tags values
     */
    this.disconnect = function () {
        return new Promise(function (resolve, reject) {
            _checkWorking(false);
            logger.info(`'${data.name}' disconnected!`, true);
            connected = false;
            _emitStatus('connect-off');
            _clearVarsValue();
            resolve();
        });
    }

    /**
     * Read values in polling mode 
     * Update the tags values list, save in DAQ if value changed or for daqInterval and emit values to clients
     */
    this.polling = function () {
        if (_checkWorking(true)) {
            // check connection status
            let dt = new Date().getTime();
            if ((lastTimestampRequest + (data.polling * 3)) < dt) {
                _emitStatus('connect-error');
                _checkWorking(false);
            } else {
                var readVarsfnc = [];
                try {
                    _readRequest().then(() => {
                        _checkWorking(false);
                        if (lastStatus !== 'connect-ok') {
                            _emitStatus('connect-ok');                    
                        }
                    }, reason => {
                        _checkWorking(false);
                    });
                    // client.readPropertyMultiple(ipAddress, readObjects, (err, value) => {
                } catch {
                    _checkWorking(false);
                }
            }
        } else {
            _emitStatus('connect-busy');
        }
    }

    /**
     * Return if http request is working
     * is disconnected if the last request result is older as 3 polling interval
     */
    this.isConnected = function () {
        return connected;
    }

    /**
     * Set the callback to set value to DAQ
     */
    this.bindAddDaq = function (fnc, intervalToSave) {
        this.addDaq = fnc;                          // Add the DAQ value to db history
        daqInterval = intervalToSave;
    }
    this.addDaq = null;                             // Callback to add the DAQ value to db history

    /**
     * Load Tags to read by polling
     */
    this.load = function (_data) {
        data = JSON.parse(JSON.stringify(_data));
        // var count = Object.keys(data.tags).length;
        logger.info(`'${data.name}' load`);
    }

    /**
     * Return Tag value { id: <name>, value: <value>, ts: <lastTimestampValue> }
     */
    this.getValue = function (id) {
        // if (varsValue[id]) {
        //     return {id: id, value: varsValue[id].value, ts: lastTimestampValue };
        // }
        logger.info(`'${data.name}' getValue`);
        return null;
    }

    /**
     * Return Tags values array { id: <name>, value: <value>, type: <type> }
     */
    this.getValues = function () {
        logger.info(`'${data.name}' getValues`);
        return varsValue;
    }

    /**
     * Set the Tag value, not used
     */
    this.setValue = function (sigid, value) {
        logger.info(`'${data.name}' setValue`);
    }

    /**
     * Return connection status 'connect-off', 'connect-ok', 'connect-error'
     */
    this.getStatus = function () {
        return lastStatus;
    }

    /**
     * Return Tag property
     */
    this.getTagProperty = function (id) {
        logger.info(`'${data.name}' getTagProperty`);
        // if (data.tags[id]) {
        //     let prop = { id: id, name: data.tags[id].name, type: data.tags[id].type };
        //     return prop;
        // } else {
        //     return null;
        // }
    }

    var _readRequest = function () {
        return new Promise(function (resolve, reject) {
            if (data.property.method === 'GET') {
                logger.info(`'${data.name}' _readRequest`);
                axios.get(data.property.address).then(res => {
                    lastTimestampRequest = new Date().getTime();
                    requestItemsMap = res.data;
                    resolve(parseData(res.data, data.property));
                }).catch(err => {
                    reject(err);
                });
            } else {
                reject();
            }
        });
    }

    /**
     * Clear the Tags values by setting to null
     * Emit to clients
     */
    var _clearVarsValue = function () {
        for (var id in varsValue) {
            varsValue[id].value = null;
        }
        _emitValues(varsValue);
    }

    /**
     * Emit the webapi connection status
     * @param {*} status 
     */
    var _emitStatus = function (status) {
        lastStatus = status;
        events.emit('device-status:changed', { id: data.name, status: status });
    }

    /**
     * Emit the webapi Tags values array { id: <name>, value: <value>, type: <type> }
     * @param {*} values 
     */
    var _emitValues = function (values) {
        events.emit('device-value:changed', { id: data.name, values: values });
    }

    /**
     * Used to manage the async connection and polling automation (that not overloading)
     * @param {*} check 
     */
    var _checkWorking = function (check) {
        if (check && working) {
            overloading++;
            logger.error(`'${data.name}' working (connection || polling) overload! ${overloading}`);
            // !The driver don't give the break connection
            if (overloading >= 3) {
                disconnect();
            } else {
                return false;
            }
        }
        working = check;
        overloading = 0;
        return true;
    }
}

function parseData(data, property) {
    if (property.format === 'CSV') {

    } else {
        return data;
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
    init: function (settings) {
        // deviceCloseTimeout = settings.deviceCloseTimeout || 15000;
    },
    create: function (data, logger, events) {
        return new HTTPclient(data, logger, events);
    },
    getRequestResult: getRequestResult
}