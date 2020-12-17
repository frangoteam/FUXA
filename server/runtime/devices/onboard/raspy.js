/**
 * 'rapsy': raspberyy GPIO wrapper to control hardware GPIO 
 */

'use strict';
var Gpio;

function RASPYclient(_data, _logger, _events) {
    var digitals = {};            // Loaded GPIOItem { GPIO index, id: [id], res: new Gpio(index, 'out'/'in'): changed: bool, in: false/true, value: xy }
    var data = JSON.parse(JSON.stringify(_data));                   // Current Device data { id, name, tags, enabled, ... }
    var logger = _logger;  
    var working = false;                // Working flag to manage overloading polling and connection
    var events = _events;               // Events to commit change to runtime
    var lastStatus = '';                // Last Device status
    var varsValue = [];                 // Signale to send to frontend { id, type, value }
    var daqInterval = 0;                // Min save DAQ value interval, used to store DAQ too if the value don't change (milliseconds)
    var lastDaqInterval = 0;            // Help to check daqInterval
    var overloading = 0;                // Overloading counter to mange the break connection
    var lastTimestampValue;             // Last Timestamp of asked values
    var connected = false;

    /**
     * Connect Export GPIO as input and output
     * Emit connection status to clients, clear all Tags values
     */
    this.connect = function () {
        return new Promise(function (resolve, reject) {
            if (Gpio) {
                logger.info(`'${data.name}' connected!`, true);
                _emitStatus('connect-ok');
                Object.values(digitals).forEach(io => {
                    if (io.in) {
                        io.res.watch((err, value) => {
                            if (err) {
                              throw err;
                            }
                            logger.trace(`'${io.id}' ${value}`);
                            io.value = value;
                            io.changed = true;
                        });
                    }
                });
                connected = true;
                resolve();
            } else {
                logger.error(`'${data.name}' missing connection data!`);
                _emitStatus('connect-failed');
                _clearVarsValue();
                connected = false;
                reject();
            }
        });
    }

    /**
     * Disconnect simulation, not really needed
     * Emit connection status to clients, clear all Tags values
     */
    this.disconnect = function () {
        return new Promise(function (resolve, reject) {
            _checkWorking(false);
            _emitStatus('connect-off');
            _clearVarsValue();
            connected = false;
            Object.values(digitals).forEach(io => {
                try {
                io.res.unexport();
                } catch { }
            });
            resolve(true);
        });
    }

    /**
     * Read values in polling mode 
     * Update the tags values list, save in DAQ if value changed or for daqInterval and emit values to clients
     */
    this.polling = function () {
        if (_checkWorking(true)) {
            _readDigitals();
            var varsValueChanged = _clearVarsChanged();
            lastTimestampValue = new Date().getTime();
            _emitValues(varsValue);

            if (this.addDaq) {
                var current = new Date().getTime();
                if (current - daqInterval > lastDaqInterval) {
                    this.addDaq(varsValue);
                    lastDaqInterval = current;
                } else if (Object.keys(varsValueChanged).length) {
                    this.addDaq(varsValueChanged);
                }
            }
            _checkWorking(false);
        } else {
            _emitStatus('connect-busy');
        }
    }

    /**
     * Load Tags attribute to read with polling
     */
    this.load = function (_data) {
        data = JSON.parse(JSON.stringify(_data));
        digitals = {};
        varsValue = [];
        var count = 0;
        for (var id in data.tags) {
            if (data.tags[id].type === 'GpioOut') {
                // digitals[id] = new GPIOItem(id, null, false, data.tags[id].type);
                digitals[id] = new GPIOItem(id, new Gpio(data.tags[id].address, 'out'), false, data.tags[id].type);
            } else if (data.tags[id].type === 'GpioIn') {
                // digitals[id] = new GPIOItem(id, null, true, data.tags[id].type);
                digitals[id] = new GPIOItem(id, new Gpio(data.tags[id].address, 'in', 'rising', {debounceTimeout: 10}), true, data.tags[id].type);
            }
        }
        logger.info(`'${data.name}' data loaded (${count})`, true);

    }

    /**
     * Return Tags values array { id: <name>, value: <value>, type: <type> }
     */
    this.getValues = function () {
        return varsValue;
    }

        /**
     * Return Tag value { id: <name>, value: <value>, ts: <lastTimestampValue> }
     */
    this.getValue = function (id) {
        if (varsValue[id]) {
            return { id: id, value: varsValue[id].value, ts: lastTimestampValue };
        }
        return null;
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
        if (digitals[id]) {
            return { id: id, name: id, type: digitals[id].type };
        } else { 
            return null;
        }
    }

    /**
     * Set the Tag value
     * Read the current Tag object, write the value in object and send to SPS 
     */
    this.setValue = function (sigid, value) {
        digitals[sigid].res.writeSync(value);
        digitals[sigid].value = value;
        digitals[sigid].changed = true;
    }

    /**
     * Return is connected
     */
    this.isConnected = function () {
        return connected;
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
     * Emit the Tags values array { id: <name>, value: <value>, type: <type> }
     * @param {*} values 
     */
    var _emitValues = function (values) {
        events.emit('device-value:changed', { id: data.name, values: values });
    }

    /**
     * Emit the connection status
     * @param {*} status 
     */
    var _emitStatus = function (status) {
        lastStatus = status;
        events.emit('device-status:changed', { id: data.name, status: status });
    }

    /**
     * Return the Tags that have value changed and clear value changed flag of all Tags 
     */
    var _clearVarsChanged = function () {
        var result = {};
        for (var id in digitals) {
            if (digitals[id].changed) {
                digitals[id].changed = false;
                result[id] = { id: digitals[id].id, type: digitals[id].type, value: digitals[id].value };
            }
            varsValue[id] = { id: digitals[id].id, type: digitals[id].type, value: digitals[id].value };
        }
        return result;
    }

    /**
     * Used to manage the async connection and polling automation (that not overloading)
     * @param {*} check 
     */
    var _checkWorking = function (check) {
        if (check && working) {
            overloading++;
            logger.error(`'${data.name}' working (connection || polling) overload! ${overloading}`);
            return false;
        }
        working = check;
        overloading = 0;
        return true;
    }

    var _readDigitals = function () {
        Object.values(digitals).forEach(io => {
            try {
                if (!io.in) {
                    var value = io.res.readSync();
                    if (io.value !== value) {
                        io.changed = true;
                    }
                    io.value = value;
                }
            } catch { }
        });
    }
}

module.exports = {
    init: function (settings) {
    },
    create: function (data, logger, events, manager) {
        try { Gpio = require('onoff').Gpio; } catch { }
        if (!Gpio && manager) { try { Gpio = manager.require('onoff').Gpio; } catch { } }
        else return null;
        return new RASPYclient(data, logger, events);
    }
}

function GPIOItem(id, res, ion, type) {
    this.id = id;
    this.res = res;
    this.changed = true;
    this.in = ion;
    this.type = type;
    this.value = null;
}