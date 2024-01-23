/**
 * Module to manage the DAQ with influxdb
 */

"use strict";

var utils = require('../../utils');
const influx = require('influx');
const { URL } = require('url');
var { InfluxDB, Point, flux } = require('@influxdata/influxdb-client');

const VERSION_18_FLUX = '1.8-flux';
const VERSION_20 = '2.0';

function Influx(_settings, _log, _currentStorate) {

    var settings = _settings;               // Application settings
    var logger = _log;                      // Application logger
    var currentStorage = _currentStorate    // Database to set the last value (current)
    var status = InfluxDBStatusEnum.CLOSE;


    var influxError = { error: null, timestamp: 0 };
    var influxdbVersion = VERSION_20;
    var client = null;
    var clientOptions = null
    var writeApi = null
    var queryApi = null

    this.init = function () {

        if (settings.daqstore.type === 'influxDB18') {
            influxdbVersion = VERSION_18_FLUX;
        }
        if (settings.daqstore.credentials && influxdbVersion === VERSION_20) {
            const token = settings.daqstore.credentials.token;
            clientOptions = {
                url: settings.daqstore.url,
                // rejectUnauthorized: n.rejectUnauthorized,
                token
            }
            try {
                client = new InfluxDB(clientOptions);
                writeApi = client.getWriteApi(settings.daqstore.organization, settings.daqstore.bucket, 's');
                queryApi = client.getQueryApi(settings.daqstore.organization);
                status = InfluxDBStatusEnum.OPEN;    
            } catch (error) {
                logger.error('influxdb-init failed! ' + error.message); 
            }
        } else if (influxdbVersion === VERSION_18_FLUX) {
            try {
                const parsedUrl = new URL(settings.daqstore.url);
                const [host] = parsedUrl.host.split(':');
                const [protocol] = parsedUrl.protocol.split(':');
                clientOptions = {
                    host: host,
                    port: parsedUrl.port || 8086,
                    protocol: protocol || 'http',
                    database: settings.daqstore.database,
                    username: settings.daqstore.credentials.username,
                    password: settings.daqstore.credentials.password,
                }
            } catch (error) {
                logger.error(`influxdb-init failed! ${error}`);
                reject(error);
            }
            client = new influx.InfluxDB(clientOptions);
            status = InfluxDBStatusEnum.OPEN;
        }
    }

    this.close = function () {
        try {
            status = InfluxDBStatusEnum.CLOSE;
            client.close().then(() => {
                logger.info('influxdb-close FINISHED');
            })
            .catch((e) => {
                logger.error(`influxdb-close failed! ${e}`);
            });
        } catch (error) {
            logger.error(`influxdb-close failed! ${error}`);
        }
    }

    this.setCall = function (_fncGetProp) {
        fncGetTagProp = _fncGetProp;
        return this.addDaqValues;
    }
    var fncGetTagProp = null;

    this.addDaqValue = function (tagId, tagValue) {
        logger.error('influxdb-addDaqValue Not supported!');
    }

    this.addDaqValues = function (tagsValues, deviceName, deviceId) {
        var dataToWrite = [];
        var dataToRestore = [];
        for (var tagid in tagsValues) {
            let tag = tagsValues[tagid];
            if (!tag.daq || utils.isNullOrUndefined(tag.value) || Number.isNaN(tag.value)) {
                if (tag.daq.restored) {
                    dataToRestore.push({id: tag.id, deviceId: deviceId, value: tag.value});
                }
                if (!tag.daq.enabled) {
                    continue;
                }
            }
            if (influxdbVersion === VERSION_18_FLUX) {
                const tags = {
                    id: tag.id,
                    devicename: deviceName
                }
                const fields = {
                    value: utils.isBoolean(tag.value) ? tag.value * 1 : tag.value
                }
                dataToWrite.push({
                    measurement: tag.id,
                    tags,
                    fields,
                    timestamp: new Date(tag.timestamp || new Date().getTime())
                });
            } else {
                const point = new Point(tag.id)
                    .tag('id', tag.id)
                    .tag('name', tag.name || tag.tagref.name)
                    .tag('type', tag.type)
                    .timestamp(new Date(tag.timestamp || new Date().getTime()));
                if (deviceName) {
                    point.tag('device', deviceName);
                }
                if (utils.isBoolean(tag.value)) {
                    point.booleanField('value', tag.value);
                } else {
                    point.floatField('value', tag.value)
                }
                dataToWrite.push(point);
            }
        }
        if (dataToWrite.length) {
            writePoints(dataToWrite);
        }
        if (dataToRestore.length && currentStorage) {
            currentStorage.setValues(dataToRestore);
        }
    }

    this.getDaqMap = function (tagid) {
        var dummy = {};
        dummy[tagid] = true;
        return dummy;
    }

    this.getDaqValue = function (tagid, fromts, tots) {
        return new Promise(function (resolve, reject) {
            try {
                if (influxdbVersion === VERSION_18_FLUX) {
                    fromts *= 1000000;
                    tots *= 1000000;
                    const query = `SELECT * FROM "${tagid}" WHERE time >= ${fromts} AND time <= ${tots}`;
                    client.query(query).then((result) => {
                        resolve(result.map(row => { 
                            return {
                                dt: new Date(row.time).getTime(),
                                value: row.value
                            }
                        }));
                    })
                    .catch((error) => {
                        logger.error(`influxdb-getDaqValue failed! ${error}`);
                        reject(error);
                    });
                } else {
                    const query = flux`from(bucket: "${settings.daqstore.bucket}") |> range(start: ${new Date(fromts)}, stop: ${new Date(tots)}) |> filter(fn: (r) => r.id == "${tagid}")`;
                    var result = [];
                    queryApi.queryRows(query, {
                        next(row, tableMeta) {
                            const o = tableMeta.toObject(row);
                            result = result.concat({ dt: new Date(o._time).getTime(), value: o._value });
                        },
                        error(error) {
                            logger.error(`influxdb-getDaqValue failed! ${error}`);
                            reject(error);
                        },
                        complete() {
                            resolve(result);
                        }
                    });
                }

            } catch (error) {
                logger.error(`influxdb-getDaqValue failed! ${error}`);
                reject(error);
            }
        });
    }

    function writePoints(points) {
        try {
            if (influxdbVersion === VERSION_18_FLUX) {
                client.writePoints(points)
                .catch((error) => {
                    logger.error(`influxdb-writePoints failed! ${error}`);
                });
            } else {
                writeApi.writePoints(points);
                writeApi.flush(true).then(() => {
                    // reset last error ;
                }).catch(err => {
                    logger.error(`influxdb-writePoints error! ${err}`);
                    setError(err);
                });
            }
            if (currentStorage) {
                currentStorage.setValues(points);
            }
        } catch (error) {
            logger.error(`influxdb-writePoints failed! ${error}`);
        }
    }

    function setError(error) {
        influxError.error = error;
        influxError.timestamp = new Date().getTime();
    }

    this.init();
}


module.exports = {
    create: function (data, logger, currentStorate) {
        return new Influx(data, logger, currentStorate);
    }
};

var InfluxDBStatusEnum = {
    OPEN: 'open',
    CLOSE: 'close',
}