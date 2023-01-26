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
            resolve([]);
        }
    });
}

/**
 * Return tags values, 
 * if with options then return function array [{DD/MM/YYYY mm:HH, ...values}]
 * else for chart object {tagId} [{Date, value}]
 * @param {*} tagsid 
 * @param {*} fromts 
 * @param {*} tots 
 * @param {*} options 
 * @returns 
 */
function getNodesValues(tagsid, fromts, tots, options) {
    return new Promise(async function (resolve, reject) {
        try {
            var dbfncs = [];
            for (let i = 0; i < tagsid.length; i++) {
                dbfncs.push(await getNodeValues(tagsid[i], fromts, tots));
            }
            Promise.all(dbfncs).then(values => {
                if (!values || values.length < 1) {    // (0)[]
                    resolve(['', ...tagsid.map(col => '')]);
                } else if (options) {
                    let calcValues = [];
                    for (let idx = 0 ; idx < values.length; idx++) {
                        if (options.functions[idx]) {
                            calcValues.push(calculator.getFunctionValues(values[idx], fromts, tots, options.functions[idx], options.interval, options.formats[idx]));
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
                } else {
                    var result = {};
                    for (let i = 0; i < tagsid.length; i++) {
                        result[tagsid[i]] = values[i].map(v => { return { x: new Date(v.dt), y: v.value} });
                        result[tagsid[i]].push({ x: new Date(tots), y: null});
                        result[tagsid[i]].unshift({ x: new Date(fromts), y: null});
                    }
                    resolve(result);
                }
            }, reason => {
                reject(reason);
            });
        } catch (err) {
            reject(['ERR', ...tagsid.map(col => 'ERR')]);
        }
    });
}

function checkRetention() {
    return new Promise(async function (resolve, reject) {
        if (settings.daqstore && _getDbType() === DaqStoreTypeEnum.SQlite && settings.daqstore.retention !== 'none') {
            try {
                SqliteDB.checkRetention(_getRetentionLimit(settings.daqstore.retention), settings.dbDir, 
                (fileDeleted) => {
                    logger.info(`daqstorage.checkRetention file ${fileDeleted} removed`);
                },
                (err) => {
                    logger.error(`daqstorage.checkRetention remove file failed! ${err}`);
                });
            } catch (err) {
                logger.error(err);
            }
        }
        logger.info(`daqstorage.checkRetention processed`);
        resolve();
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
    if (value == Number.MAX_VALUE || value == Number.MIN_VALUE || value == null) {
        return '';
    }
    return value.toString();
}

var _getRetentionLimit = function(retention) {
    var dayToAdd = 0;
    if (retention === 'day1') {
        dayToAdd = 1;
    } else if (retention === 'days2') {
        dayToAdd = 2;
    } else if (retention === 'days3') {
        dayToAdd = 3;
    } else if (retention === 'days7') {
        dayToAdd = 7;
    } else if (retention === 'days14') {
        dayToAdd = 14;
    } else if (retention === 'days30') {
        dayToAdd = 30;
    } else if (retention === 'days90') {
        dayToAdd = 90;
    } else if (retention === 'year1') {
        dayToAdd = 365;
    }
    const date = new Date();
    date.setDate(date.getDate() - dayToAdd);
    return date;
}

module.exports = {
    init: init,
    reset: reset,
    addDaqNode: addDaqNode,
    getNodeValues: getNodeValues,
    getNodesValues: getNodesValues,
    checkRetention: checkRetention,
};