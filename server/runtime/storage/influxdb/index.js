/**
 * Module to manage the DAQ with influxdb
 */

"use strict";

var utils = require('../../utils');

var { InfluxDB, Point } = require('@influxdata/influxdb-client');

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

    var influxdbVersion = VERSION_20;
    var client = null;

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
            status = InfluxDBStatusEnum.OPEN;
        }
    }

    this.close = function () {
        status = InfluxDBStatusEnum.CLOSE;
    }

    this.setCall = function (fncgetprop) {
        fncGetTagProp = fncgetprop;
        console.error('setCall Not supported!');
        return this.addDaqValues;
    }
    var fncGetTagProp = null;

    this.addDaqValue = function (tagid, tagvalue) {
        console.error('addDaqValue Not supported!');
    }

    this.addDaqValues = function (tags, tagid, tagvalue) {
        console.error('addDaqValues Not supported!');
    }

    this.getDaqMap = function () {
        console.error('getDaqMap Not supported!');
        return null;
    }

    this.getDaqValue = function (tagid, fromts, tots) {
        return new Promise(function (resolve, reject) {
            console.error('getDaqValue Not supported!');
            reject('getDaqValue Not supported!');
        });
    }

    this.init();
}

// RED.nodes.registerType("influxdb", InfluxConfigNode, {
//     credentials: {
//         username: { type: "text" },
//         password: { type: "password" },
//         token: { type: "password" }
//     }
// });

function isIntegerString(value) {
    return /^-?\d+i$/.test(value);
}

function setFieldIntegers(fields) {
    for (const prop in fields) {
        const value = fields[prop];
        if (isIntegerString(value)) {
            fields[prop] = parseInt(value.substring(0,value.length-1));
        }
    }
}

function addFieldToPoint(point, name, value) {
    if (name === 'time') {
        point.timestamp(value);
    } else if (typeof value === 'number') {
        point.floatField(name, value);
    } else if (typeof value === 'string') {
        // string values with numbers ending with 'i' are considered integers            
        if (isIntegerString(value)) {
            value = parseInt(value.substring(0,value.length-1));
            point.intField(name, value);
        } else {
            point.stringField(name, value);
        }
    } else if (typeof value === 'boolean') {
        point.booleanField(name, value);
    }
}

function addFieldsToPoint(point, fields) {
    for (const prop in fields) {
        const value = fields[prop];
        addFieldToPoint(point, prop, value);
    }
}

// write using influx-client-js
function writePoints(msg, node, done) {
    var measurement = msg.hasOwnProperty('measurement') ? msg.measurement : node.measurement;
    if (!measurement) {
        console.error("influxdb.errors.nomeasurement");
    }
    try {
        if (Array.isArray(msg.payload) && msg.payload.length > 0) {
            // array of arrays: multiple points with fields and tags
            if (Array.isArray(msg.payload[0]) && msg.payload[0].length > 0) {
                msg.payload.forEach(element => {
                    let point = new Point(measurement);
                    let fields = element[0];
                    addFieldsToPoint(point, fields);
                    let tags = element[1];
                    for (const prop in tags) {
                        point.tag(prop, tags[prop]);
                    }
                    node.client.writePoint(point);
                });
            } else {
                // array of non-arrays: one point with both fields and tags
                let point = new Point(measurement);
                let fields = msg.payload[0];
                addFieldsToPoint(point, fields);
                const tags = msg.payload[1];
                for (const prop in tags) {
                    point.tag(prop, tags[prop]);
                }
                node.client.writePoint(point)
            }
        } else {
            // single object: fields only
            if (utils.isPlainObject(msg.payload)) {
                let point = new Point(measurement);
                let fields = msg.payload;
                addFieldsToPoint(point, fields);
                node.client.writePoint(point);
            } else {
                // just a value
                let point = new Point(measurement);
                let value = msg.payload;
                addFieldToPoint(point, 'value', value);
                node.client.writePoint(point);
            }
        }

        node.client.flush(true).then(() => {
                done();
            }).catch(error => {
                msg.influx_error = {
                    errorMessage: error
                };
                done(error);
            });
    } catch (error) {
        msg.influx_error = {
            errorMessage: error
        };
        done(error);
    }
}

/**
 * Output node to write to a single influxdb measurement
 */
