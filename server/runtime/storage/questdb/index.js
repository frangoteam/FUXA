'use strict'

const { Pool } = require('pg');
const { Sender } = require('@questdb/nodejs-client');
let utils = require('../../utils');

function QuestDB(_settings, _log, _currentStorage) {
    let settings = _settings;               // Application settings
    const logger = _log;                    // Application logger
    const currentStorage = _currentStorage; // Database to set the last value (current)
    let pool = null;
    let sender = null;
    const tableName = getTableName();
    let writeQueue = Promise.resolve();
    let initPromise = Promise.resolve();

    this.setCall = function (_fncGetProp) {
        fncGetTagProp = _fncGetProp;
        return this.addDaqValues;
    }
    var fncGetTagProp = null;

    this.init = async function () {
        try {
            pool = new Pool(getQueryClientConfig());
            sender = await Sender.fromConfig(getIngestConfigString());
            await ensureSchema();
            logger.info('QuestDB connected');
        } catch (error) {
            logger.error(`questdb-init failed! ${error}`);
        }
    }

    this.addDaqValues = function (tagsValues, deviceName, deviceId) {
        var dataToRestore = [];
        var rowsToWrite = [];

        for (const tagid in tagsValues) {
            let tag = tagsValues[tagid];
            if (!tag.daq) {
                continue;
            }
            if (tag.daq.restored) {
                dataToRestore.push({ id: tag.id, deviceId: deviceId, value: tag.value });
            }
            if (!tag.daq.enabled || utils.isNullOrUndefined(tag.value) || Number.isNaN(tag.value)) {
                continue;
            }

            rowsToWrite.push({
                tagid,
                deviceId,
                deviceName: deviceName || '',
                unsPath: normalizeSymbolValue(tag.unsPath === undefined ? tag.tagref?.unsPath : tag.unsPath),
                tagName: utils.getTagName(tag) || null,
                value: tag.value,
                timestamp: tag.timestamp || Date.now(),
            });
        }

        if (rowsToWrite.length) {
            writeQueue = writeQueue.then(async () => {
                await initPromise;
                if (!sender) {
                    return;
                }

                for (const row of rowsToWrite) {
                    const parsedValue = normalizeValue(row.value);
                    let line = sender
                        .table(tableName)
                        .symbol('tag_id', row.tagid)
                        .symbol('device_id', row.deviceId);
                    if (!utils.isNullOrUndefined(row.unsPath)) {
                        line = line.symbol('uns_path', row.unsPath);
                    }
                    if (!utils.isNullOrUndefined(row.tagName)) {
                        line = line.symbol('tag_name', row.tagName);
                    }
                    line = line.stringColumn('device_name', row.deviceName);

                    if (!utils.isNullOrUndefined(parsedValue.numberValue)) {
                        line = line.floatColumn('number_value', parsedValue.numberValue);
                    }
                    if (!utils.isNullOrUndefined(parsedValue.stringValue)) {
                        line = line.stringColumn('string_value', parsedValue.stringValue);
                    }
                    await line.at(Number(row.timestamp), 'ms');
                }
                await sender.flush();
            }).catch((error) => {
                logger.error(`questdb-addDaqValues failed! ${error}`);
            });
        }

        if (dataToRestore.length && currentStorage) {
            currentStorage.setValues(dataToRestore);
        }
    }

    this.getDaqValue = function (tagid, fromts, tots) {
        return new Promise(function (resolve, reject) {
            initPromise.then(() => {
                if (!pool) {
                    resolve([]);
                    return;
                }

                // QuestDB stores timestamps in UTC but sends TIMESTAMP columns as
                // `timestamp without time zone`, which pg parses as local time. Read
                // epoch microseconds instead so no timezone is involved.
                const query = `SELECT cast(timestamp AS long) AS ts, number_value, string_value
                               FROM ${tableName}
                               WHERE tag_id = $1
                                 AND timestamp >= $2
                                 AND timestamp < $3
                               ORDER BY timestamp`;
                // Send UTC ISO strings. pg would serialize Date objects as local time
                // with an offset (e.g. +02:00); a plain UTC 'Z' value avoids relying
                // on QuestDB honouring that offset.
                const from = new Date(fromts);
                const to = new Date(tots);
                if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
                    const error = new Error(`invalid time range ${fromts} - ${tots}`);
                    logger.error(`questdb-getDaqValue failed! ${error}`);
                    reject(error);
                    return;
                }
                const params = [tagid, from.toISOString(), to.toISOString()];

                pool.query(query, params)
                    .then((result) => {
                        let data = [];
                        result.rows.forEach((row) => {
                            const value = !utils.isNullOrUndefined(row.number_value) ? Number(row.number_value) : row.string_value;
                            // pg returns LONG (int8) as a string; micros fit safely in a Number.
                            data.push({ dt: Math.floor(Number(row.ts) / 1000), value });
                        });
                        resolve(data)
                    })
                    .catch((error) => {
                        logger.error(`questdb-getDaqValue failed! ${error}`)
                        reject(error)
                    })
            }).catch((error) => {
                logger.error(`questdb-getDaqValue failed! ${error}`)
                reject(error)
            });
        })
    }

    this.close = function () {
        if (sender) {
            sender.close().catch((error) => {
                logger.error(`questdb-close sender failed! ${error}`);
            });
            sender = null;
        }
        if (pool) {
            pool.end().catch((error) => {
                logger.error(`questdb-close pool failed! ${error}`);
            });
            pool = null;
        }
    }

    this.getDaqMap = function (tagid) {
        var dummy = {};
        dummy[tagid] = true;
        return dummy;
    }

    async function ensureSchema() {
        if (!pool) {
            return;
        }
        await pool.query(`CREATE TABLE IF NOT EXISTS ${tableName} (
            timestamp TIMESTAMP,
            tag_id SYMBOL,
            number_value FLOAT,
            string_value STRING,
            device_id SYMBOL,
            device_name STRING,
            uns_path SYMBOL,
            tag_name SYMBOL
        ) TIMESTAMP(timestamp) PARTITION BY DAY`);
        // Tables created by older versions lack the tag_name column
        try {
            const columns = await pool.query(`SELECT "column" FROM table_columns('${tableName}')`);
            if (!columns.rows.some(row => row.column === 'tag_name')) {
                await pool.query(`ALTER TABLE ${tableName} ADD COLUMN tag_name SYMBOL`);
            }
        } catch (error) {
            logger.warn(`questdb-ensureSchema add tag_name column failed! ${error}`);
        }
    }

    function getIngestConfigString() {
        return settings.daqstore.configurationString || 'http::addr=localhost:9000;';
    }

    function getQueryClientConfig() {
        return {
            host: settings.daqstore.host || '127.0.0.1',
            port: 8812, // Standard port
            database: 'qdb', // Standard database
            user: settings.daqstore.credentials?.username || 'admin',
            password: settings.daqstore.credentials?.password || 'quest',
            max: 10, // Pool with 10 connections
            idleTimeoutMillis: 30000, // 30s
        };
    }

    function getTableName() {
        const name = (settings.daqstore.tableName || 'meters').trim();
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
            return name.toLowerCase();
        }
        logger.warn(`questdb invalid tableName "${name}", fallback to meters`);
        return 'meters';
    }

    function normalizeValue(value) {
        if (utils.isNullOrUndefined(value)) {
            return { numberValue: null, stringValue: null };
        }
        if (utils.isBoolean(value)) {
            return {
                numberValue: value ? 1 : 0,
                stringValue: null
            };
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
            return { numberValue: value, stringValue: null };
        }
        return { numberValue: null, stringValue: String(value) };
    }

    function normalizeSymbolValue(value) {
        if (utils.isNullOrUndefined(value)) {
            return null;
        }
        const normalized = String(value).trim();
        return normalized.length ? normalized : null;
    }

    initPromise = this.init();
}

module.exports = {
    create: function (data, logger, currentStorage) {
        return new QuestDB(data, logger, currentStorage);
    }
};
