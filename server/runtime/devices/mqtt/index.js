/**
 * 'mqtt': mqtt client to manage subscription and publish
 */
'use strict';
const mqtt = require('mqtt');
const utils = require('../../utils');
const deviceUtils = require('../device-utils');
const path = require('path');
const fs = require('fs');

function MQTTclient(_data, _logger, _events, _runtime) {
    var runtime = _runtime;
    var data = _data;                   // Current data
    var logger = _logger;               // Logger var working = false;
    var working = false;                // Working flag to manage overloading polling and connection
    var events = _events;               // Events to commit change to runtime
    var lastStatus = '';                // Last connections status
    var varsValue = {};                 // Tags to send to frontend { id, type, value }
    var overloading = 0;                // Overloading counter to mange the break connection
    var lastTimestampValue;             // Last Timestamp of asked values
    var getProperty = null;             // Function to ask property (security)
    var options = {};                   // MQTT client Connection options
    var client = null;                  // MQTT client head
    var browser = null;                 // MQTT client for browser subscription topics
    var timeoutBrowser;                 // Timeout to manage break the browsing
    var topicsMap = {};                 // Map the topic subscribed, to check by on.message
    var memoryTagToPublish = new Map(); // Map tag to publish, content in topics as 'tag'
    var refTagToTopics = {};            // Map of Tag to Topic (with ref to other device tag)

    const certificatesDir = _data.certificatesDir;

    /**
     * Tag with options 'pubs' for publish and 'subs' for subscription
     */

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
                        options.connectTimeout = 10 * 1000;
                        if (getProperty) {
                            var result = await getProperty({ query: 'security', name: data.id });
                            if (result && result.value && result.value !== 'null') {
                                // property security mode
                                var property = JSON.parse(result.value);
                                options.clientId = property.clientId;
                                options.username = property.uid;
                                options.password = property.pwd;
                                if (property.cert) {
                                    options.cert = fs.readFileSync(path.join(certificatesDir, property.cert));
                                }
                                if (property.pkey) {
                                    options.key = fs.readFileSync(path.join(certificatesDir, property.pkey));
                                }
                                if (property.caCert) {
                                    options.ca = fs.readFileSync(path.join(certificatesDir, property.caCert));
                                }
                            }
                        }
                        client = mqtt.connect(options.url, options);
                        _clearVarsValue();
                        client.on('connect', function () {
                            logger.info(`'${data.name}' connected!`);
                            _emitStatus('connect-ok');
                            _createSubscription().then(() => {
                                resolve();
                                _checkWorking(false);
                            }).catch(function (err) {
                                reject(err);
                                _checkWorking(false);
                            });
                            _createRefPublishReceiver();
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
                            if (client && !client.connected) {
                                client.end(true);
                            }
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
    this.polling = async function () {
        if (_checkWorking(true)) {
            if (client) {
                try {
                    var varsValueChanged = await _checkVarsChanged();
                    lastTimestampValue = new Date().getTime();
                    _emitValues(varsValue);

                    if (this.addDaq && !utils.isEmptyObject(varsValueChanged)) {
                        this.addDaq(varsValueChanged, data.name, data.id);
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
        return new Promise(async function (resolve, reject) {
            try {
                _resetBrowserTimeout();
                if (!browser || !browser.connected) {
                    let options = getConnectionOptions(data.property);
                    if (getProperty) {
                        var result = await getProperty({ query: 'security', name: data.id });
                        if (result && result.value && result.value !== 'null') {
                            // property security mode
                            var property = JSON.parse(result.value);
                            options.clientId = property.clientId;
                            options.username = property.uid;
                            options.password = property.pwd;
                        }
                    }
                    browser = mqtt.connect(options.url, options);
                    browser.on('connect', function () {
                        resolve('ok');
                    });
                    browser.on('message', function (topic, msg, pkt) {
                        if (callback) {
                            callback({ topic: topic, msg: msg.toString() });
                        }
                    });
                    browser.on("error", function (err) {
                        reject(err);
                    });
                    client.on("close", function (err) {
                        // console.info('mqtt browser closed');
                    });
                } else {
                    resolve('ok');
                }
                browser.subscribe(topic, function () {
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
     * Bind the DAQ store function
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
     * Set function to ask property (security)
     */
    this.bindGetProperty = function (fnc) {
        getProperty = fnc;
    }

    /**
     * Load Topics attribute and map tags to publish
     */
    this.load = function (_data) {
        varsValue = {};
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
    this.setValue = async function (tagId, value) {
        if (client && client.connected) {
            var tag = data.tags[tagId];
            if (tag) {
                if (tag.options) {
                    if (tag.options.pubs) {
                        for (const item of tag.options.pubs) {
                            if (item.type === 'value') {
                                item.value = await deviceUtils.tagRawCalculator(value, tag, runtime);
                            }
                        }
                    } else if (tag.options.subs && tag.options.subs.indexOf(tag.memaddress) !== -1) {
                        tag.value = await deviceUtils.tagRawCalculator(value, tag, runtime);
                    }
                }
                if (tag.type === 'raw') {
                    tag['value'] = await deviceUtils.tagRawCalculator(value, tag, runtime);
                }
                tag.changed = true;
                _publishValues([tag]);
                // logger.info(`'${data.name}' setValue(${tagId}, ${value})`, true, true);
                return true;
            }
        }
        return false;
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
            return { id: topic, name: data.tags[topic].name, type: data.tags[topic].type, format: data.tags[topic].format };
        } else {
            return null;
        }
    }

    /**
     * Return the Daq settings of Tag
     * @returns
     */
    this.getTagDaqSettings = (tagId) => {
        return data.tags[tagId] ? data.tags[tagId].daq : null;
    }

    /**
     * Set Daq settings of Tag
     * @returns
     */
    this.setTagDaqSettings = (tagId, settings) => {
        if (data.tags[tagId]) {
            utils.mergeObjectsValues(data.tags[tagId].daq, settings);
        }
    }

    /**
     * Create a subscription to receive Topics value
     */
    var _createSubscription = function () {
        return new Promise(function (resolve, reject) {
            var topics = Object.values(data.tags).map(t => t.address);
            _mapTopicsAddress(Object.values(data.tags));
            if (topics && topics.length) {
                client.subscribe(topics, function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        client.on('message', function (topicAddr, msg, pkt) {
                            if (topicsMap[topicAddr]) {
                                for (var i = 0; i < topicsMap[topicAddr].length; i++) {
                                    var id = topicsMap[topicAddr][i].id;
                                    var oldvalue = data.tags[id].rawValue;
                                    data.tags[id].rawValue = msg.toString();
                                    data.tags[id].timestamp = new Date().getTime();
                                    data.tags[id].changed = oldvalue !== data.tags[id].rawValue;
                                    if (data.tags[id].type === 'json' && data.tags[id].options && data.tags[id].options.subs && data.tags[id].memaddress) {
                                        try {
                                            var subitems = JSON.parse(data.tags[id].rawValue);
                                            if (!utils.isNullOrUndefined(subitems[data.tags[id].memaddress])) {
                                                data.tags[id].rawValue = subitems[data.tags[id].memaddress];
                                            } else {
                                                data.tags[id].rawValue = oldvalue;
                                            }
                                        } catch (err) {
                                            console.error(err);
                                        }
                                    }
                                }
                            }
                        });
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

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
     var _checkVarsChanged = async () => {
        const timestamp = new Date().getTime();
        var result = {};
        for (var id in data.tags) {
            if (!utils.isNullOrUndefined(data.tags[id].rawValue)) {
                data.tags[id].value = await deviceUtils.tagValueCompose(data.tags[id].rawValue, varsValue[id] ? varsValue[id].value : null, data.tags[id]);
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
        }, 15000);
    }

    /**
     * Publish the tags, called from polling and setValues (input in frontend)
     * to publish are only tags from other devices or topics created in mqtt device (by publish section)
     * @param {*} tags
     */
    var _publishValues = function (tags) {
        Object.keys(tags).forEach(key => {
            try {
                const topicOptions = { retain: true };
                // publish only tags with pubs and value changed
                if (tags[key].options && tags[key].options.pubs && tags[key].options.pubs.length) {
                    var topicTopuplish = {};
                    tags[key].options.pubs.forEach(item => {
                        var value = '';
                        if (item.type === 'tag' && item.value) {        // tag from other devices
                            if (memoryTagToPublish.has(item.value)) {
                                value = memoryTagToPublish.get(item.value);
                            }
                        } else if (item.type === 'timestamp') {         // timestamp to add in tag with value
                            value = new Date().toISOString();
                        } else if (item.type === 'value') {             // tag created in mqtt device as value
                            value = item.value;
                        } else {    // item.type === 'static'
                            value = item.value;
                        }
                        if (tags[key].type === 'json') {
                            topicTopuplish[item.key] = value;
                        } else {    // payloand with row data, item.key is ''
                            if (topicTopuplish[0]) {
                                value = topicTopuplish[0] + ';' + value;
                            }
                            topicTopuplish[0] = value;
                        }
                    });
                    // payloand
                    if (tags[key].type === 'json') {
                        client.publish(tags[key].address, JSON.stringify(topicTopuplish), topicOptions);
                    } else if (topicTopuplish[0] !== undefined) { // payloand with row data
                        client.publish(tags[key].address, Object.values(topicTopuplish)[0].toString(), topicOptions);
                    }
                } else if (tags[key].type === 'json' && tags[key].options && tags[key].options.subs && tags[key].options.subs.length) {
                    let obj = {};
                    obj[tags[key].memaddress] = tags[key].value;
                    client.publish(tags[key].address, JSON.stringify(obj), topicOptions);
                } else if (tags[key].value !== undefined) {   // whitout payload
                    client.publish(tags[key].address, tags[key].value.toString(), topicOptions);
                    tags[key].value = null;
                }
            } catch (err) {
                console.error(err);
            }
        })
    }
}

/**
 * Return connection option from device property
 * @param {*} property
 */
function getConnectionOptions(property) {
    return {
        url: property.address,
        username: property.username,
        password: property.password,
        keepalive: 60,
        connectTimeout: 1 * 1000,
        reconnectPeriod: 0
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
    create: function (data, logger, events, runtime) {
        return new MQTTclient(data, logger, events, runtime);
    }
}