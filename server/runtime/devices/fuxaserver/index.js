/**
 * 'FuxaServer': FUXA as device to use with the scripts
 */
 'use strict';

 function FuxaServer(_data, _logger, _events) {

    var data = JSON.parse(JSON.stringify(_data)); // Current Device data { id, name, tags, enabled, ... }
    var logger = _logger;
    var events = _events;               // Events to commit change to runtime
    var varsValue = {};                 // Tags to send to frontend { id, type, value }
    var daqInterval = 0;                // To manage minimum interval to save a DAQ value
    var lastTimestampValue;             // Last Timestamp of values
    var tagsMap = {};                   // Map of tag id
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
     * Update the tags values list, save in DAQ if value changed or for daqInterval and emit values to clients
     */
    this.polling = async function () {
        console.error('Not supported!');
        // events.emit('device-value:changed', { id: data.name, values: values });
    }

    /**
     * Load Tags attribute to read with polling
     */
    this.load = function (_data) {
        data = JSON.parse(JSON.stringify(_data));
        tagsMap = {};
        var count = Object.keys(data.tags).length;
        for (var tag in data.tags) {
            tagsMap[tag.id] = tag;
        }
        logger.info(`'${data.name}' data loaded (${count})`, true);
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
    this.getValue = function (tagid) {
        if (varsValue[id]) {
            return { id: id, value: varsValue[id].value, ts: lastTimestampValue };
        }
        return null;
    }

    /**
     * Return connection status 'connect-off', 'connect-ok', 'connect-error', 'connect-busy'
     */
    this.getStatus = function () {
        console.error('Not supported!');
    }

    /**
     * Return Tag property to show in frontend
     */
    this.getTagProperty = function (tagid) {
        if (data.tags[tagid]) {
            let prop = { id: tagid, name: data.tags[tagid].name, type: data.tags[tagid].type };
            return prop;
        } else {
            return null;
        }
    }

    /**
     * Set the Tag value to device
     */
    this.setValue = function (tagid, value) {
        if (data.tags[tagid]) {
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
            varsValue[tagid].value = val;
            logger.error(`'${data.name}'setValue ${err}`);
        }
    }

    /**
     * Return connected with itself
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
     * Clear tags value
     */
    var _clearVarsValue = function () {
        for (var id in varsValue) {
            varsValue[id].value = null;
        }
        _emitValues(varsValue);
    }

    /**
     * Emit the Tags values array { id: <name>, value: <value>, type: <type> }
     * @param {*} values 
     */
    var _emitValues = function (values) {
        events.emit('device-value:changed', { id: data.name, values: values });
    }
}

module.exports = {
    init: function (settings) {
    },
    create: function (data, logger, events) {
        return new FuxaServer(data, logger, events);
    }
}