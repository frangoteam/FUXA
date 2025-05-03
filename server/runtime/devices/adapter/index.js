/**
 * 'DeviceAdapter': A virtual device that acts as a logical interface to real devices.
 * It maps abstract tag names to actual tags of a selected device,
 * allowing HMI views to remain reusable and independent of specific device configurations.
 */
'use strict';
const Utils = require('../../utils');
const DeviceUtils = require('../device-utils');

function DeviceAdapter(_data, _logger, _events, _runtime) {

    var data = JSON.parse(JSON.stringify(_data));
    const logger = _logger;
    const events = _events;
    var varsValue = {};                     // Tags to send to frontend { id, type, value }
    var tagsMap = {};                       // Map adapter tag name and id tag
    var tocheck = false;                    // Flag that define if there are tags to check by polling
    var lastTimestampValue;                 // Last Timestamp of values
    var targetDevice = null;                // Target device to connect
    const runtime = _runtime;
    var lastStatus = '';                    // Last Device status
    var targetTagsMap = {};                 // Map target tag name and targetDevice tag, used to math with tagsMap

    this.init = function () {
    };

    this.connect = () => {
        return new Promise(async function (resolve, reject) {
            _emitStatus('connect-ok');
            resolve();
        });
    }


    this.disconnect = () =>  {
        return new Promise(function (resolve, reject) {
            _emitStatus('connect-off');
            _clearVarsValue();
            resolve(true);
        });
    }

    this.polling = async () => {
        try {
            if (tocheck) {
                await _checkVarsChanged();
                lastTimestampValue = new Date().getTime();
                _emitValues(varsValue);
            }
        } catch (err) {
            logger.error(`'${data.name}' polling error: ${err}`);
        }
    };

    /**
     * Load Tags attribute to read with polling
     */
    this.load = (_data) => {
        varsValue = [];
        data = JSON.parse(JSON.stringify(_data));
        tagsMap = {};
        var count = Object.keys(data.tags).length;
        for (var id in data.tags) {
            tagsMap[data.tags[id].name] = id;
            const dataTag = data.tags[id];
            if (dataTag.init) {
                data.tags[id].value = DeviceUtils.parseValue(dataTag.init, dataTag.type);
            }
            varsValue[id] = data.tags[id];
        }
        tocheck = !Utils.isEmptyObject(data.tags);
        logger.info(`'${data.name}' data loaded (${count})`, true);
    }

    /**
     * Return Tags values array { id: <tagId>, value: <value> }
     */
    this.getValues = () => {
        return varsValue;
    }

    /**
     * Return Tag value { id: <tagId>, value: <value>, ts: <lastTimestampValue> }
     */
    this.getValue = (id) => {
        if (varsValue[id]) {
            return { id: id, value: varsValue[id].value, ts: lastTimestampValue };
        }
        return null;
    };

    /**
     * Return connection status
     */
    this.getStatus = () => {
        return lastStatus;
    }

    /**
     * Return Tag property to show in frontend
     */
    this.getTagProperty = (id) => {
        if (data.tags[id]) {
            return { id: id, name: data.tags[id].name, type: data.tags[id].type, format: null };
        } else {
            return null;
        }
    }

    /**
     * Set the Tag value to device
     */
    this.setValue = (tagid, value) => {
        if (targetDevice) {
            const targetTagId = getTargetTagId(tagid);
            targetDevice.setValue(targetTagId, value);
        }
    }

    this.isConnected = () => {
        return lastStatus === 'connect-ok';
    }

    this.bindAddDaq = (fnc) => {
        //console.log('Not supported!');
    }

    this.lastReadTimestamp = () => {
        return lastTimestampValue;
    }

    this.getTagDaqSettings = (tagId) => {
        console.error('Not supported!');
    }

    this.setTagDaqSettings = (tagId, settings) => {
        console.error('Not supported!');
    }

    this.setDevice = (deviceName) => {
        _clearVarsValue();
        targetDevice = runtime.devices.getDevice(deviceName, false);
        if (!targetDevice) {
            logger.warn(`Adapter: target device '${deviceName}' not found.`);
            return;
        }
        logger.info(`Adapter ${data.name}: join device '${deviceName}'!`);
        const deviceTags = targetDevice.getValues();
        targetTagsMap = {};
        for (let tagId in deviceTags) {
            const tag = deviceTags[tagId];
            if (tag && tag.name) {
                targetTagsMap[tag.name] = tag.id
            }
        }
    }

    this.getTargetTagId = (tagId) => {
        const tagNameToMatch = data.tags[tagId].name;
        return targetTagsMap[tagNameToMatch];
    }

    var _clearVarsValue = function () {
        for (var id in varsValue) {
            varsValue[id].value = null;
        }
        _emitValues(varsValue);
    }

    /**
     * Return the Tags that have value changed and clear value changed flag of all Tags
     */
    var _checkVarsChanged = async () => {
        if (!targetDevice) {
            return;
        }
        const targetVarsValue = targetDevice.getValues();
        const timestamp = new Date().getTime();
        for (var id in data.tags) {
            const tagNameToMatch = data.tags[id].name;
            const targetTagId = targetTagsMap[tagNameToMatch];
            const tagId = tagsMap[tagNameToMatch];
            const targetTag = targetVarsValue[targetTagId];
            const tag = data.tags[tagId];
            if (targetTag && tag) {
                tag.value = targetTag.value;
                tag.timestamp = timestamp;
                varsValue[id] = tag;
            } else {
                //logger.warn(`'${data.name}' tag '${tagNameToMatch}' not found in target device '${targetDevice.getName()}'`);
            }
        }
        return varsValue;
    }

    /**
     * Emit the Tags values array { id: <name>, value: <value>, type: <type> }
     * @param {*} values
     */
    var _emitValues = function (values) {
        events.emit('device-value:changed', { id: data.name, values: values });
    }

    var _emitStatus = function (status) {
        lastStatus = status;
        events.emit('device-status:changed', { id: data.id, status: status });
    }
}


module.exports = {
    init: (settings) => {
    },
    create: (data, logger, events, runtime) => {
        return new DeviceAdapter(data, logger, events, runtime);
    }
}