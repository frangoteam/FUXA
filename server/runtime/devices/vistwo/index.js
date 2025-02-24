/**
 * vistwo device driver
 */

'use strict';
const utils = require('../../utils');
const deviceUtils = require('../device-utils');
const net = require("net");
const ws = require('../../../node_modules/ws');
const { REPL_MODE_SLOPPY } = require('repl');
const { secureHeapUsed } = require('crypto');
const Mutex = require("async-mutex").Mutex;
var vistwo;

function DeviceVistwo(_data, _logger, _events) {

    var data = JSON.parse(JSON.stringify(_data)); // Current Device data { id, name, tags, enabled, ... }
    var logger = _logger;
    var events = _events;               // Events to commit change to runtime
    var varsValue = {};                 // Tags to send to frontend { id, type, value }
    var lastTimestampValue;             // Last Timestamp of values
    var tagsMap = [];                   // Array of tag ids
    var working = false;                // Working flag to manage overloading polling and connection
    var lastStatus = '';                // Last Device status
    var overloading = 0;                // Overloading counter to mange the break connection
    var client = 0;

    /**
     * initialize the device type 
     */
    this.init = function (_type) {
        lastTimestampValue = new Date().getTime();
    }

    /**
     * Connect to device
     * Emit connection status to clients, clear all Tags values
     */
    this.connect = function () {
//      console.log('vistwo: connect called');
//      console.log('vistwo: url '+data.property.address);
//      console.log('vistwo: ev-driven '+data.property.nopolling);
        return new Promise(function (resolve, reject) {
            if ( !data.property.address || data.property.address == '' )
                data.property.address='127.0.0.1';
            client = new ws.WebSocket(`ws://${data.property.address}:9926`);
            client.on('error', function() {
//              console.log('ERROR');
            });
            client.on('open', function() {
//              console.log('open');
                for (var id in data.tags) {
                    if ( client )
                        client.send(`{"cmd":"RAPV","name":"${data.tags[id].address}","handle":${data.tags[id].label}}`);
//                  console.log('acquire ['+data.tags[id].label+'] '+data.tags[id].address);
                }
                logger.info(`'${data.name}' connected!`, true);
                _emitStatus('connect-ok');
                resolve();
            });
            client.on('message', function( _msg ) {
                const msg = JSON.parse(_msg);
//              console.log('message '+_msg);
                varsValue[tagsMap[msg.handle]].value = ( msg.event == 'NAC' )?'':msg.value;
                if ( data.property.nopolling ) {
// direct push - event driven
                    var varsValueChanged = _checkVarsChanged();
                    lastTimestampValue = new Date().getTime();
                    _emitValues(varsValue);
                    if (this.addDaq && !utils.isEmptyObject(varsValueChanged)) {
                        this.addDaq(varsValueChanged, data.name, data.id);
                    }
                }
            })
            client.on('ping', function() {
//              console.log('ping');
            });
            client.on('close', function() {
//              console.log('close');
                logger.info(`'${data.name}' closed!`, true);
                _emitStatus('connect-error');
                reject();
                client = 0;
            });
        });
    }

    var _clearVarsValue = function () {
        for (let id in varsValue) {
//            if ( client )
//                client.send(`{"cmd":"RRPV","handle":${data.tags[id].label}}`);
            varsValue[id].value = null;
        }
        _emitValues(varsValue);
    }

    /**
     * Disconnect the device
     * Emit connection status to clients, clear all Tags values
     */
    this.disconnect = function () {
        return new Promise(function (resolve, reject) {
//          console.error('vistwo: disconnect called');
            _checkWorking(false);
            if (client) {
                client.close();
            }
            client = 0;
            _emitStatus('connect-off');
            _clearVarsValue();
            resolve(true);
        });
    }

    var _emitStatus = function (status) {
        lastStatus = status;
        events.emit('device-status:changed', { id: data.id, status: status });
    }

    /**
     * Read values in polling mode 
     * Update the tags values list, save in DAQ if value changed or in interval and emit values to clients
     */
    this.polling = async function () {
        if ( data.property.nopolling )
            return;
        if (_checkWorking(true)) {
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
        }
        else
            _emitStatus('connect-busy');
    }

    var _emitValues = function (values) {
        events.emit('device-value:changed', { id: data.name, values: values });
    }

    /**
     * Load Tags attribute to read with polling
     */
    this.load = function (_data) {
        varsValue = [];
        data = JSON.parse(JSON.stringify(_data));
        tagsMap = [];
        var count = Object.keys(data.tags).length;
        var nr = 0;
        for (var id in data.tags) {
//          console.log('load '+data.tags[id].address);
            tagsMap[nr] = id;
            const dataTag = data.tags[id];
            if (dataTag.init)
                data.tags[id].value = _parseValue(dataTag.init, dataTag.type);
            data.tags[id].label = String(nr++);
            varsValue[id] = data.tags[id];
        }
        logger.info(`'${data.name}' data loaded (${count})`, true);
    }

    /**
     * Return the Tags that have value changed and clear value changed flag of all Tags
     */
    var _checkVarsChanged = async () => {
        const timestamp = new Date().getTime();
        var result = {};
        for (var id in data.tags) {
//          console.log('vistwo: _checkVarsChanged : '+data.tags[id].name);
            if (!utils.isNullOrUndefined(data.tags[id].value)) {
                data.tags[id].value = await deviceUtils.tagValueCompose(data.tags[id].value, varsValue[id] ? varsValue[id].value : null, data.tags[id]);
                data.tags[id].timestamp = timestamp;
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
            return {id: id, value: varsValue[id].value, ts: lastTimestampValue };
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
     * Return Tag property to show in frontend
     */
    this.getTagProperty = function (tagid) {
//      console.error('vistwo: getTagProperty not supported');
    }

    /**
     * Set the Tag value to device
     */
    this.setValue = function (tagid, value) {
//      console.error('vistwo: setValue currently not supported');
        if ( client )
            client.send(`{"cmd":"RSPV","handle":${data.tags[tagid].label},"value":"${value}"}`);
    }

    /**
     * Return if device is connected
     */
    this.isConnected = function () {
        return client ? 1 : 0;
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

    var _checkWorking = function (check) {
        if (check && working) {
            overloading++;
            // !The driver don't give the break connection
            if (overloading >= 3) {
                    logger.warn(`'${data.name}' working (connection || polling) overload! ${overloading}`);
                //client.close();
            } else {
                return false;
            }
        }
        working = check;
        overloading = 0;
        return true;
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
}

module.exports = {
    init: function (settings) {
    },
    create: function (data, logger, events, manager) {
//        console.error('vistwo-create called');
//        try { vistwo = require('node-vistwo'); } catch { }
//        if (!vistwo && manager) { try { vistwo = manager.require('node-vistwo'); } catch { } }
//        if (!vistwo) return null;

        return new DeviceVistwo(data, logger, events);
    }
}
