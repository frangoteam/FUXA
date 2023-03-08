/**
 * 'ROS client': ROS client to manage subscription and publish 
 */

'use strict';
const ads = require('ads-client');

function ADSclient(_data, _logger, _events) {

    var data = JSON.parse(JSON.stringify(_data)); // Current Device data { id, name, tags, enabled, ... }
    var logger = _logger;
    var events = _events;               // Events to commit change to runtime
    var working = false;                // Working flag to manage overloading polling and connection
    var connected = false;              // Connected flag
    var lastStatus = '';                // Last connections status
    var client = null;                  // ADS client head
    var varsValue = {};                 // Tags to send to frontend { id, type, value }
    var overloading = 0;                // Overloading counter to mange the break connection

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
        return new Promise(async function (resolve, reject) {
            if (data.property && data.property.address) {
                try {
                    if (_checkWorking(true)) {
                        var options = {
                            targetAmsNetId: data.property.address,
                            targetAdsPort: data.property.address.port || 851,
                            // localAmsNetId: '192.168.1.10',       //Can be anything but needs to be in PLC StaticRoutes.xml file
                            // localAdsPort: 32750, 
                            // routerAddress: '192.168.1.120',      //PLC ip address
                            // routerTcpPort: 48898   
                        };
                        client = new ads.Client(options);
                        _clearVarsValue();
                        client.connect().then((res) => {
                            logger.info(`'${data.name}' connected to ${res.targetAmsNetId}!`);
                            _emitStatus('connect-ok');
                            _createSubscription().then(() => {
                                connected = true;
                                resolve();
                                _checkWorking(false);
                            }).catch(function (err) {
                                connected = false;
                                reject(err);
                                _checkWorking(false);
                            });
                        }).then(() => {
                            connected = false;
                            logger.warn(`'${data.name}' client disconnect ${data.property.address}`, true);
                            resolve();
                        }).catch((err) => {
                            connected = false;
                            logger.error(`'${data.name}' try to connect error! ${err}`);
                            _checkWorking(false);
                            reject(err);
                        });
                        client.on("connect", function (connectionInfo) {
                            connected = true;
                            logger.info(`'${data.name}' client connected ${connectionInfo}`, false);
                        });
                        client.on("disconnect", function () {
                            connected = false;
                            logger.warn(`'${data.name}' client disconnect ${data.property.address}`, true);
                        });
                        client.on("reconnect", function () {
                            connected = true;
                            logger.warn(`'${data.name}' client reconnecting ... ${data.property.address}`, true);
                        });
                        client.on("ads-client-error", function (err) {
                            logger.error(`'${data.name}' error! ${err}`);
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
     * Disconnect the device
     * Emit connection status to clients, clear all Tags values
     */
    this.disconnect = function () {
        return new Promise(function (resolve, reject) {
            if (client) {
                try {
                    client.disconnect();
                } catch (err) {
                    logger.error(`'${data.name}' try to disconnect error! ${err}`);
                    connected = false;
                }
                logger.info(`'${data.name}' disconnected!`, true);
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
        return connected;
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

    /**
     * Create a subscription to receive Topics value
     */
    var _createSubscription = function () {
        return new Promise(function (resolve, reject) {
            var topics = Object.values(data.tags).map(t => t.address);
            // _mapTopicsAddress(Object.values(data.tags));
            if (topics && topics.length) {
                // client.subscribe(topics, function (err) {
                //     if (err) {
                //         reject(err);
                //     } else {
                //         client.on('message', function (topicAddr, msg, pkt) {
                //             if (topicsMap[topicAddr]) {
                //                 for (var i = 0; i < topicsMap[topicAddr].length; i++) {
                //                     var id = topicsMap[topicAddr][i].id;
                //                     var oldvalue = data.tags[id].rawValue;
                //                     data.tags[id].rawValue = msg.toString();
                //                     data.tags[id].timestamp = new Date().getTime();
                //                     data.tags[id].changed = oldvalue !== data.tags[id].rawValue;
                //                     if (data.tags[id].type === 'json' && data.tags[id].options && data.tags[id].options.subs && data.tags[id].memaddress) {
                //                         try {
                //                             var subitems = JSON.parse(data.tags[id].rawValue);
                //                             if (!utils.isNullOrUndefined(subitems[data.tags[id].memaddress])) {
                //                                 data.tags[id].rawValue = subitems[data.tags[id].memaddress];
                //                             } else {
                //                                 data.tags[id].rawValue = oldvalue;
                //                             }
                //                         } catch (err) {
                //                             console.error(err);
                //                         }
                //                     }
                //                 }
                //             }
                //         });
                        resolve();
                //     }
                // });
            } else {
                resolve();
            }
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
     * Emit the mqtt client connection status
     * @param {*} status 
     */
    var _emitStatus = function (status) {
        lastStatus = status;
        events.emit('device-status:changed', { id: data.name, status: status });
    }

    /**
     * Emit the mqtt Topics values array { id: <name>, value: <value>, type: <type> }
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
                try {
                    if (client) client.end(true);
                } catch (e) {
                    console.error(e);
                }
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
    },
    create: function (data, logger, events, manager) {
        // To use with plugin
        // try { TemplateDriver = require('template-driver'); } catch { }
        // if (!TemplateDriver && manager) { try { TemplateDriver = manager.require('template-driver'); } catch { } }
        // if (!TemplateDriver) return null;

        return new ROSclient(data, logger, events);
    }
}
