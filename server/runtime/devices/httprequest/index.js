/**
 * 'http': webapi wrapper to manage REST API request
 */
'use strict';
const axios = require('axios');
const utils = require('../../utils');
const deviceUtils = require('../device-utils');

function HTTPclient(_data, _logger, _events) {
    var data = _data;                   // Current webapi data
    var logger = _logger;               // Logger var working = false;                // Working flag to manage overloading polling and connection
    var working = false;                // Working flag to manage overloading polling and connection
    var connected = false;              // Connected flag
    var events = _events;               // Events to commit change to runtime
    var lastStatus = '';                // Last webapi status
    var varsValue = [];                 // Signale to send to frontend { id, type, value }
    var requestItemsMap = {};           // Map of request (JSON, CSV, XML, ...) {key: item path, value: tag}
    var overloading = 0;                // Overloading counter to mange the break connection
    var lastTimestampRequest;           // Last Timestamp request
    var lastTimestampValue;             // Last Timestamp of asked values
    var newItemsCount;                  // Count of new items, between load and received

    var apiProperty = { getTags: null, postTags: null, format: 'JSON', ownFlag: true };

    /**
     * Connect the client by make a request
     */
    this.connect = function () {
        return new Promise(function (resolve, reject) {
            if (_checkConnection()) {
                try {
                    if (_checkWorking(true)) {
                        logger.info(`'${data.name}' try to connect ${apiProperty.getTags}`, true);
                        _clearVarsValue();
                        _emitStatus('connect-ok');
                        resolve();
                        connected = true;
                        lastTimestampRequest = new Date().getTime();
                        _checkWorking(false);
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
     * Update the tags values list, save in DAQ if value changed or in interval and emit values to clients
     */
    this.polling = function () {
        if (_checkWorking(true)) {
            // check connection status
            let dt = new Date().getTime();
            if ((lastTimestampRequest + (data.polling * 3)) < dt) {
                _emitStatus('connect-error');
                _checkWorking(false);
            }
            try {
                _readRequest().then(result => {
                    if (result) {
                        let varsValueChanged = _updateVarsValue(result);
                        lastTimestampValue = new Date().getTime();
                        _emitValues(varsValue);
                        if (this.addDaq) {
                            this.addDaq(varsValueChanged, data.name);
                        }
                        if (lastStatus !== 'connect-ok') {
                            _emitStatus('connect-ok');                    
                        }
                    }
                    _checkWorking(false);
                }, reason => {
                    logger.error(`'${data.name}' _readRequest error! ${reason}`);
                    _checkWorking(false);
                });
            } catch {
                _checkWorking(false);
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
    this.bindAddDaq = function (fnc) {
        this.addDaq = fnc;                          // Add the DAQ value to db history
    }
    this.addDaq = null;                             // Callback to add the DAQ value to db history

    /**
     * Return the timestamp of last read tag operation on polling
     * @returns 
     */
     this.lastReadTimestamp = () => {
        return lastTimestampValue;
    }

    /**
     * Load Tags to read by polling
     */
    this.load = function (_data) {
        varsValue = [];
        data = JSON.parse(JSON.stringify(_data));
        try {
            requestItemsMap = {};
            var count = Object.keys(data.tags).length;
            for (var id in data.tags) {
                const address = data.tags[id].address || data.tags[id].id;
                if (!requestItemsMap[address]) {
                    requestItemsMap[address] = [data.tags[id]];
                } else {
                    requestItemsMap[address].push(data.tags[id]);   
                }
            }
            logger.info(`'${data.name}' data loaded (${count})`, true);
        } catch (err) {
            logger.error(`'${data.name}' load error! ${err}`);
        }            
    }

    /**
     * Return Tag value { id: <name>, value: <value>, ts: <lastTimestampValue> }
     */
    this.getValue = function (id) {
        if (varsValue[id]) {
            return {id: id, value: varsValue[id].value, ts: lastTimestampValue };
        }
        return null;
    }

    /**
     * Return Tags values array { id: <name>, value: <value>, type: <type> }
     */
    this.getValues = function () {
        return varsValue;
    }

    /**
     * Set the Tag value, not used
     */
    this.setValue = function (tagId, value) {
        if (apiProperty.ownFlag && data.tags[tagId]) {
            if (apiProperty.postTags) {
                value = _parseValue(data.tags[tagId].type, value);
                data.tags[tagId].value = deviceUtils.tagRawCalculator(value, data.tags[tagId]);
                axios.post(apiProperty.getTags, [{id: tagId, value: data.tags[tagId].value}]).then(res => {
                    lastTimestampRequest = new Date().getTime();
                    logger.info(`setValue '${data.tags[tagId].name}' to ${value})`, true, true);
                }).catch(err => {
                    logger.error(`setValue '${data.tags[tagId].name}' error! ${err}`);
                });
            } else {
                logger.error(`postTags undefined (setValue)`, true);
            }
            return true;
        } else {
            logger.error(`setValue not supported!`, true);
        }
        return false;
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
        if (data.tags[id]) {
            return { id: id, name: data.tags[id].name, type: data.tags[id].type, format: data.tags[id].format };
        } else {
            return null;
        }
    }

    /**
     * Return Tags property
     */
    this.getTagsProperty = function () {
        return new Promise(function (resolve, reject) {
            try {
                resolve({ tags: Object.values(requestItemsMap), newTagsCount: newItemsCount });
            } catch (err) {
                reject(err);
            }
        });
    }

    var _checkConnection = function () {
        if (data.property.address) {
            apiProperty.getTags = data.property.address;
            apiProperty.ownFlag = false;
        } else {
            apiProperty.getTags = data.property.getTags;
            apiProperty.postTags = data.property.postTags;
        }
        return apiProperty.getTags || apiProperty.postTags;
    }

    var _readRequest = function () {
        return new Promise(function (resolve, reject) {
            if (apiProperty.getTags) {
                axios.get(apiProperty.getTags).then(res => {
                    lastTimestampRequest = new Date().getTime();
                    resolve(res.data);
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
     * Update the Tags values read
     * For WebAPI NotOwn: first convert the request data to a flat struct
     * @param {*} reqdata 
     */
    var _updateVarsValue = (reqdata) => {
        const timestamp = new Date().getTime();
        var changed = {};
        if (apiProperty.ownFlag) {
            var newItems = 0;
            for (var i = 0; i < reqdata.length; i++) {
                const id = reqdata[i].id;
                if (id) {
                    if (!data.tags[id]) {
                        newItems++;
                    } else {
                        reqdata[i].daq = data.tags[id].daq;
                    }
                    requestItemsMap[id] = [reqdata[i]];
                    reqdata[i].changed = varsValue[id] && reqdata[i].value !== varsValue[id].value;
                    if (!utils.isNullOrUndefined(reqdata[i].value)) {
                        reqdata[i].value = deviceUtils.tagValueCompose(reqdata[i].value, data.tags[id]);
                        reqdata[i].timestamp = timestamp;
                        if (this.addDaq && deviceUtils.tagDaqToSave(reqdata[i], timestamp)) {
                            changed[id] = reqdata[i];
                        }
                    }
                    reqdata[i].changed = false;
                    varsValue[id] = reqdata[i];
                }
            }
            newItemsCount = newItems;
            return changed;
        } else {
            var someval = false;
            var result = {};
            var items = dataToFlat(reqdata, apiProperty);
            for (var key in items) {
                if (requestItemsMap[key]) {
                    for (var index in requestItemsMap[key]) {
                        var tag = requestItemsMap[key][index];
                        if (tag) {
                            someval = true;
                            result[tag.id] = {
                                id: tag.id,
                                value: (tag.memaddress) ? items[tag.memaddress] : items[key],
                                type: items[key].type,
                                daq: tag.daq,
                                tagref: tag
                            };
                        }
                    }
                }
            }
            if (someval) {
                for (var id in result) {
                    result[id].changed = varsValue[id] && result[id].value !== varsValue[id].value;
                    if (!utils.isNullOrUndefined(result[id].value)) {
                        result[id].value = deviceUtils.tagValueCompose(result[id].value, result[id].tagref);
                        result[id].timestamp = timestamp;
                        if (this.addDaq && deviceUtils.tagDaqToSave(result[id], timestamp)) {
                            changed[id] = result[id];
                        }
                    }               
                    result[id].changed = false;
                    varsValue[id] = result[id];
                }
                return changed;
            }
        }
        return null;
    }

    /**
     * Emit the webapi connection status
     * @param {*} status 
     */
    var _emitStatus = function (status) {
        lastStatus = status;
        events.emit('device-status:changed', { id: data.id, status: status });
    }

    /**
     * Emit the webapi Tags values array { id: <name>, value: <value>, type: <type> }
     * @param {*} values 
     */
    var _emitValues = function (values) {
        events.emit('device-value:changed', { id: data.id, values: values });
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
                connected = false;
                // disconnect();
            } else {
                return false;
            }
        }
        working = check;
        overloading = 0;
        return true;
    }

    /**
     * Cheack and parse the value return converted value
     * @param {*} type as string
     * @param {*} value as string
     * return converted value
     */
    var _parseValue = function (type, value) {
        if (type === 'number') {
            return parseFloat(value); 
        } else if (type === 'boolean') {
            return Boolean(value);
        } else if (type === 'string') {
            return value;
        } else {
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
            return val;
        }
    }
}

function dataToFlat(data, property) {

    var parseTree = function(nodes, id, parent) {
        let result = {};
        let nodeId = id;
        if (parent) {
            nodeId = parent + ':' + nodeId;
        }
        if (Array.isArray(nodes)) {
            let idx = 0;
            for(var key in nodes) {
                let tres = parseTree(nodes[key], '[' + idx++ + ']', nodeId);
                Object.keys(tres).forEach( key => {
                    result[key] = tres[key]; 
                });
            }
        } else if (nodes && typeof nodes === 'object') {
            for(var key in nodes) {
                let tres = parseTree(nodes[key], key, nodeId);
                Object.keys(tres).forEach( key => {
                    result[key] = tres[key]; 
                });
            }
        } else {
            result[nodeId] = nodes; 
        }
        return result;
    }

    if (property.format === 'CSV') {

    } else if (property.format === 'JSON') {
        return parseTree(data);
    }
    return data;
}

/**
 * Return the result of http request
 */
function getRequestResult(property) {
    return new Promise(function (resolve, reject) {
        try {
            if (property.method === 'GET') {
                axios.get(property.address).then(res => {
                    resolve(res.data);
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