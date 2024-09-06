'use strict'
let { options, connect } = require("@tdengine/rest");
let utils = require('../../utils');
const axios = require('axios');

function TDengine(_settings, _log, _currentStorage) {
    let settings = _settings;               // Application settings
    const logger = _log;                      // Application logger
    const currentStorage = _currentStorage;  // Database to set the last value (current)
    const database = settings.daqstore.database || 'fuxa';
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
            let res = await cursor.query(`CREATE DATABASE IF NOT EXISTS ${database} `);
            res = await cursor.query(`CREATE STABLE IF NOT EXISTS ${database}.meters (dt TIMESTAMP,tag_id VARCHAR(200), tag_value BINARY(20)) TAGS (device_id VARCHAR(200),device_name BINARY(256) )`);
            //add by J, create alarm stable
            res = await cursor.query(`CREATE TABLE IF NOT EXISTS ${database}.alarms (alm_ts TIMESTAMP, alm_ontime BIGINT, alm_offtime BIGINT, alm_acktime BIGINT, alm_name NCHAR(255), alm_type NCHAR(255), alm_status NCHAR(255), alm_text NCHAR(255), alm_userack NCHAR(255),alm_group NCHAR(255),alm_bkcolor NCHAR(255), alm_color NCHAR(255))`);
        } catch (error) {
            console.error(error);
        }

        //add by J, to save alarm data from Sqlite to tdEngine-------------------------------------------------------------------------------

        // const dataArrayAlm = [
        //     {
        //         "ontime": 1725462862675,
        //         "offtime": 1725462865659,
        //         "acktime": 1725462871434,
        //         "name": "serverTag AlarmNum",
        //         "type": "highhigh",
        //         "status": "NF",
        //         "text": "this is HH-alarm of serverTag1 number",
        //         "userack": "",
        //         "group": "Server",
        //         "bkcolor": "#FF4848",
        //         "color": "#FFF"
        //     },
        //     {
        //         "ontime": 1725460256618,
        //         "offtime": 0,
        //         "acktime": 0,
        //         "name": "serverTag AlarmBit",
        //         "type": "high",
        //         "status": "N",
        //         "text": "this is H-alarm of serverTag1 bit",
        //         "userack": "",
        //         "group": "Server",
        //         "bkcolor": "#F9CF59",
        //         "color": "#000"
        //     },
        //     {
        //         "ontime": 1725459152258,
        //         "offtime": 1725460244613,
        //         "acktime": 1725460252091,
        //         "name": "serverTag AlarmBit",
        //         "type": "high",
        //         "status": "NF",
        //         "text": "this is H-alarm of serverTag1 bit",
        //         "userack": "",
        //         "group": "Server",
        //         "bkcolor": "#F9CF59",
        //         "color": "#000"
        //     },
        //     {
        //         "ontime": 1725458298760,
        //         "offtime": 1725458302762,
        //         "acktime": 1725458305126,
        //         "name": "serverTag AlarmBit",
        //         "type": "high",
        //         "status": "NF",
        //         "text": "this is H-alarm of serverTag1 bit",
        //         "userack": "",
        //         "group": "Server",
        //         "bkcolor": "#F9CF59",
        //         "color": "#000"
        //     },
        //     {
        //         "ontime": 1725458286754,
        //         "offtime": 1725458292756,
        //         "acktime": 1725458296969,
        //         "name": "serverTag AlarmBit",
        //         "type": "high",
        //         "status": "NF",
        //         "text": "this is H-alarm of serverTag1 bit",
        //         "userack": "",
        //         "group": "Server",
        //         "bkcolor": "#F9CF59",
        //         "color": "#000"
        //     },
        //     {
        //         "ontime": 1725458272747,
        //         "offtime": 1725458283752,
        //         "acktime": 1725458284890,
        //         "name": "serverTag AlarmNum",
        //         "type": "highhigh",
        //         "status": "NF",
        //         "text": "this is HH-alarm of serverTag1 number",
        //         "userack": "",
        //         "group": "Server",
        //         "bkcolor": "#FF4848",
        //         "color": "#FFF"
        //     },
        //     {
        //         "ontime": 1725458249739,
        //         "offtime": 1725458258739,
        //         "acktime": 1725458262808,
        //         "name": "serverTag AlarmNum",
        //         "type": "highhigh",
        //         "status": "NF",
        //         "text": "this is HH-alarm of serverTag1 number",
        //         "userack": "",
        //         "group": "Server",
        //         "bkcolor": "#FF4848",
        //         "color": "#FFF"
        //     }
        // ];


        // Function to insert data into the tdEngine database
        async function insertAlarms(dataArray) {
            for (let i = 0; i < dataArray.length; i++) {
                const item = dataArray[i];
                const queryAlm = `INSERT INTO ${database}.alarms (alm_ts, alm_ontime, alm_offtime, alm_acktime, alm_name, alm_type, alm_status, alm_text, alm_userack, alm_group, alm_bkcolor, alm_color)
                VALUES (
                    NOW(), ${item.ontime}, ${item.offtime}, ${item.acktime}, '${item.name}', '${item.type}', '${item.status}', '${item.text}', '${item.userack}', '${item.group}', '${item.bkcolor}', '${item.color}'
                )`;

                try {
                    await cursor.query(queryAlm);
                    console.log(`Inserted item ${i + 1} successfully.`);
                } catch (err) {
                    console.error(`Failed to insert item ${i + 1}. Error:`, err);
                }
            }
            console.log('All items processed.');
        }

        // Define the dataArray variable to store data retrieved from the API
        let dataArrayAlm = [];

        // axios to get hisotry alarm data from Alarm API
        axios.get('http://docker002:1881/api/alarmshistory')
            .then(response => {
                dataArrayAlm = response.data;
                // console.log('Data retrieved:', dataArrayAlm);
                insertAlarms(dataArrayAlm);
            })
            .catch(error => {
                console.error('Error retrieving data:', error);
            });

        //----------------------------------------------------------------------------------------------------

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
            let insertSql = `INSERT INTO ${database}.\`${deviceId}\` USING ${database}.meters TAGS('${deviceId}','${deviceName}')
                             VALUES (NOW, '${tagid}', '${tag.value}')`;
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
            cursor.query(`SELECT CAST(dt as BIGINT) as dt, tag_value
                          FROM ${database}.meters
                          WHERE dt >= ${fromts}
                            and dt < ${tots} `).then((result) => {
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