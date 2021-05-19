/**
 * 'inmation': to use with inmation Web API server
 */
'use strict';
const { Client, model } = require('@inmation/inmation-api-client');

function INMATIONclient(_data, _logger, _events) {
    const client = new Client();
    var data = _data;                   // Current data
    var logger = _logger;               // Logger var working = false;
    var working = false;                // Working flag to manage overloading polling and connection
    var events = _events;               // Events to commit change to runtime
    var connected = false;              // Connected flag
    var lastStatus = '';                // Last connections status
    var varsValue = [];                 // Signale to send to frontend { id, type, value }
    var overloading = 0;                // Overloading counter to mange the break connection
    var daqInterval = 0;                // To manage minimum interval to save a DAQ value
    var lastDaqInterval = 0;            // To manage minimum interval to save a DAQ value
    var lastTimestampValue;             // Last Timestamp of asked values
    var options = {};
    var client = null;
    var timeoutBrowser;

    /**
     * Connect the client to inmation server
     * Emit connection status, Clear the memory Topics value
     */    
    this.connect = function () {
        return new Promise(function (resolve, reject) {
            if (data.property && data.property.address) {
                try {
                    if (_checkWorking(true)) {
                        logger.info(`'${data.name}' try to connect ${data.property.address}`, true);
                        _clearVarsValue();
                        options = getConnectionOptions(data.property)
                        client.connectWS(options.url, function (err) {
                            if (err) {
                                connected = false;
                                reject(err);
                            } else {
                                logger.info(`'${data.name}' connected!`, true);
                                connected = true;
                                _checkWorking(false);
                                _emitStatus('connect-ok');
                                _createSubscription().then(() => {
                                    resolve();
                                }).catch(function (err) {
                                    reject(err);
                                });
                            }
                        }, options);
                        client.onWSConnectionChanged((connectionInfo) => {
                            const webAPIStatusInfo = connectionInfo.webapi_status || {};
                            const webAPIStatus = webAPIStatusInfo.status || 'unknown'
                            console.log(`Connection state: ${connectionInfo.state}, ${connectionInfo.stateString}, Authenticated: ${connectionInfo.authenticated}, Web API Status: ${webAPIStatus}`);
                            const auditTrail = webAPIStatusInfo.audit_trail
                            if (auditTrail) {
                                console.log(`Audit Trail enabled: ${auditTrail.enabled}, user_comment_mandatory: ${auditTrail.user_comment_mandatory}`);
                            }
                            const tokenResponse = connectionInfo.token_response
                            if (tokenResponse) {
                                console.log(`Token response token_type: ${tokenResponse.token_type}, expires_in: ${tokenResponse.expires_in} seconds`);
                                console.log(`Token response access_token: ${tokenResponse.access_token}`);
                            }
                        });
                        // client.on("disconnect", function () {
                        //     logger.warn(`'${data.name}' client disconnect ${data.property.address}`, true);
                        // });
                        // client.on("close", function (err) {
                        //     logger.warn(`'${data.name}' client close ${data.property.address}`, true);
                        // });
                        client.onError(function (err) {
                            logger.error(`'${data.name}' try to connect error! ${err}`);
                            _checkWorking(false);
                            reject(err);
                        });
                    } else {
                        reject();
                    }
                } catch (err) {
                    logger.error(`'${data.name}' try to connect error! ${err}`);
                    _checkWorking(false);
                    _emitStatus('connect-error');
                    _clearVarsValue();
                    reject();
                    if (client) {
                        client.disconnectWS();
                    }
                }
            } else {
                logger.error(`'${data.name}' missing connection data!`);
                _emitStatus('connect-failed');
                _clearVarsValue();
                reject();
            }
        });        
    }

    /**
     * Disconnect the inmation server
     * Emit connection status, Clear the memory Items value
     */
    this.disconnect = function () {
        return new Promise(function (resolve, reject) {
            if (client) {
                client.disconnectWS();
                connected = false;
                _checkWorking(false);
                _emitStatus('connect-off');
                _clearVarsValue();
                resolve(true);
            }
            else {
                resolve(true);
            }
        });
    }

    /**
     * Take the current Items value (only changed), emit Items value
     * Save DAQ value
     */    
    this.polling = function () {
        if (_checkWorking(true)) {
            if (client && isConnected()) {
                try {
                    var varsValueChanged = _clearVarsChanged();
                    lastTimestampValue = new Date().getTime();
                    _emitValues(varsValue);

                    if (this.addDaq) {
                        var current = new Date().getTime();
                        if (current - daqInterval > lastDaqInterval) {
                            this.addDaq(data.tags);
                            lastDaqInterval = current;
                        } else if (Object.keys(varsValueChanged).length) {
                            this.addDaq(varsValueChanged);
                        }
                    }
                } catch (err) {
                    logger.error(`'${data.name}' polling error: ${err}`);
                }
                _checkWorking(false);
            } else {
                _checkWorking(false);
            }
        }
    }

    /**
     * Return if INMATION client is connected
     */
    this.isConnected = function () {
        return connected;
    }

    /**
     * Bind the DAQ store function and default daqInterval value in milliseconds
     */
    this.bindAddDaq = function (fnc, intervalToSave) {
        this.addDaq = fnc;                         // Add the DAQ value to db history
        daqInterval = intervalToSave;
    }
    this.addDaq = null;      

    /**
     * Load Items attribute to read with polling
     */
    this.load = function (_data) {
        varsValue = [];
        data = JSON.parse(JSON.stringify(_data));
        var count = Object.keys(data.tags).length;
        logger.info(`'${data.name}' data loaded (${count})`, true);
    }

    /**
     * Return Items value { id: <name>, value: <value>, ts: <timestamp> }
     */
    this.getValue = function (id) {
        if (varsValue[id]) {
            return { id: id, value: varsValue[id].value, ts: lastTimestampValue };
        }
        return null;
    }

    /**
     * Return Items values array { id: <name>, value: <value>, type: <type> }
     */
    this.getValues = function () {
        return data.tags;
    }

    /**
     * Set the Items value, publish to broker
     */
    this.setValue = function (sigid, value) {
        logger.error(`'${data.name}'setValue not supported`);
    }

    /**
     * Return Device status Connected/Disconnected 'connect-off', 'connect-ok', 'connect-error'
     */
    this.getStatus = function () {
        return lastStatus;
    }

    /**
     * Return Items property, not used (Items don't have property)
     */
    this.getTagProperty = function (topic) {
        if (data.tags[topic]) {
            let prop = { id: topic, name: data.tags[topic].name, type: data.tags[topic].type };
            return prop;
        } else {
            return null;
        }        
    }

    /**
     * Create a subscription to receive Items value
     */
    var _createSubscription = function () {
        return new Promise(function (resolve, reject) {
            client.onDataChanged( function(topic, msg, pkt) {
                if (data.tags[topic]) {
                    data.tags[topic].value = msg.toString();
                    data.tags[topic].timestamp = new Date().getTime();
                    data.tags[topic].changed = true;
                }
            });
            resolve();
        });   
    }

    /**
     * Clear local Items value by set all to null
     */
    var _clearVarsValue = function () {
        for (var id in varsValue) {
            varsValue[id].value = null;
        }
        _emitValues(varsValue);
    }

    
    /**
     * Return the Items that have value changed and clear value changed flag of all Items 
     */
    var _clearVarsChanged = function () {
        var result = {};
        for (var id in data.tags) {
            if (data.tags[id].changed) {
                data.tags[id].changed = false;
                result[id] = data.tags[id];
            }
            varsValue[id] = data.tags[id];
        }
        return result;
    }

    /**
     * Emit the INMATION client connection status
     * @param {*} status 
     */
    var _emitStatus = function (status) {
        lastStatus = status;
        events.emit('device-status:changed', { id: data.name, status: status });
    }

    /**
     * Emit the Items values to frontend array { id: <name>, value: <value>, type: <type> }
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
            logger.warn(`'${data.name}' working (connection || polling) overload! ${overloading}`);
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

module.exports = {
    init: function (settings) {
        // deviceCloseTimeout = settings.deviceCloseTimeout || 15000;
    },
    create: function (data, logger, events) {
        return new INMATIONclient(data, logger, events);
    }
}