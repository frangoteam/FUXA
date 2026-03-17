'use strict'

let { options, connect } = require("@tdengine/rest");
let utils = require('../../utils');

function quoteTdIdentifier(value) {
    return '`' + String(value).replace(/`/g, '``') + '`';
}

function escapeTdString(value) {
    return String(value).replace(/'/g, "''");
}

function TDengine(_settings, _log, _currentStorage) {
    let settings = _settings;               // Application settings
    const logger = _log;                      // Application logger
    const currentStorage = _currentStorage;  // Database to set the last value (current)
    const database = settings.daqstore.database || 'fuxa';
    const databaseRef = quoteTdIdentifier(database);
    let conn;

    this.setCall = function (_fncGetProp) {
        fncGetTagProp = _fncGetProp;
        return this.addDaqValues;
    }
    var fncGetTagProp = null;

    this.init = async function () {
        let connOpt = Object.assign({}, options, settings.daqstore)
        connOpt.user = settings.daqstore.credentials.username;
        connOpt.passwd = settings.daqstore.credentials.password;
        conn = connect(connOpt);
        //create database
        const cursor = conn.cursor();
        try {
            //TODO add retention
            let res = await cursor.query(`CREATE DATABASE IF NOT EXISTS ${databaseRef} `);
            res = await cursor.query(`CREATE STABLE IF NOT EXISTS ${databaseRef}.meters (dt TIMESTAMP,tag_id VARCHAR(200), tag_value BINARY(20)) TAGS (device_id VARCHAR(200),device_name BINARY(256) )`);

        } catch (error) {
            console.error(error);
        }

    }

    this.addDaqValues = function (tagsValues, deviceName, deviceId) {
        var dataToRestore = [];
        const cursor = conn.cursor();
        for (const tagid in tagsValues) {
            let tag = tagsValues[tagid];
            if (!tag.daq || utils.isNullOrUndefined(tag.value) || Number.isNaN(tag.value)) {
                if (tag.daq.restored) {
                    dataToRestore.push({ id: tag.id, deviceId: deviceId, value: tag.value });
                }
                if (!tag.daq.enabled) {
                    continue;
                }
            }
            const safeDeviceId = quoteTdIdentifier(deviceId);
            const safeDeviceTag = escapeTdString(deviceId);
            const safeDeviceName = escapeTdString(deviceName);
            const safeTagId = escapeTdString(tagid);
            const safeTagValue = escapeTdString(tag.value);
            let insertSql = `INSERT INTO ${databaseRef}.${safeDeviceId} USING ${databaseRef}.meters TAGS('${safeDeviceTag}','${safeDeviceName}')
                             VALUES (NOW, '${safeTagId}', '${safeTagValue}')`;
            //async

            cursor.query(insertSql).then((rst) => {
                //logger.info("addDaqValues",rst)
                if (0 !== rst.getErrCode()) {
                    logger.error(`daq addValue error[${rst.getErrCode()}]: ${rst.getErrStr()}`);
                }
            }).catch((err) => {
                logger.error(`daq addValue error ${err}`);
            })
        }

        if (dataToRestore.length && currentStorage) {
            currentStorage.setValues(dataToRestore);
        }
    }

    this.getDaqValue = function (tagid, fromts, tots) {
        return new Promise(function (resolve, reject) {
            const cursor = conn.cursor()
            let data = []
            //add by J, the tagid is missed in the sql, should be one of the filter condition
            const safeTagId = escapeTdString(tagid);
            cursor.query(`SELECT CAST(dt as BIGINT) as dt, tag_value
                          FROM ${databaseRef}.meters
                            WHERE tag_id = '${safeTagId}'
                            and dt >= ${Number(fromts)}
                            and dt < ${Number(tots)} `).then((result) => {
                // logger.debug(result)
                result.getData().forEach((row) => {
                    data.push({ dt: row[0], value: row[1] })
                })
                resolve(data)
            }).catch((error) => {
                logger.error(`TDengine-getDaqValue failed! ${error}`)
                reject(error)
            })
        })
    }

    this.close = function () {
        //do noting
    }

    this.getDaqMap = function (tagid) {
        var dummy = {};
        dummy[tagid] = true;
        return dummy;
    }

    this.init().then(() => logger.info("TDengine connected"))
}

module.exports = {
    create: function (data, logger, currentStorage) {
        return new TDengine(data, logger, currentStorage);
    }
};
