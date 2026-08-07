'use strict';

// FUXA device driver for Omron NJ/NX PLCs over EtherNet/IP (CIP).
//
// This file implements the FUXA device-driver contract by wrapping the
// 'omron-ethernet-ip' npm package. To install it, copy this folder to:
//   <FUXA>/server/runtime/devices/omron-ethernetip/index.js
// and apply the changes described in fuxa/INTEGRATION.md.

var OmronEip;
const utils = require('../../utils');
const deviceUtils = require('../device-utils');

const DEFAULT_PORT = 44818;

function OmronEthernetIPClient(_data, _logger, _events, _runtime) {
  var runtime = _runtime;
  var data = JSON.parse(JSON.stringify(_data)); // { id, name, tags, property, ... }
  var logger = _logger;
  var events = _events;
  var client = null; // omron-ethernet-ip OmronEipClient
  var connected = false;
  var lastStatus = '';
  var working = false;
  var overloading = 0;
  var varsValue = {}; // tag id -> { id, value, type, daq, changed, timestamp }
  var lastTimestampValue;
  var connectionVersion = 0;

  this.init = function (_type) {
    console.error('Not supported!');
  };

  // Connect to the PLC and register an EtherNet/IP session.
  this.connect = function () {
    return new Promise(function (resolve, reject) {
      if (!data.property || !data.property.address) {
        var missingAddressError = new Error('missing connection address');
        logger.error(`'${data.name}' ${missingAddressError.message}!`);
        _emitStatus('connect-failed');
        _clearVarsValue();
        return reject(missingAddressError);
      }
      try {
        var target = _parseAddress(data.property.address);
        logger.info(`'${data.name}' try to connect ${data.property.address}`, true);
        client = new OmronEip.OmronEipClient({ host: target.host, port: target.port });
        client.connect().then(
          function () {
            connected = true;
            connectionVersion++;
            logger.info(`'${data.name}' connected!`, true);
            _emitStatus('connect-ok');
            resolve();
          },
          function (err) {
            connected = false;
            logger.error(`'${data.name}' connect failed! ${err && err.message}`);
            _emitStatus('connect-error');
            _clearVarsValue();
            reject(err);
          }
        );
      } catch (err) {
        connected = false;
        logger.error(`'${data.name}' try to connect error! ${err}`);
        _emitStatus('connect-error');
        _clearVarsValue();
        reject(err);
      }
    });
  };

  // Disconnect from the PLC.
  this.disconnect = function () {
    return new Promise(function (resolve) {
      try {
        if (client) client.close();
      } catch (err) {
        logger.error(`'${data.name}' disconnect failure! ${err}`);
      }
      client = null;
      connected = false;
      working = false;
      connectionVersion++;
      _emitStatus('connect-off');
      _clearVarsValue();
      resolve(true);
    });
  };

  // Poll every configured tag and emit the values to the FUXA runtime.
  this.polling = async function () {
    if (!_checkWorking(true)) {
      return;
    }
    if (!client || !connected) {
      _checkWorking(false);
      return;
    }
    try {
      var timestamp = Date.now();
      var changed = {};
      var hasSuccessfulRead = false;
      var pollingConnectionVersion = connectionVersion;
      for (var id in data.tags) {
        var tag = data.tags[id];
        try {
          if (!client || !connected || pollingConnectionVersion !== connectionVersion) {
            return;
          }
          var result = await client.readTag(tag.address);
          if (!connected || pollingConnectionVersion !== connectionVersion) {
            return;
          }
          var value = await deviceUtils.tagValueCompose(
            result.value,
            varsValue[id] ? varsValue[id].value : null,
            tag,
            runtime
          );
          var valueChanged = !varsValue[id] || varsValue[id].value !== value;
          varsValue[id] = {
            id: id,
            value: value,
            type: result.typeName || tag.type,
            daq: tag.daq,
            changed: valueChanged,
            timestamp: timestamp,
          };
          hasSuccessfulRead = true;
          if (this.addDaq && deviceUtils.tagDaqToSave(varsValue[id], timestamp)) {
            changed[id] = varsValue[id];
          }
          varsValue[id].changed = false;
        } catch (err) {
          logger.error(`'${data.name}' read '${tag.address}' error! ${err && err.message}`);
        }
      }
      if (!connected || pollingConnectionVersion !== connectionVersion) {
        return;
      }
      if (!hasSuccessfulRead) {
        return;
      }
      lastTimestampValue = timestamp;
      _emitValues(varsValue);
      if (this.addDaq && !utils.isEmptyObject(changed)) {
        this.addDaq(changed, data.name, data.id);
      }
    } catch (err) {
      logger.error(`'${data.name}' polling error: ${err}`);
    } finally {
      _checkWorking(false);
    }
  };

  // Load/refresh the tag configuration.
  this.load = function (_data) {
    varsValue = {};
    data = JSON.parse(JSON.stringify(_data));
    var count = data.tags ? Object.keys(data.tags).length : 0;
    logger.info(`'${data.name}' data loaded (${count})`, true);
  };

  this.getValues = function () {
    return varsValue;
  };

  this.getValue = function (id) {
    if (varsValue[id]) {
      return { id: id, value: varsValue[id].value, ts: lastTimestampValue };
    }
    return null;
  };

  this.getStatus = function () {
    return lastStatus;
  };

  this.getTagProperty = function (id) {
    if (data.tags[id]) {
      return {
        id: id,
        name: data.tags[id].name,
        type: data.tags[id].type,
        format: data.tags[id].format,
      };
    }
    return null;
  };

  // Write a value to a tag. The CIP data type is discovered automatically.
  this.setValue = async function (id, value) {
    if (!data.tags[id] || !client || !connected) {
      return false;
    }
    try {
      var valueToSend = await deviceUtils.tagRawCalculator(value, data.tags[id], runtime);
      await client.writeTag(data.tags[id].address, valueToSend);
      logger.info(`'${data.tags[id].name}' setValue(${valueToSend})`, true, true);
      return true;
    } catch (err) {
      logger.error(`'${data.tags[id].name}' setValue error! ${err && err.message}`);
      return false;
    }
  };

  this.isConnected = function () {
    return connected;
  };

  this.bindAddDaq = function (fnc) {
    this.addDaq = fnc;
  };
  this.addDaq = null;

  this.lastReadTimestamp = () => lastTimestampValue;

  this.getTagDaqSettings = (id) => (data.tags[id] ? data.tags[id].daq : null);

  this.setTagDaqSettings = (id, settings) => {
    if (data.tags[id]) {
      utils.mergeObjectsValues(data.tags[id].daq, settings);
    }
  };

  var _clearVarsValue = function () {
    for (var id in varsValue) {
      varsValue[id].value = null;
    }
    if (Object.keys(varsValue).length) {
      _emitValues(varsValue);
    }
  };

  var _emitStatus = function (status) {
    lastStatus = status;
    events.emit('device-status:changed', { id: data.id, status: status });
  };

  var _emitValues = function (values) {
    events.emit('device-value:changed', { id: data.id, values: values });
  };

  var _handleConnectionLost = function () {
    connected = false;
    connectionVersion++;
    try {
      if (client) client.close();
    } catch (err) {
      logger.error(`'${data.name}' close after polling failure error! ${err}`);
    }
    client = null;
    _emitStatus('connect-error');
    _clearVarsValue();
  };

  // Guard against overlapping connect/polling cycles.
  var _checkWorking = function (check) {
    if (check && working) {
      overloading++;
      logger.warn(`'${data.name}' working overload! ${overloading}`);
      if (overloading >= 3) {
        logger.error(`'${data.name}' polling blocked, reconnecting`);
        working = false;
        overloading = 0;
        _handleConnectionLost();
      }
      return false;
    }
    working = check;
    overloading = 0;
    return true;
  };

  // Parse "host" or "host:port" into { host, port }.
  function _parseAddress(address) {
    var idx = address.indexOf(':');
    if (idx === -1) {
      return { host: address, port: DEFAULT_PORT };
    }
    return {
      host: address.substring(0, idx),
      port: parseInt(address.substring(idx + 1), 10) || DEFAULT_PORT,
    };
  }
}

module.exports = {
  init: function (settings) {},
  create: function (data, logger, events, manager, runtime) {
    try {
      OmronEip = require('omron-ethernet-ip');
    } catch (e) {
      // not installed in node_modules
    }
    if (!OmronEip && manager) {
      try {
        OmronEip = manager.require('omron-ethernet-ip');
      } catch (e) {
        // not available via the plugin manager
      }
    }
    if (!OmronEip) {
      return null;
    }
    return new OmronEthernetIPClient(data, logger, events, runtime);
  },
};
