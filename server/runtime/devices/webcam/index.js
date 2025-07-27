/**
 *
 * Wrapper to communicate with Web-Cam
 */

'use strict';
const utils = require('../../utils');
const deviceUtils = require('../device-utils');
const path = require('path');
const fs = require('fs');
var NodeWebcam;

function WebCamClient(_data, _logger, _events, _manager, _runtime) {

    var data = JSON.parse(JSON.stringify(_data)); // Current Device data { id, name, tags, enabled, ... }
    var logger = _logger;
    var events = _events; // Events to commit change to runtime
    var manager = _manager;
    var runtime = _runtime;             // Access runtime config such as scripts
    var tagMap = {}
    var camMap = {}
    var varsValue = [];                 // Signal to send to frontend { id, type, value }
    var lastStatus = '';                // Last Device status
    var lastTimestampValue;             // Last Timestamp of asked values

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
            _emitStatus('connect-ok');
            resolve();
        })
        // events.emit('device-status:changed', { id: data.id, status: 'connect-error' });
    }


    /**
     * Disconnect the device
     * Emit connection status to clients, clear all Tags values
     */
    this.disconnect = function () {
        return new Promise(async function (resolve, reject) {
            _clearVarsValue()
            _emitStatus('connect-off');
            resolve(true);
        });

    }

    /**
     * Read values in polling mode
     * Used to refresh automatically the images
     */
    this.polling = async function () {
        var readVarsfnc = [];

        for (const camId in camMap) {
            readVarsfnc.push(_capture(camId, camMap[camId]));
        }

        try {
            const result = await Promise.all(readVarsfnc);
            if (result.length) {
                await _updateVarsValue(result);
            } else {
                // console.error('then error');
            }
            if (lastStatus !== 'connect-ok') {
                _emitStatus('connect-ok');
            }
        } catch (reason) {
            logger.error(`'${data.name}' _readVars error! ${reason}`);
        }
    }

    /**
     * Load Tags attribute to read with polling
     */
    this.load = function (_data) {
        data = JSON.parse(JSON.stringify(_data));
        camMap = {};
        varsValue = [];
        // console.log(data)
        for (const tagId in data.tags) {
            const tag = data.tags[tagId];
            try {
                camMap[tag.id] = NodeWebcam.create(tag.options);
            } catch (err) {
                logger.error(`load WebCam failed ${tag.name}`, err)
                continue
            }
            tagMap[tag.id] = tag;
            // Check webcam shots  folder
            if (!fs.existsSync(path.resolve(runtime.settings.webcamSnapShotsDir, tagId))) {
                fs.mkdirSync(path.resolve(runtime.settings.webcamSnapShotsDir, tagId));
            }
        }
        logger.info(`'${data.name}' data loaded `, true);
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
        return lastStatus
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
                options: data.tags[tagid].options,
            };
        } else {
            return null;
        }
    }

    /**
     * Set the Tag value to device
     * if value == true then take a capture and update the value
     */
    this.setValue = function (tagid, value) {
        if (value) {
            _capture(tagid, camMap[tagid]).then((result) => {
                _updateVarsValue([result]).then(() => {
                    if (lastStatus !== 'connect-ok') {
                        _emitStatus('connect-ok');
                    }
                })
            })
        }
    }

    /**
     * Return if device is connected
     */
    this.isConnected = function () {
        return true;
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
        console.error('Not supported!');
    }

    /**
     * Set Daq settings of Tag
     * @returns
     */
    this.setTagDaqSettings = (tagId, settings) => {
        console.error('Not supported!');
    }

    var _capture = async (tagId, camInstance) => {
        return new Promise((resolve, reject) => {
            camInstance.capture(path.resolve(runtime.settings.webcamSnapShotsDir, tagId, new Date().getTime().toString()),
                function (err, data) {
                    if (err) {
                        logger.error(`'${tagId}' capture failed! ${err}`);
                        reject({id: tagId, opts: camInstance.opts})
                    } else {
                        resolve({id: tagId, value: data.replace(runtime.settings.webcamSnapShotsDir, '')});
                    }
                });
        })
    }

    /**
     * Update the Tags values read
     * @param {*} vars
     */
    var _updateVarsValue = async (vars) => {
        const timestamp = new Date().getTime();
        var changed = {};
        vars.forEach((val) => {
            if (!utils.isNullOrUndefined(val)) {
                const valueChanged = !varsValue[val.id] || varsValue[val.id].value !== val.value;
                varsValue[val.id] = {
                    id: val.id,
                    value: val.value,
                    daq: tagMap[val.id].daq,
                    changed: valueChanged,
                    timestamp: timestamp
                };
            }
        })
        _emitValues(varsValue);
        return changed;
    }

    /**
     * Clear the Tags values by setting to null
     * Emit to clients
     */
    var _clearVarsValue = function () {
        for (var id in varsValue) {
            varsValue[id].value = null;
        }
        for (var id in tagMap) {
            tagMap[id].value = null;
        }
        _emitValues(varsValue);
    }

    /**
     * Emit the PLC Tags values array { id: <name>, value: <value>, type: <type> }
     * @param {*} values
     */
    var _emitValues = function (values) {
        lastTimestampValue = new Date().getTime();
        events.emit('device-value:changed', {id: data.id, values: values});
    }

    /**
     * Emit the PLC connection status
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
        //To use with plugin
        try {
            NodeWebcam = require('node-webcam');
        } catch {
        }
        if (!NodeWebcam && manager) {
            try {
                NodeWebcam = manager.require('node-webcam');
            } catch {
            }
        }
        if (!NodeWebcam) return null;
        return new WebCamClient(data, logger, events, manager, runtime);
    }
}
