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
    var requestItemsMap = {};           // Map of request (JSON, CSV, XML, ...) {key: item path, value: tag}
    var overloading = 0;                // Overloading counter to mange the break connection
    var daqInterval = 0;                // Min save DAQ value interval, used to store DAQ too if the value don't change (milliseconds)
    var lastDaqInterval = 0;            // To manage minimum interval to save a DAQ value
    var lastTimestampRequest;           // Last Timestamp request
    var lastTimestampValue;             // Last Timestamp of asked values

    /**
     * Connect the client by make a request
     */
    this.connect = function () {
        return new Promise(function (resolve, reject) {
            if (data.property && data.property.address) {
                try {
                    if (_checkWorking(true)) {
                        logger.info(`'${data.name}' try to connect ${data.property.address}`, true);
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
     * Update the tags values list, save in DAQ if value changed or for daqInterval and emit values to clients
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
                            var current = new Date().getTime();
                            if (current - daqInterval > lastDaqInterval) {
                                this.addDaq(varsValue);
                                lastDaqInterval = current;
                            } else if (varsValueChanged) {
                                this.addDaq(varsValueChanged);
                            }
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
    this.bindAddDaq = function (fnc, intervalToSave) {
        this.addDaq = fnc;                          // Add the DAQ value to db history
        daqInterval = intervalToSave;
    }
    this.addDaq = null;                             // Callback to add the DAQ value to db history

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
                if (!requestItemsMap[data.tags[id].address]) {
                    requestItemsMap[data.tags[id].address] = [data.tags[id]];
                } else {
                    requestItemsMap[data.tags[id].address].push(data.tags[id]);   
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
    this.setValue = function (sigid, value) {
        logger.warn(`'${data.name}' setValue not supported!`);
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
            let prop = { id: id, name: data.tags[id].name, type: data.tags[id].type };
            return prop;
        } else {
            return null;
        }
    }

    var _readRequest = function () {
        return new Promise(function (resolve, reject) {
            if (data.property.method === 'GET') {
                axios.get(data.property.address).then(res => {
                    lastTimestampRequest = new Date().getTime();
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
     * Update the Tags values read
     * First convert the request data to a flat struct
     * @param {*} reqdata 
     */
    var _updateVarsValue = function (reqdata) {
        var someval = false;
        var changed = [];
        var result = [];
        var items = dataToFlat(reqdata, data.property);
        for (var key in items) {
            if (requestItemsMap[key]) {
                for (var index in requestItemsMap[key]) {
                    var tag = requestItemsMap[key][index];
                    if (tag) {
                        someval = true;
                        result[tag.id] = { id: tag.id, value: (tag.memaddress) ? items[tag.memaddress] : items[key], type: items[key].type };
                    } else {
                        someval = true;
                        result[tag.id] = { id: tag.id, value: items[key], type: requestItemsMap[key].type };
                    }
                }
            }
        }
        if (someval) {
            for (var id in result) {
                if (varsValue[id] !== result[id]) {
                    changed[id] = result[id];
                }
                varsValue[id] = result[id];
            }
            return changed;
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
}

function parseData(data, property) {
    if (property.format === 'CSV') {

    } else {
        return data;
    }    
}

function parseCSV(data) {

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