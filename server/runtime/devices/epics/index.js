/**
 * EPICS Channel Access client driver
 *
 * Uses node-epics-ca library to access EPICS PVs (Process Variables)
 * https://github.com/wanglin86769/node-epics-ca
 *
 * EPICS CA is connection-less, no explicit connect/disconnect needed.
 * Just set environment variables and use CA.get/put/monitor functions.
 */

'use strict';

const {IoEventTypes} = require("../../events");
const utils = require("../../utils");
const deviceUtils = require('../device-utils');
const CAInterface = require('./cainterface');

let caInterface = null;

function EpicsClient(_data, _logger, _events, _runtime) {

    var data = JSON.parse(JSON.stringify(_data)); // Current Device data { id, name, tags, enabled, ... }
    var logger = _logger;
    var events = _events; // Events to commit change to runtime
    var tagMap = {}
    var channelMap = {}                // Store PV Channel instances
    var varsValue = {};                // Signal to send to frontend { id, type, value }
    var lastStatus = '';                // Last Device status
    var lastTimestampValue;             // Last Timestamp of asked values
    var connected = false;              // Connection status
    var self = this;                   // Preserve context for callbacks
    var connectionErrors = 0;            // Track connection errors
    var pvErrorCounters = {};          // Track error count per PV
    var pvLastLogTime = {};            // Track last log time per PV
    
    // Ensure pvLastLogTime is available in broader scope if needed
    if (!pvLastLogTime) pvLastLogTime = {};
    var consecutivePollingErrors = 0;  // Track consecutive polling failures
    var maxConsecutiveErrors = 10;     // Max consecutive errors before aggressive throttling
    var isPollingActive = false;       // Prevent overlapping polling cycles
    var MAX_CONCURRENT_READS = 10;     // Increased since new interface is more efficient
    var PV_READ_TIMEOUT = 2000;         

    this.connect = function () {
        return new Promise(function (resolve, reject) {
            try {
                if (!caInterface) {
                    let libPath = data.property ? data.property.nodeEpicsCaLibca : null;
                    if (data.property && data.property.epicsAddrList) {
                        process.env.EPICS_CA_ADDR_LIST = data.property.epicsAddrList;
                    }
                    if (data.property && data.property.epicsAutoAddrList !== undefined) {
                        process.env.EPICS_CA_AUTO_ADDR_LIST = data.property.epicsAutoAddrList;
                    }
                    
                    caInterface = new CAInterface(libPath, logger);
                }

                connected = true;
                _emitStatus('connect-ok');
                logger.info(`'${data.name}' EPICS CA initialized`, true);
                resolve();
            } catch (err) {
                logger.error(`'${data.name}' initialization error! ${err}`);
                connected = false;
                _emitStatus('connect-error');
                reject(err);
            }
        });
    }

    /**
     * Disconnect from EPICS Channel Access
     */
    this.disconnect = function () {
        return new Promise(function (resolve, reject) {
            try {
                for (var tagId in channelMap) {
                    if (channelMap[tagId]) {
                        channelMap[tagId].destroy();
                    }
                }
                channelMap = {};
                pvErrorCounters = {};
                pvLastLogTime = {};

                _clearVarsValue();
                connected = false;
                _emitStatus('connect-off');
                logger.info(`'${data.name}' EPICS CA stopped`, true);
                resolve(true);
            } catch (err) {
                logger.error(`'${data.name}' disconnect error! ${err}`);
                reject(err);
            }
        });
    }

    /**
     * Read a single PV value
     */
    function _readPv(tagId, pvName, asString) {
        return new Promise((resolve, reject) => {
            if (!connected || !caInterface) {
                return reject(new Error('EPICS CA not connected'));
            }

            let channel = channelMap[tagId];
            if (!channel) {
                channel = caInterface.getChannel(pvName);
                channelMap[tagId] = channel;
            }

            if (!channel.connected) {
                return reject(new Error(`PV '${pvName}' not connected`));
            }

            const timeoutId = setTimeout(() => {
                reject(new Error('Read timeout'));
            }, PV_READ_TIMEOUT);

            channel.get(asString).then(value => {
                clearTimeout(timeoutId);
                pvErrorCounters[tagId] = 0;
                resolve({id: tagId, value: value});
            }).catch(err => {
                clearTimeout(timeoutId);
                pvErrorCounters[tagId] = (pvErrorCounters[tagId] || 0) + 1;
                reject(err);
            });
        });
    }

    /**
     * Execute promises in batches to limit concurrency and prevent system overload
     * This prevents alarm/script manager overload by limiting simultaneous async operations
     */
    function _executeBatched(promises, batchSize) {
        return new Promise(async (resolve, reject) => {
            const results = [];
            try {
                for (let i = 0; i < promises.length; i += batchSize) {
                    const batch = promises.slice(i, i + batchSize);
                    const batchResults = await Promise.allSettled(batch);
                    // Convert settled results back to resolved/rejected format
                    for (const result of batchResults) {
                        if (result.status === 'fulfilled') {
                            results.push(result.value);
                        } else {
                            // For rejected, still push error result for tracking
                            results.push({id: null, value: null, error: result.reason});
                        }
                    }
                }
                resolve(results);
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Read values in polling mode
     * Only read tags that are NOT monitored (tags with monitor=true get updates via callbacks in real-time)
     * 
     * CRITICAL: This function MUST return immediately (non-blocking) to prevent alarm/script manager overload
     * Use Fire-and-Forget pattern: start async operation but don't await it
     */
    this.polling = function () {
        // CRITICAL: Check if actually connected before polling
        if (!connected) {
            // Don't poll if not connected
            return;
        }

        // CRITICAL: Prevent overlapping polling cycles
        if (isPollingActive) {
            return;
        }

        // CRITICAL: Aggressive early return if any PV has errors
        var hasRecentErrors = false;
        for (var tagId in data.tags) {
            if (pvErrorCounters[tagId] > 1) {
                hasRecentErrors = true;
                break;
            }
        }
        
        if (hasRecentErrors) {
            consecutivePollingErrors++;
            if (consecutivePollingErrors % 3 !== 0) {
                return;  // Skip this polling cycle
            }
        }

        if (consecutivePollingErrors > maxConsecutiveErrors) {
            if (consecutivePollingErrors % 10 !== 0) {
                consecutivePollingErrors++;
                return;
            }
        }

        var readVarsfnc = [];
        var hasAnyPVsToRead = false;

        for (var tagId in data.tags) {
            var tag = data.tags[tagId];
            if (tag.monitor !== true) {
                hasAnyPVsToRead = true;
                
                if (pvErrorCounters[tagId] > 100) {
                    if (pvErrorCounters[tagId] % 1000 !== 0) {
                        pvErrorCounters[tagId]++;
                        continue;
                    }
                } else if (pvErrorCounters[tagId] > 2) {
                    if (pvErrorCounters[tagId] % 5 !== 0) {
                        pvErrorCounters[tagId]++;
                        continue;
                    }
                }

                var asString = tag.type === 'string';
                readVarsfnc.push(
                    _readPv(tag.id, tag.address, asString)
                    .catch(err => {
                        return {id: tag.id, value: null, error: err.message || err};
                    })
                );
            }
        }

        if (!hasAnyPVsToRead || readVarsfnc.length === 0) {
            consecutivePollingErrors = 0;
            return;
        }

        isPollingActive = true;
        _executeBatched(readVarsfnc, MAX_CONCURRENT_READS).then(result => {
            isPollingActive = false;
            if (result.length) {
                const validResults = result.filter(r => r.value !== null && !r.error);
                const failedResults = result.filter(r => r.error);
                
                if (validResults.length > 0) {
                    _updateVarsValue(validResults).catch(err => {
                        logger.error(`'${data.name}' update vars error: ${err}`);
                    });
                    consecutivePollingErrors = 0;
                } else if (failedResults.length === result.length) {
                    consecutivePollingErrors++;
                } else {
                    consecutivePollingErrors = Math.max(0, consecutivePollingErrors - 1);
                }
            }
            if (lastStatus !== 'connect-ok') {
                _emitStatus('connect-ok');
            }
        }).catch(reason => {
            isPollingActive = false;
            consecutivePollingErrors++;
            logger.error(`'${data.name}' polling error! ${reason}`);
            if (lastStatus !== 'connect-error') {
                _emitStatus('connect-error');
            }
        });
    }

    this.load = function (_data) {
        data = JSON.parse(JSON.stringify(_data));
        channelMap = {};
        varsValue = {};
        pvErrorCounters = {};
        pvLastLogTime = {};

        if (!caInterface) {
            this.connect().catch(err => {
                logger.error(`'${data.name}' failed to auto-connect on load: ${err}`);
            });
        }

        for (var tagId in data.tags) {
            var tag = data.tags[tagId];
            tagMap[tag.id] = tag;

            if (tag.monitor === true) {
                try {
                    let channel = caInterface.getChannel(tag.address);
                    channelMap[tag.id] = channel;

                    let capturedTagId = tag.id;
                    channel.on('value', (val) => {
                        pvErrorCounters[capturedTagId] = 0;
                        _updateVarsValue([{id: capturedTagId, value: val}], self);
                    });

                    channel.on('connection', (conn) => {
                        if (conn) {
                            channel.monitor(tag.type === 'string');
                            logger.info(`'${data.name}' Monitor active for PV '${tag.address}'`, true, true);
                        }
                    });

                    if (channel.connected) {
                        channel.monitor(tag.type === 'string');
                    }
                } catch (err) {
                    logger.error(`'${data.name}' failed to start monitor for PV '${tag.address}': ${err}`);
                }
            }
        }
        logger.info(`'${data.name}' data loaded (${Object.keys(data.tags).length} tags)`, true);
    }

    /**
     * Set the Tag value to device
     */
    this.setValue = async function (id, value) {
        if (!connected || !caInterface) {
            logger.error(`'${data.name}' cannot set value: not connected`);
            return false;
        }

        var tag = data.tags[id];
        if (tag && tag.address) {
            try {
                let channel = channelMap[id];
                if (!channel) {
                    channel = caInterface.getChannel(tag.address);
                    channelMap[id] = channel;
                }

                await channel.put(value, tag.type === 'string');

                if (varsValue[id]) {
                    varsValue[id].value = value;
                    varsValue[id].changed = true;
                }

                logger.info(`'${data.name}' setValue(${tag.name}=${tag.address}, ${value})`, true, true);
                return true;
            } catch (err) {
                logger.error(`'${data.name}' setValue(${tag.name}=${tag.address}, ${value}) error! ${err}`);
                return false;
            }
        }
        return false;
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
        return lastTimestampValue;
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
     * Return Tags values array { id: <name>, value: <value> }
     */
    this.getValues = function () {
        return varsValue;
    }

    /**
     * Return Tag value { id: <name>, value: <value>, ts: <lastTimestampValue> }
     */
    this.getValue = function (id) {
        if (varsValue[id]) {
            return {id: id, value: varsValue[id].value, ts: lastTimestampValue};
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
     * Return if device is connected
     */
    this.isConnected = function () {
        return connected;
    }

    /**
     * Return Tag property to show in frontend
     */
    this.getTagProperty = function (tagid) {
        if (data.tags[tagid]) {
            return {
                id: tagid,
                name: data.tags[tagid].name,
                address: data.tags[tagid].address,
                type: data.tags[tagid].type,
                monitor: data.tags[tagid].monitor,
                description: data.tags[tagid].description,
                error: pvErrorCounters[tagid] > 0
            };
        } else {
            return null;
        }
    }

    /**
     * Update the Tags values read
     * @param {*} vars
     * @param {*} context - Optional context to preserve 'this'
     */
    var _updateVarsValue = async (vars, context) => {
        const timestamp = new Date().getTime();
        var changed = {};
        var self = context || this;  // Preserve context for callbacks

        vars.forEach((val) => {
            if (!utils.isNullOrUndefined(val)) {
                var tag = tagMap[val.id];
                if (tag) {
                    var valueChanged = !varsValue[val.id] || varsValue[val.id].value !== val.value;
                    varsValue[val.id] = {
                        id: val.id,
                        value: val.value,
                        daq: tag.daq,
                        changed: valueChanged,
                        timestamp: timestamp
                    };

                    if (self.addDaq && deviceUtils.tagDaqToSave(varsValue[val.id], timestamp)) {
                        changed[val.id] = varsValue[val.id];
                    }
                    varsValue[val.id].changed = false;
                }
            }
        });

        _emitValues(varsValue);

        if (self.addDaq && !utils.isEmptyObject(changed)) {
            self.addDaq(changed, data.name, data.id);
        }
        return changed;
    }

    /**
     * Clear the Tags values by setting to null
     * Emit to clients
     */
    var _clearVarsValue = function () {
        for (var id in varsValue) {
            varsValue[id].value = null;
            varsValue[id].error = true; // Mark as error/unavailable on clear
        }
        for (var id in tagMap) {
            tagMap[id].value = null;
        }
        _emitValues(varsValue);
    }

    /**
     * Emit the EPICS Tags values array { id: <name>, value: <value>, type: <type> }
     * @param {*} values
     */
    var _emitValues = function (values) {
        lastTimestampValue = new Date().getTime();
        events.emit('device-value:changed', {id: data.id, values: values});
    }

    /**
     * Emit the EPICS connection status
     * @param {*} status
     */
    var _emitStatus = function (status) {
        lastStatus = status;
        events.emit('device-status:changed', {id: data.id, status: status});
    }
}

module.exports = {
    init: function (settings) {
        
    },
    create: function (data, logger, events, manager, runtime) {
        return new EpicsClient(data, logger, events, runtime);
    }
}
