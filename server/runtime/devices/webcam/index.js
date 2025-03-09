/**
 * template to define owner device driver communication
 */

'use strict';
const utils = require('../../utils');
const deviceUtils = require('../device-utils');
var NodeWebcam;

function WebCamClient(_data, _logger, _events, _manager) {

    var data = JSON.parse(JSON.stringify(_data)); // Current Device data { id, name, tags, enabled, ... }
    var logger = _logger;
    var events = _events; // Events to commit change to runtime
    var manager = _manager;
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
        // console.error('Not supported!');
        _emitStatus('connect-ok');
        // events.emit('device-status:changed', { id: data.id, status: 'connect-error' });
    }


    /**
     * Disconnect the device
     * Emit connection status to clients, clear all Tags values
     */
    this.disconnect = function () {
        _clearVarsValue()
        _emitStatus('connect-off');
    }

    /**
     * Read values in polling mode
     * Update the tags values list, save in DAQ if value changed or in interval and emit values to clients
     */
    this.polling = async function () {
        var readVarsfnc = [];

        for (const camId in camMap) {
            readVarsfnc.push(await _capture(camId, camMap[camId]));
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
    this.getValue = function (tagid) {
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
     */
    this.setValue = function (tagid, value) {
        console.error('Not supported!');
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

    var _capture = async (tagId, camInstance) => {
        return new Promise((resolve, reject) => {
            camInstance.capture(runtime.settings.webcamShotsDir, function (err, data) {
                if (err) {
                    logger.error(`'${data.name}' capture failed! ${err}`);
                } else {
                    resolve({id: tagId, value: data});
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
                if (this.addDaq && deviceUtils.tagDaqToSave(varsValue[val.id], timestamp)) {
                    changed[val.id] = varsValue[val.id];
                }
                varsValue[val.id].changed = false;
            }
        })
        _emitValues(varsValue);
        if (this.addDaq && !utils.isEmptyObject(changed)) {
            this.addDaq(changed, data.name, data.id);
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
    create: function (data, logger, events, manager) {
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
        return new WebCamClient(data, logger, events, manager);
    }
}
