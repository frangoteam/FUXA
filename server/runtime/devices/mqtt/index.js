/**
 * 'mqtt': mqtt client to manage subscription and publish
 */
'use strict';
const mqtt = require('mqtt');

function MQTTclient(_data, _logger, _events) {
    var data = _data;                   // Current data
    var logger = _logger;               // Logger var working = false;
    var working = false;                // Working flag to manage overloading polling and connection
    var events = _events;               // Events to commit change to runtime
    var lastStatus = '';                // Last connections status
    var varsValue = [];                 // Signale to send to frontend { id, type, value }
    var overloading = 0;                // Overloading counter to mange the break connection
    var daqInterval = 0;                // To manage minimum interval to save a DAQ value
    var lastDaqInterval = 0;            // To manage minimum interval to save a DAQ value
    var lastTimestampValue;             // Last Timestamp of asked values
    var getProperty = null;             // Function to ask property (security)
    var options = {};
    var client = null;
    var browser = null;
    var timeoutBrowser;

    /**
     * Connect the mqtt client to broker
     * Emit connection status, Clear the memory Topics value
     */    
    this.connect = function () {
        return new Promise(async function (resolve, reject) {
            if (data.property && data.property.address) {
                try {
                    if (_checkWorking(true)) {
                        logger.info(`'${data.name}' try to connect ${data.property.address}`, true);
                        options = getConnectionOptions(data.property)
                        options.connectTimeout = 5 * 1000;
                        if (getProperty) {
                            var result = await getProperty({query: 'security', name: data.name});
                            if (result && result.value && result.value !== 'null') {
                                // property security mode
                                var property = JSON.parse(result.value);
                                options.clientId = property.clientId;
                                options.username = property.username;
                                options.password = property.password;
                            }
                        }
                        client = mqtt.connect(options.url, options);
                        _clearVarsValue();
                        client.on('connect', function () {
                            logger.info(`'${data.name}' connected!`, true);
                            _checkWorking(false);
                            _emitStatus('connect-ok');
                            _createSubscription().then(() => {
                                resolve();
                            }).catch(function (err) {
                                reject(err);
                            });
                        });
                        client.on("offline", function () {
                            logger.warn(`'${data.name}' client offline ${data.property.address}`, true);
                        });
                        client.on("disconnect", function () {
                            logger.warn(`'${data.name}' client disconnect ${data.property.address}`, true);
                        });
                        client.on("reconnect", function (err) {
                            logger.warn(`'${data.name}' client reconnecting ... ${data.property.address}`, true);
                        });
                        client.on("close", function (err) {
                            logger.warn(`'${data.name}' client close ${data.property.address}`, true);
                        });
                        client.on("error", function (err) {
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
                        client.end(true);
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
     * Disconnect the mqtt client
     * Emit connection status, Clear the memory Topics value
     */
    this.disconnect = function () {
        return new Promise(function (resolve, reject) {
            if (client) {
                client.end(true, function (err) {
                    if (err) {
                        logger.error(`'${data.name}' disconnect failure! ${err}`);
                    }
                    _checkWorking(false);
                    _emitStatus('connect-off');
                    _clearVarsValue();
                    resolve(true);
                });
            }
            else {
                resolve(true);
            }
        });
    }

    /**
     * Take the current Topics value (only changed), emit Topics value
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
     * Return the result of mqtt browsing by configure it
     */
    this.browse = function (topic, callback) {
        return new Promise(function (resolve, reject) {
            try {
                _resetBrowserTimeout();
                if (!browser || !browser.connected) {
                    let opts = getConnectionOptions(data.property);
                    browser = mqtt.connect(opts.url, opts);
                    browser.on('connect', function () {
                        resolve('ok');
                    });
                    browser.on('message', function(topic, msg, pkt) {
                        if (callback) {
                            callback({ topic: topic, msg: msg.toString() });
                        }
                    });
                    browser.on("error", function (err) {
                        reject(err);
                    });
                    client.on("close", function (err) {
                        console.log('mqtt browser closed');
                    });                    
                } else {
                    resolve('ok');
                }
                browser.subscribe(topic, function() {
                });
            } catch (err) {
                reject('browse-error: ' + err);
            }
        });
    }

    /**
     * Return if mqtt client is connected
     */
    this.isConnected = function () {
        return (client) ? client.connected : false;
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
     * Load Topics attribute to read with polling
     */
    this.load = function (_data) {
        varsValue = [];
        data = JSON.parse(JSON.stringify(_data));
        try {
            var count = Object.keys(data.tags).length;
            logger.info(`'${data.name}' data loaded (${count})`, true);
        } catch (err) {
            logger.error(`'${data.name}' load error! ${err}`);
        }
    }

    /**
     * Return Topic value { id: <name>, value: <value>, ts: <timestamp> }
     */
    this.getValue = function (id) {
        if (varsValue[id]) {
            return { id: id, value: varsValue[id].value, ts: lastTimestampValue };
        }
        return null;
    }

    /**
     * Return Topics values array { id: <name>, value: <value>, type: <type> }
     */
    this.getValues = function () {
        return data.tags;
    }

    /**
     * Set the Topic value, publish to broker
     */
    this.setValue = function (sigid, value) {
        if (client && client.connected) {
            client.publish(sigid, value);
        }
    }

    /**
     * Return Device status Connected/Disconnected 'connect-off', 'connect-ok', 'connect-error'
     */
    this.getStatus = function () {
        return lastStatus;
    }

    /**
     * Return Topic property, not used (Topics don't have property)
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
     * Create a subscription to receive Topics value
     */
    var _createSubscription = function () {
        return new Promise(function (resolve, reject) {
            var topics = Object.keys(data.tags);
            client.subscribe(topics, function (err) {
                if (err) {
                    reject(err);
                } else {
                    client.on('message', function(topic, msg, pkt) {
                        if (data.tags[topic]) {
                            data.tags[topic].value = msg.toString();
                            data.tags[topic].timestamp = new Date().getTime();
                            data.tags[topic].changed = true;
                        }
                    });
                    resolve();
                }
            });     
        });   
    }

    /**
     * Clear local Topics value by set all to null
     */
    var _clearVarsValue = function () {
        for (var id in varsValue) {
            varsValue[id].value = null;
        }
        _emitValues(varsValue);
    }

    
    /**
     * Return the Topics that have value changed and clear value changed flag of all Topics 
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
     * Emit the mqtt client connection status
     * @param {*} status 
     */
    var _emitStatus = function (status) {
        lastStatus = status;
        events.emit('device-status:changed', { id: data.name, status: status });
    }

    /**
     * Emit the http Topics values array { id: <name>, value: <value>, type: <type> }
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
    var _resetBrowserTimeout = function () {
        if (timeoutBrowser) {
            clearTimeout(timeoutBrowser);
        }        
        timeoutBrowser = setTimeout(() => {
            if (browser && browser.connected) {
                browser.end(true);
            }
        }, 10000);
    }
}

/**
 * Return connection option from device property
 * @param {*} property 
 */
function getConnectionOptions (property) {
    return {
        url: property.address,
        username: property.username,
        password: property.password,
        keepalive: 60,
        connectTimeout: 1 * 1000
    //   tls: options.encryption,
    //   clientId: options.clientId,
    //   certValidation: options.certValidation,
    //   subscriptions: options.subscriptions,
    //   certificateAuthority: options.selfSignedCertificate ? options.selfSignedCertificate.data : undefined,
    //   clientCertificate: options.clientCertificate ? options.clientCertificate.data : undefined,
    //   clientKey: options.clientKey ? options.clientKey.data : undefined,
    }
}

module.exports = {
    init: function (settings) {
        // deviceCloseTimeout = settings.deviceCloseTimeout || 15000;
    },
    create: function (data, logger, events) {
        return new MQTTclient(data, logger, events);
    }
}