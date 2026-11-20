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
var runtime;
var questDbModule = null;

function init(_settings, _log, _runtime) {
    settings = _settings;
    logger = _log;
    runtime = _runtime;
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
    if (dbType === DaqStoreTypeEnum.influxDB || dbType === DaqStoreTypeEnum.influxDB18 || dbType === DaqStoreTypeEnum.TDengine || dbType === DaqStoreTypeEnum.questDB) {
        id = dbType;
    }
    if (!daqDB[id]) {
        if (id === DaqStoreTypeEnum.influxDB || id === DaqStoreTypeEnum.influxDB18) {
            daqDB[id] = InfluxDB.create(settings, logger, currentStorateDB);
        } else if(id === DaqStoreTypeEnum.TDengine){
            daqDB[id] = TDengine.create(settings, logger, currentStorateDB);
        } else if(id === DaqStoreTypeEnum.questDB){
            const QuestDB = _getQuestDbModule();
            if (QuestDB) {
                daqDB[id] = QuestDB.create(settings, logger, currentStorateDB);
            } else {
                logger.warn('daqstorage: QuestDB storage selected but package dependencies are not installed. Falling back to SQLite.');
                daqDB[id] = SqliteDB.create(settings, logger, id, currentStorateDB);
            }
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
            }).catch(reject);
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

/** id of the FUXA application databases in the SQL nodes (Repeater DB data) */
const APP_DB_ID = '@app';

/**
 * Return the DAQ storages that can run SQL queries (SQLite one per device) and the FUXA App DB
 */
function getSqlNodes() {
    const devices = runtime?.project?.getDevices() || {};
    const nodes = Object.keys(daqDB).filter(id => typeof daqDB[id].query === 'function').map(id => ({
        id: id,
        name: devices[id]?.name || id,
        type: _getDbType()
    }));
    nodes.push({ id: APP_DB_ID, name: 'FUXA App DB', type: 'SQLite' });
    return nodes;
}

/**
 * Read-only query on the FUXA application databases:
 * alarms.fuxap.db (tables alarms, chronicle) as main, with the existing ones of
 * notifications.fuxap.db, recipes.db and scheduler.db attached as 'notifications', 'recipes', 'scheduler'.
 * plus the temporary table 'devices' with the devices of the running project (without credentials):
 * id, name, type, enabled, polling, address, port, slaveid, tags (count), status, tagList (JSON object of the tags by name).
 * users, apikeys and project are not exposed (passwords, credentials), other ATTACH are blocked
 */
function _queryAppDb(sql) {
    const sqlite3 = require('sqlite3').verbose();
    const alarmsFile = path.join(settings.workDir, 'alarms.fuxap.db');
    const attach = [['notifications', 'notifications.fuxap.db'], ['recipes', 'recipes.db'], ['scheduler', 'scheduler.db']]
        .map(([name, file]) => [name, path.join(settings.workDir, file)])
        .filter(([, file]) => fs.existsSync(file));
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(alarmsFile)) {
            return reject(new Error('FUXA App DB (alarms.fuxap.db) not found'));
        }
        const db = new sqlite3.Database(alarmsFile, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                return reject(err);
            }
            const run = () => db.all(sql, (err, rows) => {
                db.close();
                err ? reject(err) : resolve(_parseJsonValues(rows));
            });
            const fail = (err) => {
                db.close();
                reject(err);
            };
            const next = (i) => {
                if (i >= attach.length) {
                    // no further ATTACH from the query (e.g. users.fuxap.db)
                    db.configure('limit', sqlite3.LIMIT_ATTACHED, attach.length);
                    return _fillAppDevices(db).then(run).catch(fail);
                }
                db.run(`ATTACH DATABASE ? AS ${attach[i][0]}`, [attach[i][1]], (err) => {
                    if (err) {
                        return fail(err);
                    }
                    next(i + 1);
                });
            };
            next(0);
        });
    });
}

/**
 * Run a read-only SQL query on the DAQ storage with the given id
 */
function _fillAppDevices(db) {
    const devices = runtime?.project?.getDevices() || {};
    let status = {};
    try {
        status = runtime?.devices?.getDevicesStatus() || {};
    } catch (err) { }
    let values = {};
    try {
        values = runtime?.devices?.getDevicesValues() || {};
    } catch (err) { }
    const rows = Object.values(devices).map(dev => [
        dev.id, dev.name, dev.type, dev.enabled ? 1 : 0, dev.polling ?? null,
        dev.property?.address ?? null, dev.property?.port ?? null, dev.property?.slaveid ?? null,
        Object.keys(dev.tags || {}).length,
        (typeof status[dev.id] === 'string' ? status[dev.id] : status[dev.id]?.status) ?? null,
        JSON.stringify(_deviceTagList(dev, values[dev.id] || {}))
    ]);
    const exec = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, err => err ? reject(err) : resolve()));
    return exec('CREATE TEMP TABLE devices (id TEXT, name TEXT, type TEXT, enabled INTEGER, polling INTEGER, address TEXT, port TEXT, slaveid TEXT, tags INTEGER, status TEXT, tagList TEXT)')
        .then(() => rows.reduce((p, row) => p.then(() => exec('INSERT INTO temp.devices VALUES (?,?,?,?,?,?,?,?,?,?,?)', row)), Promise.resolve()));
}

/**
 * Tags of a device as object keyed by tag name: { <name>: { id, name, label, type, address, value, timestamp } }
 */
function _deviceTagList(dev, values) {
    const list = {};
    Object.values(dev.tags || {}).forEach(tag => {
        const current = values[tag.id];
        list[tag.name || tag.id] = {
            id: tag.id, name: tag.name, label: tag.label ?? null, type: tag.type ?? null,
            address: tag.address ?? null, value: current?.value ?? null, timestamp: current?.timestamp ?? null
        };
    });
    return list;
}

/**
 * JSON text values of the App DB rows (e.g. devices.tagList, json_object(...)) returned as objects
 */
function _parseJsonValues(rows) {
    (rows || []).forEach(row => Object.keys(row).forEach(key => {
        const value = row[key];
        if (typeof value === 'string' && /^\s*[\[{]/.test(value)) {
            try {
                row[key] = JSON.parse(value);
            } catch (err) { }
        }
    }));
    return rows;
}

function querySql(id, sql) {
    if (id === APP_DB_ID) {
        return _queryAppDb(sql);
    }
    const node = daqDB[id];
    if (!node || typeof node.query !== 'function') {
        return Promise.reject(new Error(`DAQ storage '${id}' not found or without SQL support`));
    }
    return node.query(sql);
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
        if (settings.daqstore.type === 'QuestDB') {
            return DaqStoreTypeEnum.questDB;
        }
        return settings.daqstore.type;
    }
    return DaqStoreTypeEnum.SQlite;
}

function _getQuestDbModule() {
    if (questDbModule) {
        return questDbModule;
    }
    try {
        questDbModule = require("./questdb");
    } catch (err) {
        questDbModule = null;
        logger.warn(`daqstorage: QuestDB module unavailable (${err.message})`);
    }
    return questDbModule;
}

var DaqStoreTypeEnum = {
    SQlite: 'SQlite',
    influxDB: 'influxDB',
    influxDB18: 'influxDB18',
    TDengine: 'TDengine',
    questDB: 'questDB'
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
    getSqlNodes: getSqlNodes,
    querySql: querySql,
};
