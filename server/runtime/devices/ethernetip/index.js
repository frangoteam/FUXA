/**
 * 'ethernetip': use nodePCCC a library that allows communication to certain Allen-Bradley PLCs - 
 * The SLC 500 series, Micrologix and ControlLogix/CompactLogix PLCs using PCCC embedded in Ethernet/IP
 */

'use strict';
var EthernetIp;

function EthernetIPclient(_data, _logger, _events) {

    var data = JSON.parse(JSON.stringify(_data)); // Current Device data { id, name, tags, enabled, ... }
    var logger = _logger;
    var events = _events;               // Events to commit change to runtime
    var lastStatus = '';                // Last Device status     
    var working = false;                // Working flag to manage overloading polling and connection
    var conn = new EthernetIp;
    var daqInterval = 0;                // To manage minimum interval to save a DAQ value
    var doneReading = false;
    var doneWriting = false;
    var overloading = 0;                // Overloading counter to mange the break connection
    var connected = false;              // Connected flag

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
        return new Promise(function (resolve, reject) {
            if (data.property && data.property.address) {
                try {
                    if (_checkWorking(true)) {
                        logger.info(`'${data.name}' try to connect ${data.property.address}`, true);
                        _connect(function (err) {
                            if (err) {
                                logger.error(`'${data.name}' connect failed! ${err}`);
                                _emitStatus('connect-error');
                                // _clearVarsValue();
                                reject();
                            } else {
                                connected = true;
                                // set a timout for requests default is null (no timeout)
                                // client.setTimeout(2000);
                                logger.info(`'${data.name}' connected!`, true);
                                _emitStatus('connect-ok');
                                resolve();
                            }
                            _checkWorking(false);
                        });
                    } else {
                        reject();
                        _emitStatus('connect-error');
                    }
                } catch (err) {
                    logger.error(`'${data.name}' try to connect error! ${err}`);
                    _checkWorking(false);
                    _emitStatus('connect-error');
                    // _clearVarsValue();
                    reject();
                }
            } else {
                logger.error(`'${data.name}' missing connection data!`);
                _emitStatus('connect-failed');
                // _clearVarsValue();
                reject();
            }
        });
    }


    /**
     * Disconnect the device
     * Emit connection status to clients, clear all Tags values
     */
    this.disconnect = function () {
        return new Promise(function (resolve, reject) {
            try {
                if (conn && connected) {
                    conn.dropConnection(function (result) {
                        if (result) {
                            logger.error(`'${data.name}' try to disconnect failed!`);
                        } else {
                            logger.info(`'${data.name}' disconnected!`, true);
                        }
                        resolve(result);
                    });
                }
                resolve(true);
            } catch (err) {
                if (err) {
                    logger.error(`'${data.name}' disconnect failure! ${err}`);
                }
                reject();
            }
            connected = false;
            _checkWorking(false);
            _emitStatus('connect-off');
            // _clearVarsValue();
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
        console.error('Not supported!');
    }

    /**
     * Return Tags values array { id: <name>, value: <value> }
     */
    this.getValues = function () {
        console.error('Not supported!');
    }

    /**
     * Return Tag value { id: <name>, value: <value>, ts: <lastTimestampValue> }
     */
    this.getValue = function (tagid) {
        console.error('Not supported!');
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
        console.error('Not supported!');
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
     * Connect with RTU or TCP
     */
    var _connect = function (callback) {
        try {
            var port = 44818;
            var addr = data.property.address;
            if (data.property.address.indexOf(':') !== -1) {
                var addr = data.property.address.substring(0, data.property.address.indexOf(':'));
                var temp = data.property.address.substring(data.property.address.indexOf(':') + 1);
                port = parseInt(temp);
            }
            conn.initiateConnection({port: port, host: addr /* , routing: [0x01,0x00,0x01,0x00] */}, callback);
        } catch (err) {
            callback(err);
        }
    }

    /**
     * Emit the PLC connection status
     * @param {*} status 
     */
    var _emitStatus = function (status) {
        lastStatus = status;
        events.emit('device-status:changed', { id: data.id, status: status });
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
                conn.dropConnection();
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
    create: function (data, logger, events, manager) {
        // To use with plugin
        try { EthernetIp = require('nodepccc'); } catch { }
        if (!EthernetIp && manager) { try { EthernetIp = manager.require('nodepccc'); } catch { } }
        if (!EthernetIp) return null;
        return new EthernetIPclient(data, logger, events);
    }
}
