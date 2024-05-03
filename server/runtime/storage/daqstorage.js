/**
 *  Module to manage the DAQ datastore with daqnode 
 */

'use strict';

const fs = require('fs');
const path = require('path');
const SqliteDB = require("./sqlite");
const InfluxDB = require("./influxdb");
const TDengine  =require("./tdengine");
const CurrentStorage = require("./sqlite/currentstorage");
// var DaqNode = require('./daqnode');
var calculator = require('./calculator');
var utils = require('../utils');

var daqStoreType;

var settings;
var logger;
var daqDB = {};                 // list of daqDB node: SQlite one pro device, influxDB only one
var currentStorateDB;

function init(_settings, _log) {
    settings = _settings;
    logger = _log;
    logger.info("daqstorage: init successful!", true);
    currentStorateDB = CurrentStorage.create(_settings, _log);
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
    const dbType = _getDbType();
    if (dbType === DaqStoreTypeEnum.influxDB || dbType === DaqStoreTypeEnum.influxDB18 || dbType === DaqStoreTypeEnum.TDengine) {
        id = dbType;
    }
    if (!daqDB[id]) {
        if (id === DaqStoreTypeEnum.influxDB || id === DaqStoreTypeEnum.influxDB18) {
            daqDB[id] = InfluxDB.create(settings, logger, currentStorateDB);
        } else if(id === DaqStoreTypeEnum.TDengine){
            daqDB[id] = TDengine.create(settings, logger, currentStorateDB);
        } else {
            daqDB[id] = SqliteDB.create(settings, logger, id, currentStorateDB);
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
                SqliteDB.checkRetention(utils.getRetentionLimit(settings.daqstore.retention), settings.dbDir, 
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

function getCurrentStorageFnc() {
    return currentStorateDB.getValuesByDeviceId;
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
    if (settings.daqstore && settings.daqstore.type) {
        return settings.daqstore.type;
    }
    return DaqStoreTypeEnum.SQlite;
}

var DaqStoreTypeEnum = {
    SQlite: 'SQlite',
    influxDB: 'influxDB',
    influxDB18: 'influxDB18',
    TDengine: 'TDengine',
}

function _getValue(value) {
    if (value == Number.MAX_VALUE || value === utils.SMALLEST_NEGATIVE_INTEGER || value == null) {
        return '';
    }
    return value.toString();
}

module.exports = {
    init: init,
    reset: reset,
    addDaqNode: addDaqNode,
    getNodeValues: getNodeValues,
    getNodesValues: getNodesValues,
    checkRetention: checkRetention,
    getCurrentStorageFnc: getCurrentStorageFnc,
};