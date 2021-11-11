/**
 * 'azure': az iothub client to manage iotedge devices
 */
'use strict';
const iothub = require('azure-iothub').Client;
const { EventHubConsumerClient } = require("@azure/event-hubs");

function AzIoTclient(_data, _logger, _events) {
    var data = _data;                   // Current data
    var logger = _logger;               // Logger var working = false;
    var working = false;                // Working flag to manage overloading polling and connection
    var events = _events;               // Events to commit change to runtime
    var lastStatus = '';                // Last connections status
    var varsValue = [];                 // Tags to send to frontend { id, type, value }
    var overloading = 0;                // Overloading counter to mange the break connection
    var daqInterval = 0;                // To manage minimum interval to save a DAQ value
    var lastDaqInterval = 0;            // To manage minimum interval to save a DAQ value
    var lastTimestampValue;             // Last Timestamp of asked values
    var options = {};
    var eventHubOptions = {};
    var eventCli = null;
    var iotHubCli = null;
    var topicsMap = {};                 // Map the topic subscribed, to check by on.message
    var memoryTagToPublish = new Map(); // Map tag to publish, content in topics as 'tag'
    var refTagToTopics = {};            // Map of Tag to Topic (with ref to other device tag)

    /**
     * Tag with options 'pubs' for publish and 'subs' for subscription
     */

    /**
     * Connect to iothub
     * Emit connection status, Clear the memory Topics value
     */
    this.connect = function () {
        return new Promise(async function (resolve, reject) {
            try {
                if (_checkWorking(true)) {
                    logger.info(`'${data.name}' try to connect`, true);
                    options = getConnectionOptions(data.property)
                    iotHubCli = iothub.fromConnectionString(options.hubConnStr);
                    eventCli = new EventHubConsumerClient(options.hubConsumerGroup, options.eventHubConnStr, eventHubOptions);
                    eventCli.subscribe({
                      processEvents: onMessages,
                      processError: onError,
                    });
                    logger.info(`'${data.name}' connected`, true);
                    _clearVarsValue();
                    _emitStatus('connect-ok');
                    _mapTopicsAddress(Object.values(data.tags));
                    resolve();
                    _checkWorking(false);
                } else {
                    reject();
                }
            } catch (err) {
                logger.error(`'${data.name}' try to connect error! ${err}`);
                _checkWorking(false);
                _emitStatus('connect-error');
                _clearVarsValue();
                reject();
                if (eventCli) {
                    eventCli.close();
                }
            }
        });
    }

    var onError = function (err) {
        logger.warn(`'${data.name}' receiver error message: ${err.message}`, true);
    };

    var onMessages = function (messages) {
        for (const message of messages) {
            if (message.systemProperties["iothub-connection-device-id"] !== options.deviceId) {
                continue;
            }
            if (message.systemProperties["iothub-connection-module-id"] !== options.moduleId) {
                continue;
            }
            for (const point of message.body["data"]) {
                if (point["plcName"] !== options.plcName) {
                    continue;
                }
                if (typeof topicsMap[point["pointName"]] === 'undefined') {
                    continue;
                }
                var id = topicsMap[point["pointName"]][0].id;
                data.tags[id].value = point["value"];
                data.tags[id].timestamp = new Date().getTime();
                data.tags[id].changed = true;
            }
        }
    };

    /**
     * Disconnect
     * Emit connection status, Clear the memory Topics value
     */
    this.disconnect = function () {
        return new Promise(function (resolve, reject) {
            if (eventCli) {
                eventCli.close();
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
     * Take the current Topics value (only changed), emit Topics value
     * Save DAQ value
     */
    this.polling = function () {
        if (_checkWorking(true)) {
            if (eventCli) {
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
     * Return the result of iotedge device's tags
     */
    this.browse = function (topic, callback) {
        return new Promise(async function (resolve, reject) {
        });
    }

    /**
     * Return if iotedge is connected
     */
    this.isConnected = function () {
        return true;
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
     * Load Topics attribute and map tags to publish
     */
    this.load = function (_data) {
        varsValue = [];
        refTagToTopics = {};
        data = JSON.parse(JSON.stringify(_data));
        try {
            var count = Object.keys(data.tags).length;
            // map depending tag ids
            for (var key in data.tags) {
                if (data.tags[key].options && data.tags[key].options.pubs) {
                    data.tags[key].options.pubs.forEach(item => {
                        if (item.type === 'tag' && item.value) {
                            // topic with json data with value from other device tags 
                            if (!memoryTagToPublish.has(item.value)) {
                                memoryTagToPublish.set(item.value, null);
                                events.emit('tag-change:subscription', item.value);
                            }
                            if (!refTagToTopics[item.value]) {
                                refTagToTopics[item.value] = { value: null, topics: [] };
                            }
                            refTagToTopics[item.value].topics.push(data.tags[key]);
                        } else if (item.type === 'value') {
                            // raw data (not depending from other tag)
                            item.value = '';
                        }
                    });
                }
            }
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
     * Set the Topic value, publish to broker (coming from frontend)
     */
    this.setValue = function (tagid, value) {
        return new Promise((resolve, reject) => {
            var methodParams = {};
            var updateValue = 0;
            if (data.tags[tagid]['address'] === "$status") {
                return
            } else if (data.tags[tagid]['address'] === "$rebirth") {
                methodParams = {
                    methodName: 'rebirth',
                    payload: {},
                    responseTimeoutInSeconds: 15 // set response timeout as 15 seconds
                  };
            } else {
                methodParams = {
                    methodName: 'writePoint',
                    payload: {
                        appName: options.appName,
                        plcName: options.plcName,
                        pointName: data.tags[tagid]['address'],
                        value: value
                    },
                    responseTimeoutInSeconds: 15 // set response timeout as 15 seconds
                  };
                updateValue = value
            }
            iotHubCli.invokeDeviceMethod(options.deviceId, options.moduleId, methodParams, function (err, result) {
              if (err) {
                console.error('Failed to invoke method \'' + methodParams.methodName + '\': ' + err.message);
              } else {
                console.log(methodParams.methodName + ' on ' + options.deviceId + ':');
                console.log(JSON.stringify(result, null, 2));
                data.tags[tagid].value = updateValue;
                data.tags[tagid].timestamp = new Date().getTime();
                data.tags[tagid].changed = true;
                resolve(result);
              }
            });
          });
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

    // todo
    /**
     * Create the receiver of change tag value for the dependency in payload
     */
    var _createRefPublishReceiver = function () {
        events.on('tag-value:changed', function (event) {
            try {
                if (memoryTagToPublish.has(event.id)) {
                    // for topic with raw data (not depending from other tag)
                    var oldValue = memoryTagToPublish.get(event.id);
                    memoryTagToPublish.set(event.id, event.value);
                    if (oldValue !== event.value && refTagToTopics[event.id]) {
                        if (refTagToTopics[event.id].topics.length) {
                            // for topic with json data with value from other device tags
                            // set the tag value in memory and publish the topic
                            for (var i = 0; i < refTagToTopics[event.id].topics.length; i++) {
                                _publishValues([refTagToTopics[event.id].topics[i]]);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error(err);
            }
        });
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
     * Emit the iothub client connection status
     * @param {*} status 
     */
    var _emitStatus = function (status) {
        lastStatus = status;
        events.emit('device-status:changed', { id: data.name, status: status });
    }

    /**
     * Emit the device Topics values array { id: <name>, value: <value>, type: <type> }
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
                    eventCli.close();
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
     * Publish the tags, called from polling and setValues (input in frontend)
     * to publish are only tags from other devices or topics created in iotedge device (by publish section)
     * @param {*} tags 
     */
    var _publishValues = function (tags) {
        // Object.keys(tags).forEach(key => {
        //     try {
        //         // publish only tags with pubs and value changed
        //         if (tags[key].options && tags[key].options.pubs && tags[key].options.pubs.length) {
        //             var topicTopuplish = {};
        //             tags[key].options.pubs.forEach(item => {
        //                 var value = '';
        //                 if (item.type === 'tag' && item.value) {        // tag from other devices
        //                     if (memoryTagToPublish.has(item.value)) {
        //                         value = memoryTagToPublish.get(item.value);
        //                     }
        //                 } else if (item.type === 'timestamp') {         // timestamp to add in tag with value
        //                     value = new Date().toISOString();
        //                 } else if (item.type === 'value') {             // tag created in iotedge device as value
        //                     value = item.value;
        //                 } else {    // item.type === 'static'
        //                     value = item.value;
        //                 }
        //                 if (tags[key].type === 'json') {
        //                     topicTopuplish[item.key] = value;
        //                 } else {    // payloand with row data, item.key is ''
        //                     if (topicTopuplish[0]) {
        //                         value = topicTopuplish[0] + ';' + value;
        //                     }
        //                     topicTopuplish[0] = value;
        //                 }
        //             });
        //             // payloand
        //             if (tags[key].type === 'json') {
        //                 client.publish(tags[key].address, JSON.stringify(topicTopuplish));
        //             } else if (topicTopuplish[0]) { // payloand with row data
        //                 client.publish(tags[key].address, Object.values(topicTopuplish)[0].toString());
        //             }
        //         } else if (tags[key].value) {   // whitout payload
        //             client.publish(tags[key].address, tags[key].value.toString());
        //             tags[key].value = null;
        //         }
        //     } catch (err) {
        //         console.error(err);
        //     }
        // })
    }
}

/**
 * Return connection option from device property
 * @param {*} property 
 */
function getConnectionOptions(property) {
    return {
        deviceId: property.deviceId,
        moduleId: property.moduleId,
        plcName: property.plcName,
        appName: property.appName,
        hubConnStr: property.hubConnStr,
        eventHubConnStr: property.eventHubConnStr,
        hubName: property.hubName,
        hubConsumerGroup: property.hubConsumerGroup
    }
}

module.exports = {
    init: function (settings) {
        // deviceCloseTimeout = settings.deviceCloseTimeout || 15000;
    },
    create: function (data, logger, events) {
        return new AzIoTclient(data, logger, events);
    }
}
