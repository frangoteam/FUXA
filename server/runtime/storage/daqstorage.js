/**
 *  Module to manage the DAQ datastore with daqnode 
 */

'use strict';

const fs = require('fs');
const path = require('path');
var SqliteDB = require("./sqlite");
var InfluxDB = require("./influxdb");

var daqStoreType;

var settings;
var logger;
var daqDB = {};                 // list of daqDB node: SQlite one pro device, influxDB only one
var timeSerieDB;

function init(_settings, _log) {
    settings = _settings;
    logger = _log;
    logger.info("daqstorage: init successful!", true);
}

function reset() {
    daqStoreType = _getDbType();
    for (var id in daqDB) {
        daqDB[id].close();
    }
    daqDB = {};
    logger.info("daqstorage reset!", true);
}

function addDaqNode(_id, fncgetprop) {
    var id = _id;
    if (_getDbType() === DaqStoreTypeEnum.influxDB) {
        id = _getDbType();
    }
    if (!daqDB[id]) {
        if (id === DaqStoreTypeEnum.influxDB) {
            daqDB[id] = InfluxDB.create(settings, logger);
        } else {
            daqDB[id] = SqliteDB.create(settings, logger, id);
        }
    }
    return daqDB[id].setCall(fncgetprop);
    // return daqnodes[id].addDaqValue;
}

function getNodeValues(tagid, fromts, tots) {
    return new Promise(function (resolve, reject) {
        var daqnode = _getDaqNode(tagid);
        if (daqnode) {
            resolve(daqnode.getDaqValue(tagid, fromts, tots));
        } else {
            reject();
        }
    });
}

function _getDaqNode(tagid) {
    var nodes = Object.values(daqDB);
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].getDaqMap()[tagid]) {
            return nodes[i];
        }
    }
}

function _getDbType() {
    if (settings.daqstore && settings.daqstore) {
        return settings.daqstore.type;
    }
    return DaqStoreTypeEnum.SQlite;
}

var DaqStoreTypeEnum = {
    SQlite: 'SQlite',
    influxDB: 'influxDB',
}

module.exports = {
    init: init,
    reset: reset,
    addDaqNode: addDaqNode,
    getNodeValues: getNodeValues
};