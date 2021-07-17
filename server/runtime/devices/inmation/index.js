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
    var getProperty = null;             // Function to ask property (security)
    var options = {};                   // Connection options
    var itemsMap = {};                  // Items Mapped Tag name with Item path to find for set value

    // var browser = { client: new Client(), connected: false, timeout: 0 };

    /**
     * Connect the client to inmation server
     * Emit connection status, Clear the memory Topics value
     */    
    this.connect = function () {
        return new Promise(async function (resolve, reject) {
            if (data.property && data.property.address) {
                try {
                    if (_checkWorking(true)) {
                        logger.info(`'${data.name}' try to connect ${data.property.address}`, true);
                        _clearVarsValue();
                        options = getConnectionOptions(data.property)
                        if (getProperty) {
                            var result = await getProperty({query: 'security', name: data.id});
                            if (result && result.value && result.value !== 'null') {
                                // property security mode
                                var property = JSON.parse(result.value);
                                options.auth['authority'] = property.clientId;
                                options.auth['username'] = property.uid;
                                options.auth['password'] = property.pwd;
                                options.auth['grant_type'] = property.gt;
                            }
                        }
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
                            // const webAPIStatusInfo = connectionInfo.webapi_status || {};
                            // const webAPIStatus = webAPIStatusInfo.status || 'unknown'
                            // console.log(`Connection state: ${connectionInfo.state}, ${connectionInfo.stateString}, Authenticated: ${connectionInfo.authenticated}, Web API Status: ${webAPIStatus}`);
                            // const auditTrail = webAPIStatusInfo.audit_trail
                            // if (auditTrail) {
                            //     console.log(`Audit Trail enabled: ${auditTrail.enabled}, user_comment_mandatory: ${auditTrail.user_comment_mandatory}`);
                            // }
                            // const tokenResponse = connectionInfo.token_response
                            // if (tokenResponse) {
                            //     console.log(`Token response token_type: ${tokenResponse.token_type}, expires_in: ${tokenResponse.expires_in} seconds`);
                            //     console.log(`Token response access_token: ${tokenResponse.access_token}`);
                            // }
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
            if (client) {
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
     * Return the result of inmation browsing by configure it
     */
    // this.browse = function (topic, callback) {
    //     return new Promise(function (resolve, reject) {
    //         try {
    //             _resetBrowserTimeout();
    //             if (!browser.connected) {
    //                 browser.client.connectWS(options.url, function (err) {
    //                     if (err) {
    //                         browser.connected = false;
    //                         reject(err);
    //                     } else {
    //                         browser.connected = true;
    //                         resolve('ok');
    //                     }
    //                 }, options);
    //                 browser.client.onDataChanged((err, items) => {
    //                     if (err) console.log(err.message);
    //                     for (const item of items) {
    //                         if (callback) {
    //                             callback({ topic: item.p, msg: item.v.toString() });
    //                         }
    //                         console.log(`Path: ${item.p} value: ${item.v}`);
    //                     }
    //                 });
    //                 browser.client.onError((err) => {
    //                     reject(err);
    //                 });
    //                 client.on("close", function (err) {
    //                     console.log('mqtt browser closed');
    //                 });                    
    //             } else {
    //                 resolve('ok');
    //             }
    //             const items = [new model.Item(topic)];
    //             browser.client.subscribeToDataChanges(items, function() {
    //             });
    //         } catch (err) {
    //             reject('browse-error: ' + err);
    //         }
    //     });
    // }

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
     * Set function to ask property (security)
     */
     this.bindGetProperty = function (fnc) {
        getProperty = fnc;
    }

    /**
     * Load Items attribute to read with polling
     */
    this.load = function (_data) {
        varsValue = [];
        data = JSON.parse(JSON.stringify(_data));
        itemsMap = {};
        var count = Object.keys(data.tags).length;
        for (var tname in data.tags) {
            itemsMap[data.tags[tname].address] = tname;
        }
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
        if (client && connected && data.tags[sigid]) {
            let item = new model.Item(data.tags[sigid].address);
            let val = parseFloat(value);
            if (Number.isNaN(val)) {
                // maybe boolean
                val = Number(value);
                // maybe string
                if (Number.isNaN(val)) {
                    val = value;
                }
            } else {
                val = parseFloat(val.toFixed(5));
            }
            item.v = val;
            client.write([item], (err) => {
                if (err) {
                    logger.error(`'${data.name}'setValue ${err}`);
                }
            });
        }
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
            var topics = Object.keys(itemsMap).map((item) => new model.Item(item));
            client.subscribeToDataChanges(topics, (err) => {
                if (err) {
                    reject(err);
                } else {
                    client.onDataChanged((err, items) => {
                        if (err) {
                            logger.error(`'${data.name}'onDataChanged ${err}`);
                        }
                        for (const item of items) {
                            let tagname = itemsMap[item.p];
                            if (data.tags[tagname] && item.v !== undefined && item.v !== null) {
                                try {
                                    data.tags[tagname].value = item.v.toString();
                                    data.tags[tagname].timestamp = new Date().getTime();
                                    data.tags[tagname].changed = true;
                                } catch (error) {
                                    console.log(error);
                                }
                            }
                            // console.log(`Path: ${item.p} value: ${item.v}`);
                        }                
                    });
                    resolve();
                }
            });
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

    /**
     * Reset the timeout by browse the Topics, 10 seconds to receive published Topics
     */    
    // var _resetBrowserTimeout = function () {
    //     if (browser.timeout) {
    //         clearTimeout(browser.timeout);
    //     }        
    //     browser.timeout = setTimeout(() => {
    //         if (browser.client && browser.connected) {
    //             browser.client.disconnectWS();
    //         }
    //         browser.connected = false;
    //     }, 20000);
    // }
}

/**
 * Return connection option from device property
 * @param {*} property 
 */
 function getConnectionOptions (property) {
    return {
        url: property.address,
        auth: {},
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