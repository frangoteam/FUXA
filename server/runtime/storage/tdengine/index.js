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
        // return {
        //     addDaqValues: this.addDaqValues(),
        //     alarmArchiveToTD: this.alarmArchiveToTD()
        // }
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
        } catch (error) {
            console.error(error);
        }
    }


    //add by J, to store archived alarm data from Sqlite to Dengine-------------------------------------------------------------------------------
    this.alarmArchiveToTD = async function () {

        let connOpt = Object.assign({}, options, settings.daqstore)
        connOpt.user = settings.daqstore.credentials.username;
        connOpt.passwd = settings.daqstore.credentials.password;

        conn = connect(connOpt);
        //create database
        const cursor = conn.cursor();
        try {
            //TODO add retention
            let res = await cursor.query(`CREATE DATABASE IF NOT EXISTS ${database} `);
            //add by J, create alarm stable
            res = await cursor.query(`CREATE TABLE IF NOT EXISTS ${database}.alarms (alm_ts TIMESTAMP, alm_ontime BIGINT, alm_offtime BIGINT, alm_acktime BIGINT, alm_name NCHAR(255), alm_type NCHAR(255), alm_status NCHAR(255), alm_text NCHAR(255), alm_userack NCHAR(255),alm_group NCHAR(255),alm_bkcolor NCHAR(255), alm_color NCHAR(255))`);
        } catch (error) {
            console.error(error);
        }
        async function insertAlarms(dataArray) {
            for (let i = 0; i < dataArray.length; i++) {
                const item = dataArray[i];

                // SQL query to check if the data already exists
                const checkQuery = `SELECT alm_ontime, alm_name FROM ${database}.alarms WHERE alm_ontime = ${item.ontime} AND alm_name = '${item.name}'`;
                // SQL query to insert the data into the database
                const queryAlm = `INSERT INTO ${database}.alarms (alm_ts, alm_ontime, alm_offtime, alm_acktime, alm_name, alm_type, alm_status, alm_text, alm_userack, alm_group, alm_bkcolor, alm_color)
                VALUES (
                    NOW(), ${item.ontime}, ${item.offtime}, ${item.acktime}, '${item.name}', '${item.type}', '${item.status}', '${item.text}', '${item.userack}', '${item.group}', '${item.bkcolor}', '${item.color}'
                )`;

                try {
                    const result = (await cursor.query(checkQuery)).getData();
                    // check 
                    // if the alarm is duplicated with TD, the result if it is an array and its length is greater than 0, 
                    // or if the alarm has been acked
                    // or if the alarm is gone off
                    if ((Array.isArray(result) && result.length > 0) || item.acktime === 0 || item.offtime === 0) {
                        // console.log(`Item with alm_ontime=${item.ontime} and alm_name=${item.name} already exists. Skipping insertion.`);
                        continue;  // skip insertion if the data already exists
                    }

                    //insert data into the database if it does not exist
                    await cursor.query(queryAlm);
                    //convert the ontime to a Date object and get a localized date and time string
                    const ontimeInMilliseconds = item.ontime; 
                    const ontimeInSeconds = ontimeInMilliseconds / 1000; // Convert milliseconds to seconds
                    const date = new Date(ontimeInSeconds * 1000); // Convert seconds to milliseconds and create a Date object
                    const formattedTime = date.toLocaleString(); // Get a localized date and time string
                    console.log(`Inserted new alarm item to TD ('${item.name}'-'on time ${formattedTime}') successfully.`);
                    logger.info(`Inserted new alarm item to TD ('${item.name}'-'on time ${formattedTime}') successfully.`);
                } catch (err) {
                    // console.error(`Error checking/inserting item ${item.ontime} - ${item.name}. Error:`, err);
                    logger.error(`Error checking/inserting item ${item.ontime} - ${item.name}. Error:`, err);
                }
            }
            // console.log('All items processed.');
        }

        // Define the dataArray variable to store data retrieved from the API
        let lastData = []; // saving data of last session

        function checkAndInsertData() {
            let uiPort = settings.uiPort || 1881;   // default ui port
            axios.get('http://localhost:' + uiPort + '/api/alarmshistory')
                .then(response => {
                    const currentData = response.data;
                    if (!lastData || JSON.stringify(currentData) !== JSON.stringify(lastData)) {
                        // insert data if data changed
                        insertAlarms(currentData);
                        lastData = currentData;
                    }
                })
                .catch(error => {
                    console.error('Error retrieving data:', error);
                });
        }

        checkAndInsertData();
    }
    //End of Code by J-------------------------------------------------------------------------------------------------------


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
                          WHERE tag_id = '${tagid}' 
                            and dt >= ${fromts}
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