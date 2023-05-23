/**
 * Module to manage the DAQ with influxdb
 */

"use strict";

var utils = require('../../utils');
let influx = require('influx')
var { InfluxDB, Point, flux } = require('@influxdata/influxdb-client');
//var { InfluxDB, Point, flux } = ***@***.***/influxdb-client');


function Influx(_settings, _log) {

    var settings = _settings;               // Application settings
    var logger = _log;                      // Application logger
    var status = InfluxDBStatusEnum.CLOSE;


    var influxError = { error: null, timestamp: 0 };
    var influxdbVersion = VERSION_20;
    var client = null;
    var clientOptions = null
    var writeApi = null
    var queryApi = null

    this.init = function () {

        // This is where it needs to have a FRONT END so this options is dynamic//----------------------------------->>>

        if (settings.daqstore.url != "") {

            clientOptions = {
                host: "the host or the IP of influxserver (string)",
                port: 8086,
                protocol: 'https', // *could be http or https
                database: "the database name in the influxdb (string)",
                username:'username (string)',
                password:'password (string)',
                options: {
                    rejectUnauthorized: false // this options is needed when protocol is set to https and the influxdb server is using a self-signed certificate (it is important)
                }
            }
            // client = new influx.InfluxDB(clientOptions);
            client = new InfluxDB(clientOptions);
            writeApi = client.getWriteApi(settings.daqstore.organization, settings.daqstore.bucket, 's');
            queryApi = client.getQueryApi(settings.daqstore.organization);
            status = InfluxDBStatusEnum.OPEN;
        }
    }

    this.close = function () {
        try {
            status = InfluxDBStatusEnum.CLOSE;
            client.close.then(() => {
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

    this.addDaqValues = function (tagsValues, deviceName) {
        var dataToWrite = []
        for (var tagid in tagsValues) {
            let tag = tagsValues[tagid];
            if (!tag.daq || !tag.daq.enabled || utils.isNullOrUndefined(tag.value)) {
                continue;
            }
            const tags = {
                id: tag.id,
                devicename: deviceName
            }
            let fields = {
                value: tag.value
            }
            if (utils.isBoolean(tag.value)) {
                fields.value = tag.value * 1
            }
            var pts = {
                measurement: tag.name,
                tags,
                fields,
                timestamp: tag.timestamp * 1000000 || new Date().getTime() * 1000000
            }
            dataToWrite.push(pts)
        }
        writePoints(dataToWrite)
    }

    this.getDaqMap = function (tagid) {
        var dummy = {};
        dummy[tagid] = true;
        return dummy;
    }

    this.getDaqValue = function (tagid, fromts, tots) {
        return new Promise(function (resolve, reject) {
            const query = flux`from(bucket: "${settings.daqstore.bucket}") |> range(start: ${new Date(fromts)}, stop: ${new Date(tots)}) |> filter(fn: (r) => r.id == "${tagid}")`;
            try {
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
                })
            } catch (error) {
                logger.error(`influxdb-getDaqValue failed! ${error}`);
                reject(error);
            }
        });
    }

    async function writePoints(pts) {
        try {
            await writeApi.writePoints(pts);
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
    create: function (data, logger) {
        return new Influx(data, logger);
    }
};

var InfluxDBStatusEnum = {
    OPEN: 'open',
    CLOSE: 'close',
}