function InfluxOutNode(n) {
    RED.nodes.createNode(this, n);
    this.measurement = n.measurement;
    this.influxdb = n.influxdb;
    this.influxdbConfig = RED.nodes.getNode(this.influxdb);
    this.precision = n.precision;
    this.retentionPolicy = n.retentionPolicy;

    // 1.8 and 2.0 only
    this.database = n.database;
    this.precisionV18FluxV20 = n.precisionV18FluxV20;
    this.retentionPolicyV18Flux = n.retentionPolicyV18Flux;
    this.org = n.org;
    this.bucket = n.bucket;

    if (!this.influxdbConfig) {
        this.error(RED._("influxdb.errors.missingconfig"));
        return;
    }
    let version = this.influxdbConfig.influxdbVersion;

    var node = this;

    if (version === VERSION_18_FLUX || version === VERSION_20) {
        let bucket = this.bucket;
        if (version === VERSION_18_FLUX) {
            let retentionPolicy = this.retentionPolicyV18Flux ? this.retentionPolicyV18Flux : 'autogen';
            bucket = `${this.database}/${retentionPolicy}`;
        }
        let org = version === VERSION_18_FLUX ? '' : this.org;

        this.client = this.influxdbConfig.client.getWriteApi(org, bucket, this.precisionV18FluxV20);

        node.on("input", function (msg, send, done) {
            writePoints(msg, node, done);
        });
    }
}

/**
 * Output node to write to multiple InfluxDb measurements
 */
function InfluxBatchNode(n) {
    RED.nodes.createNode(this, n);
    this.influxdb = n.influxdb;
    this.influxdbConfig = RED.nodes.getNode(this.influxdb);
    this.precision = n.precision;
    this.retentionPolicy = n.retentionPolicy;

    // 1.8 and 2.0
    this.database = n.database;
    this.precisionV18FluxV20 = n.precisionV18FluxV20;
    this.retentionPolicyV18Flux = n.retentionPolicyV18Flux;
    this.org = n.org;
    this.bucket = n.bucket;


    if (!this.influxdbConfig) {
        this.error(RED._("influxdb.errors.missingconfig"));
        return;
    }
    let version = this.influxdbConfig.influxdbVersion;

    var node = this;

    if (version === VERSION_18_FLUX || version === VERSION_20) {
        let bucket = node.bucket;
        if (version === VERSION_18_FLUX) {
            let retentionPolicy = this.retentionPolicyV18Flux ? this.retentionPolicyV18Flux : 'autogen';
            bucket = `${this.database}/${retentionPolicy}`;
        }
        let org = version === VERSION_18_FLUX ? '' : this.org;

        var client = this.influxdbConfig.client.getWriteApi(org, bucket, this.precisionV18FluxV20);

        node.on("input", function (msg, send, done) {

            msg.payload.forEach(element => {
                let point = new Point(element.measurement);
    
                // time is reserved as a field name still! will be overridden by the timestamp below.
                addFieldsToPoint(point, element.fields);

                let tags = element.tags;
                if (tags) {
                    for (const prop in tags) {
                        point.tag(prop, tags[prop]);
                    }
                }
                if (element.timestamp) {
                    point.timestamp(element.timestamp);
                }
                client.writePoint(point);
            });

            // ensure we write everything including scheduled retries
            client.flush(true).then(() => {
                    done();
                }).catch(error => {
                    msg.influx_error = {
                        errorMessage: error
                    };
                    done(error);
                });
        });
    }
}

/**
 * Input node to make queries to influxdb
 */
function InfluxInNode(n) {
    RED.nodes.createNode(this, n);
    this.influxdb = n.influxdb;
    this.query = n.query;
    this.precision = n.precision;
    this.retentionPolicy = n.retentionPolicy;
    this.rawOutput = n.rawOutput;
    this.influxdbConfig = RED.nodes.getNode(this.influxdb);
    this.org = n.org;

    if (!this.influxdbConfig) {
        this.error(RED._("influxdb.errors.missingconfig"));
        return;
    }

    let version = this.influxdbConfig.influxdbVersion
    if (version === VERSION_18_FLUX || version === VERSION_20) {
        let org = version === VERSION_20 ? this.org : ''
        this.client = this.influxdbConfig.client.getQueryApi(org);
        var node = this;

        node.on("input", function (msg, send, done) {
            var query = msg.hasOwnProperty('query') ? msg.query : node.query;
            if (!query) {
                return done(RED._("influxdb.errors.noquery"));
            }
            var output = [];
            node.client.queryRows(query, {
                next(row, tableMeta) {
                    var o = tableMeta.toObject(row)
                    output.push(o);
                },
                error(error) {
                    msg.influx_error = {
                        errorMessage: error
                    };
                    done(error);
                },
                complete() {
                    msg.payload = output;
                    send(msg);
                    done();
                },
            });
        });
    }
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