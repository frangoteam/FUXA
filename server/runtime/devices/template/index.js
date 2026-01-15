/**
 * template to define owner device driver communication  
 */

'use strict';

function DeviceTemplate(_data, _logger, _events) {

    var data = JSON.parse(JSON.stringify(_data)); // Current Device data { id, name, tags, enabled, ... }
    var logger = _logger;
    var events = _events; // Events to commit change to runtime

    /**
     * initialize the device type 
     */
    this.init = function (_type) {
        console.error('Not supported! (template.init)');
    }

    /**
     * Connect to device
     * Emit connection status to clients, clear all Tags values
     */
    this.connect = function () {
        console.error('Not supported! (template.connect)');
        // events.emit('device-status:changed', { id: data.id, status: 'connect-ok' });
        // events.emit('device-status:changed', { id: data.id, status: 'connect-error' });
    }


    /**
     * Disconnect the device
     * Emit connection status to clients, clear all Tags values
     */
    this.disconnect = function () {
        console.error('Not supported! (template.disconnect)');
        // events.emit('device-status:changed', { id: data.id, status: 'connect-off' });
    }

    /**
     * Read values in polling mode 
     * Update the tags values list, save in DAQ if value changed or in interval and emit values to clients
     */
    this.polling = async function () {
        console.error('Not supported! (template.polling)');
        // events.emit('device-value:changed', { id: data.name, values: values });
    }

    /**
     * Load Tags attribute to read with polling
     */
    this.load = function (_data) {
        console.error(`Not supported! (template.load) (Data: ${_data})`);
    }

    /**
     * Return Tags values array { id: <name>, value: <value> }
     */
    this.getValues = function () {
        console.error('Not supported! (template.getValues)');
    }

    /**
     * Return Tag value { id: <name>, value: <value>, ts: <lastTimestampValue> }
     */
    this.getValue = function (tagid) {
        console.error(`Not supported! (template.getValue) (TagID: ${tagid})`);
    }

    /**
     * Return connection status 'connect-off', 'connect-ok', 'connect-error', 'connect-busy'
     */
    this.getStatus = function () {
        console.error('Not supported! (template.getStatus)');
    }

    /**
     * Return Tag property to show in frontend
     */
    this.getTagProperty = function (tagid) {
        console.error(`Not supported! (template.getTagProperty) (TagID: ${tagid})`);
    }

    /**
     * Set the Tag value to device
     */
    this.setValue = function (tagid, value) {
        console.error(`Not supported! (template.setValue) (TagID: ${tagid}, Value: ${value})`);
    }

    /**
     * Return if device is connected
     */
    this.isConnected = function () {
        console.error('Not supported! (template.isConnected)');
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
        console.error('Not supported! (template.lastReadTimestamp)');
    }

    /**
     * Return the Daq settings of Tag
     * @returns 
     */
    this.getTagDaqSettings = (tagId) => {
        console.error(`Not supported! (template.getTagDaqSettings) (TagID: ${tagId})`);
    }

    /**
     * Set Daq settings of Tag
     * @returns 
     */
    this.setTagDaqSettings = (tagId, settings) => {
        console.error(`Not supported! (template.setTagDaqSettings) (TagID: ${tagId}, Settings: ${settings})`);
    }
}

module.exports = {
    init: function (settings) {
    },
    create: function (data, logger, events, manager) {
        // To use with plugin
        // try { TemplateDriver = require('template-driver'); } catch { }
        // if (!TemplateDriver && manager) { try { TemplateDriver = manager.require('template-driver'); } catch { } }
        // if (!TemplateDriver) return null;

        return new DeviceTemplate(data, logger, events);
    }
}
