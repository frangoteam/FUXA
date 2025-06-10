/**
 * 'ROS client': ROS client to manage subscription and publish
 */

'use strict';
var ads;
var utils = require('../../utils');
const deviceUtils = require('../device-utils');

function ADSclient(_data, _logger, _events, _runtime) {

    var data = JSON.parse(JSON.stringify(_data)); // Current Device data { id, name, tags, enabled, ... }
    var logger = _logger;
    var events = _events;               // Events to commit change to runtime
    var runtime = _runtime;
    var working = false;                // Working flag to manage overloading polling and connection
    var connected = false;              // Connected flag
    var lastStatus = '';                // Last connections status
    var client = null;                  // ADS client head
    var varsValue = {};                 // Tags to send to frontend { id, type, value }
    var overloading = 0;                // Overloading counter to mange the break connection
    var lastTimestampValue;             // Last Timestamp of asked values
    var topicsMap = {};                 // Map the topic subscribed, to check by on.message

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
                        var ipAddress = data.property.address;
                        if (ipAddress.indexOf(':') !== -1) {
                            data.property.port = parseInt(data.property.address.substring(data.property.address.indexOf(':') + 1));
                            ipAddress = data.property.address.substring(0, data.property.address.indexOf(':'));
                        }
                        var options = {
                            targetAmsNetId: ipAddress,
                            targetAdsPort: data.property.port || 30012,
                            // routerAddress: 'localhost',      //PLC ip address
                            // routerTcpPort: data.property.port || 48898
                        };
                        if (data.property.local) {
                            var ipLocalNetId = data.property.local;
                            var ipLocalPort = 32750;
                            if (ipLocalNetId.indexOf(':') !== -1) {
                                ipLocalPort = parseInt(data.property.local.substring(data.property.local.indexOf(':') + 1));
                                ipLocalNetId = data.property.local.substring(0, data.property.local.indexOf(':'));
                            }
                            options = {
                                ...options,
                                localAmsNetId: ipLocalNetId,       //Can be anything but needs to be in PLC StaticRoutes.xml file
                                localAdsPort: ipLocalPort || 32750,
                            }
                        }
                        if (data.property.router) {
                            var ipRouterNetId = data.property.router;
                            var ipRouterPort = 48898;
                            if (ipRouterNetId.indexOf(':') !== -1) {
                                ipRouterPort = parseInt(data.property.router.substring(data.property.router.indexOf(':') + 1));
                                ipRouterNetId = data.property.router.substring(0, data.property.router.indexOf(':'));
                            }
                            options = {
                                ...options,
                                routerAddress: ipRouterNetId,           //PLC ip address
                                routerTcpPort: ipRouterPort || 48898    //PLC needs to have this port opened. Test disabling all firewalls if problems
                            }
                        }
                        client = new ads.Client(options);
                        _clearVarsValue();
                        client.connect().then((res) => {
                            logger.info(`'${data.name}' connected to ${res.targetAmsNetId}!`);
                            _emitStatus('connect-ok');
							browse();
                            _createSubscription().then(() => {
                                connected = true;
                                resolve();
                                _checkWorking(false);
                            }).catch(function (err) {
                                connected = false;
                                logger.error(err);
                                reject(err);
                                _checkWorking(false);
                            });
                        }).then(() => {
                            connected = false;
                            logger.warn(`'${data.name}' client disconnect, connection ended ${data.property.address}`, true);
                            resolve();
                        }).catch((err) => {
                            connected = false;
                            logger.error(`'${data.name}' try to connect error! ${err}`);
                            _checkWorking(false);
                            _emitStatus('connect-error');
                            reject(err);
                        });
                        client.on("connect", function (connectionInfo) {
                            connected = true;
                            logger.info(`'${data.name}' client connected ${connectionInfo.targetAmsNetId}`, false);
                        });
                        client.on("disconnect", function (connectionLost) {
                            connected = false;
                            logger.warn(`'${data.name}' client disconnect, got signal ${data.property.address}: ${connectionLost}`, true);
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

    function browse() {
        return new Promise(async function (resolve, reject) {
            if (client) {
                try {
                    var symbolObject = await client.getSymbols();
					var symbolList = Object.values(symbolObject);

                    var symbols = [];
                    for (var i = 0; i < symbolList.length; i++) {
                        var tag = new AdsSymbol(symbolList[i].name);
                        tag.type = symbolList[i].type;
                        tag.value = symbolList[i].value;
                        symbols.push(tag);
                    }

					// logger.warn(symbols);

                    resolve(symbols);
                } catch (err) {
                    logger.error(`'${data.name}' try to browse error! ${err}`);
                    _checkWorking(false);
                    _emitStatus('browse-error');
                    _clearVarsValue();
                    reject();
                }
            } else {
                logger.error(`'${data.name}' missing connection data!`);
                _emitStatus('browse-failed');
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
        return new Promise(async function (resolve, reject) {
            if (client) {
                try {
                    await client.unsubscribeAll();
                } catch (err) {
                    logger.error(`'${data.name}' try to unsubscribe error! ${err}`);
                }
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
        if (_checkWorking(true)) {
            if (client) {
                try {
                    var varsValueChanged = await _checkVarsChanged();
                    lastTimestampValue = new Date().getTime();
                    _emitValues(varsValue);

                    if (this.addDaq) {
                        this.addDaq(varsValueChanged, data.name);
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
     * Load Tags attribute to read with polling
     */
    this.load = function (_data) {
        varsValue = {};
        data = JSON.parse(JSON.stringify(_data));
        try {
            var count = Object.keys(data.tags).length;
            logger.info(`'${data.name}' data loaded (${count})`, true);
        } catch (err) {
            logger.error(`'${data.name}' load error! ${err}`);
        }
    }

    /**
     * Return Tags values array { id: <name>, value: <value> }
     */
    this.getValues = function () {
        return data.tags;
    }

    /**
     * Return Tag value { id: <name>, value: <value>, ts: <lastTimestampValue> }
     */
    this.getValue = function (tagId) {
        if (varsValue[tagId]) {
            return { id: tagId, value: varsValue[tagId].value, ts: lastTimestampValue };
        }
        return null;
    }

    /**
     * Return connection status 'connect-off', 'connect-ok', 'connect-error', 'connect-busy'
     */
    this.getStatus = function () {
        return lastStatus;
    }

    /**
     * Return Tag property to show in frontend
     */
    this.getTagProperty = function (tagId) {
        if (data.tags[tagId]) {
            return { id: tagId, name: data.tags[tagId].name, type: data.tags[tagId].type, format: data.tags[tagId].format };
        } else {
            return null;
        }
    }

    /**
     * Set the Tag value to device
     */
    this.setValue = async (tagId, value) => {
        if (client && client.connection.connected && data.tags[tagId]) {
            try {
                var valueToSend = await deviceUtils.tagRawCalculator(_toValue(data.tags[tagId].type, value), data.tags[tagId]);
                logger.info(`Writing ${valueToSend} to: '${data.tags[tagId].address}'`)
                const res = await client.writeValue(data.tags[tagId].address, valueToSend)

            } catch (err) {
                logger.error(`'${data.name}' setValue error! ${err}`);
            }
        }
    }

    /**
     * Return if device is connected
     */
    this.isConnected = function () {
        return (client) ? client.connection.connected : false;
    }

    /**
     * Bind the DAQ store function and default daqInterval value in milliseconds
     */
    this.bindAddDaq = function (fnc) {
        this.addDaq = fnc;                         // Add the DAQ value to db history
    }
    this.addDaq = null;

    /**
     * Return the timestamp of last read tag operation on polling
     * @returns
     */
    this.lastReadTimestamp = () => {
        return lastTimestampValue;
    }

    /**
     * Create a subscription to receive Topics value
     */
    var _createSubscription = function () {
        return new Promise(function (resolve, reject) {
            var topics = Object.values(data.tags).map(t => t.address);
            _mapTopicsAddress(Object.values(data.tags));
            if (topics && topics.length) {
              var count = 0;
              topics.forEach(async (topic) => {
                  try {
                      await client.subscribeValue(topic, _onChange, 1000, false);
                      count++;
                  } catch (err) {
                      logger.error(`'${data.name}' subscribe ${topic} error! ${err}`);
                      return
                  }
              });
              resolve();
            } else {
              resolve();
            }
        });
    }

    /**
     * Callback from monitor of changed Tag value
     * And set the changed value to local Tags
     * @param {*} _nodeId
     */
    const _onChange = (receivedData, sub) => {
        if (topicsMap[sub.symbol.name]) {
            for (var i = 0; i < topicsMap[sub.symbol.name].length; i++) {
                var id = topicsMap[sub.symbol.name][i].id;
                var oldvalue = data.tags[id].rawValue;
                data.tags[id].rawValue = receivedData.value;
                data.tags[id].timestamp = receivedData.timestamp.getTime();
                data.tags[id].changed = oldvalue !== receivedData.value;
            }
        }
    }

    /**
     * Map the topics to address (path)
     * @param {*} topics
     */
    var _mapTopicsAddress = function (topics) {
        var tmap = {};
        for (var i = 0; i < topics.length; i++) {
            if (tmap[topics[i].address]) {
                tmap[topics[i].address].push(topics[i]);
            } else {
                tmap[topics[i].address] = [topics[i]];
            }
        }
        topicsMap = tmap;
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
     * Return the Topics to publish that have value changed and clear value changed flag of all Topics
     */
    var _checkVarsChanged = async () => {
        const timestamp = new Date().getTime();
        var result = {};
        for (var id in data.tags) {
        		// logger.warn(`Tag ${id} has raw value ${data.tags[id].rawValue}`);
            if (!utils.isNullOrUndefined(data.tags[id].rawValue)) {
              data.tags[id].value = await deviceUtils.tagValueCompose(data.tags[id].rawValue, data.tags[id]);
              if (this.addDaq && deviceUtils.tagDaqToSave(data.tags[id], timestamp)) {
                  result[id] = data.tags[id];
              }
            }
            data.tags[id].changed = false;
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

    /**
     * Convert value from string depending of type
     * @param {*} type
     * @param {*} value
     */
    var _toValue = function (type, value) {
        switch (type) {
            case Datatypes.boolean:
                if (value && value.toLowerCase() !== 'false') {
                    return 1;
                }
                return 0;
            case Datatypes.number:
                return parseFloat(value);
            default:
                return value;
        }
    }
}

module.exports = {
    init: function (settings) {
    },
    create: function (data, logger, events, manager, runtime) {
        try { ads = require('ads-client'); } catch { }
        if (!ads && manager) { try { snap7 = manager.require('ads-client'); } catch { } }
        if (!ads) return null;
        return new ADSclient(data, logger, events, runtime);
    }
}

const Datatypes = {
    number: 'number',
    boolean: 'boolean',
    string: 'string'
}

function AdsSymbol(name) {
    this.name = name;
    this.type = '';
    this.value = '';
}
