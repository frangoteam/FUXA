/**
 * 'FuxaServer': FUXA as device to use with the scripts
 */
 'use strict';

const utils = require('../../utils');
const deviceUtils = require('../device-utils');

 function FuxaServer(_data, _logger, _events) {

    var data = JSON.parse(JSON.stringify(_data)); // Current Device data { id, name, tags, enabled, ... }
    var logger = _logger;
    var working = false;                // Working flag to manage overloading polling and connection
    var events = _events;               // Events to commit change to runtime
    var varsValue = {};                 // Tags to send to frontend { id, type, value }
    var lastTimestampValue;             // Last Timestamp of values
    var tagsMap = {};                   // Map of tag id
    var overloading = 0;                // Overloading counter to mange the break connection
    var tocheck = false;                // Flag that define if there are tags to check by polling
    var type;

    /**
     * initialize the server device type 
     */
    this.init = function (_type) {
        type = _type;
    }

    /**
     * Connected with itself
     */
    this.connect = function () {
        return new Promise(async function (resolve, reject) {
            resolve();
        });
    }


    /**
     * Disconnect with itself
     * Clear all Tags values
     */
    this.disconnect = function () {
        return new Promise(function (resolve, reject) {
            _clearVarsValue();
            resolve(true);
        });
    }

    /**
     * Read values in polling mode 
     * Update the tags values list, save in DAQ if value changed or in interval and emit values to clients
     */
    this.polling = async function () {
        if (_checkWorking(true)) {
            try {
                if (tocheck) {
                    var varsValueChanged = _checkVarsChanged();
                    lastTimestampValue = new Date().getTime();
                    _emitValues(varsValue);
                    if (this.addDaq) {
                        this.addDaq(varsValueChanged, data.name);
                    }
                }
            } catch (err) {
                logger.error(`'${data.name}' polling error: ${err}`);
            }
            _checkWorking(false);
        }
    }

    /**
     * Load Tags attribute to read with polling
     */
    this.load = function (_data) {
        varsValue = [];
        data = JSON.parse(JSON.stringify(_data));
        tagsMap = {};
        var count = Object.keys(data.tags).length;
        for (var id in data.tags) {
            tagsMap[id] = data.tags[id];
            if (data.tags[id].init) {
                data.tags[id].value = _parseValue(data.tags[id].init);
            }
        }
        tocheck = !utils.isEmptyObject(data.tags);
        logger.info(`'${data.name}' data loaded (${count})`, true);
    }

    /**
     * Return Tags values array { id: <tagId>, value: <value> }
     */
    this.getValues = function () {
        return data.tags;
    }

    /**
     * Return Tag value { id: <tagId>, value: <value>, ts: <lastTimestampValue> }
     */
    this.getValue = function (id) {
        if (varsValue[id]) {
            return { id: id, value: varsValue[id].value, ts: lastTimestampValue };
        }
        return null;
    }

    /**
     * Return connection status FUXA server is always connected, 'connect-ok'
     */
    this.getStatus = function () {
        return 'connect-ok';
    }

    /**
     * Return Tag property to show in frontend
     */
    this.getTagProperty = function (id) {
        if (data.tags[id]) {
            let prop = { id: id, name: data.tags[id].name, type: data.tags[id].type };
            return prop;
        } else {
            return null;
        }
    }

    /**
     * Set the Tag value to device
     */
    this.setValue = function (id, value) {
        if (data.tags[id]) {
            var val = _parseValue(value);
            varsValue[id].value = val;
            varsValue[id].changed = true;
            logger.info(`'${data.name}' setValue(${id}, ${value})`, true);
        }
    }

    /**
     * Return connected with itself
     */
    this.isConnected = function () {
        return true;
    }

    /**
     * Bind the DAQ store function
     */
    this.bindAddDaq = function (fnc) {
        this.addDaq = fnc;                         // Add the DAQ value to db history
    }
    this.addDaq = null;      

    /**
     * Cheack and parse the value return converted value
     * @param {*} value as string
     */
    var _parseValue = function (value) {
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

    /**
     * Clear Tags value
     */
    var _clearVarsValue = function () {
        for (var id in varsValue) {
            varsValue[id].value = null;
        }
        _emitValues(varsValue);
    }

    /**
     * Return the Tags that have value changed and clear value changed flag of all Tags 
     */
    var _checkVarsChanged = () => {
        const timestamp = new Date().getTime();
        var result = {};
        for (var id in data.tags) {
            if (this.addDaq && !utils.isNullOrUndefined(data.tags[id].value) && deviceUtils.tagDaqToSave(data.tags[id], timestamp)) {
                result[id] = data.tags[id];
            }
            data.tags[id].changed = false;
            varsValue[id] = data.tags[id];
        }
        return result;
    }
    /**
     * Emit the Tags values array { id: <name>, value: <value>, type: <type> }
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
                disconnect();
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
    create: function (data, logger, events) {
        return new FuxaServer(data, logger, events);
    }
}