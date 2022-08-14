/**
 *  Module to manage the DAQ datastore with daqnode 
 */

'use strict';

const fs = require('fs');
const path = require('path');
var SqliteDB = require("./sqlite");
var InfluxDB = require("./influxdb");
// var DaqNode = require('./daqnode');
var calculator = require('./calculator');
var utils = require('../utils');

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

function getNodesValues(tagsid, fromts, tots, options) {
    return new Promise(async function (resolve, reject) {
        try {
            // resolve(['asdf', ...tagsid.map(col => col || '')]);
            var dbfncs = [];
            for (let i = 0; i < tagsid.length; i++) {
                dbfncs.push(await getNodeValues(tagsid[i], fromts, tots));
            }
            var result = {};
            Promise.all(dbfncs).then(values => {
                if (!values || values.length < 1) {    // (0)[]
                    resolve(['', ...tagsid.map(col => '')]);
                } else {
                    let calcValues = [];
                    for (let idx = 0 ; idx < values.length; idx++) {
                        if (options.functions[idx]) {
                            calcValues.push(calculator.getFunctionValues(values[idx], fromts, tots, options.functions[idx], options.interval));
                        } else {
                            calcValues.push(calculator.getFunctionValues(values[idx], fromts, tots));
                        }
                    }
                    let keys = Object.keys(calcValues[0]).map(ts => Number(ts));
                    let mergeValues = Object.keys(calcValues[0]).map(ts => [utils.getFormatDate(new Date(Number(ts))), _getValue(calcValues[0][ts])]);
                    for (let x = 1; x < calcValues.length; x++) {
                        let y = 0;
                        keys.forEach(k => {
                            mergeValues[y++].push(_getValue(calcValues[x][k]));
                        });
                    }
                    resolve(mergeValues);
                }
            }, reason => {
                reject(reason);
            });
        } catch (err) {
            reject(['ERR', ...tagsid.map(col => 'ERR')]);
        }
    });
}

function _getDaqNode(tagid) {
    var nodes = Object.values(daqDB);
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].getDaqMap(tagid)[tagid]) {
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
function _getValue(value) {
    if (value == Number.MAX_VALUE || value == Number.MIN_VALUE) {
        return '';
    }
    return value.toString();
}


module.exports = {
    init: init,
    reset: reset,
    addDaqNode: addDaqNode,
    getNodeValues: getNodeValues,
    getNodesValues: getNodesValues
};