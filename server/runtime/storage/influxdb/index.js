/**
 * Module to manage the DAQ with influxdb
 */

"use strict";

var utils = require('../../utils');

var { InfluxDB, Point, flux } = require('@influxdata/influxdb-client');

const VERSION_18_FLUX = '1.8-flux';
const VERSION_20 = '2.0';

function Influx(_settings, _log) {

    var settings = _settings;               // Application settings
    var logger = _log;                      // Application logger
    var status = InfluxDBStatusEnum.CLOSE;

    var hostname = '';
    var port = 8086;
    var database = '';
    var name = '';

    var influxError = { error: null, timestamp: 0 };
    var influxdbVersion = VERSION_20;
    var client = null;
    var clientOptions = null;
    var writeApi = null
    var queryApi = null

    this.init = function () {

        influxdbVersion = settings.daqstore.version;
        if (!influxdbVersion) {
            influxdbVersion = VERSION_20;
        }

        if (settings.daqstore.credentials && (influxdbVersion === VERSION_18_FLUX || influxdbVersion === VERSION_20)) {

            const token = influxdbVersion === VERSION_18_FLUX ?
                `${settings.daqstore.credentials.username}:${settings.daqstore.credentials.password}` :
                settings.daqstore.credentials.token;

            clientOptions = {
                url: settings.daqstore.url,
                // rejectUnauthorized: n.rejectUnauthorized,
                token
            }
            client = new InfluxDB(clientOptions);
            writeApi = client.getWriteApi(settings.daqstore.organization, settings.daqstore.bucket, 's');
            queryApi = client.getQueryApi(settings.daqstore.organization);
            status = InfluxDBStatusEnum.OPEN;
        }
    }

    this.close = function () {
        try {
            status = InfluxDBStatusEnum.CLOSE;
            writeApi.close().then(() => {
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

    this.addDaqValues = function (tags, deviceName) {
        for (var tagid in tags) {
            if (!tags[tagid].daq || !tags[tagid].daq.enabled) {
                continue;
            }
            writePoint(tags[tagid], deviceName);
        }
        writeApi.flush(true).then(() => {
            // reset last error ;
        }).catch(error => {
            setError(error);
        });
    }

    this.getDaqMap = function (tagid) {
        var dummy = {};
        dummy[tagid] = true;
        return dummy;
    }

    this.getDaqValue = function (tagid, fromts, tots) {
        return new Promise(function (resolve, reject) {
            const query = flux`from(bucket: "${settings.daqstore.bucket}") |> range(start: ${new Date(fromts)}, stop: ${new Date(tots)}) |> filter(fn: (r) => r._measurement == "${tagid}")`;
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

    function writePoint(tag, deviceName) {
        try {
            if (!utils.isNullOrUndefined(tag.value)) {
                const point = new Point(tag.id)
                .tag('name', tag.name)
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
                writeApi.writePoint(point);
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
    create: function (data, logger) {
        return new Influx(data, logger);
    }
};

var InfluxDBStatusEnum = {
    OPEN: 'open',
    CLOSE: 'close',
}