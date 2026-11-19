'use strict';

const { Session, TSDataType } = require('@iotdb/client');
const utils = require('../../utils');

function encodePathSegment(prefix, value) {
    return `${prefix}_${Buffer.from(String(value ?? ''), 'utf8').toString('hex') || 'empty'}`;
}

function getDatabasePath(value) {
    const database = String(value || 'root.fuxa').trim();
    if (!/^root(?:\.[A-Za-z_][A-Za-z0-9_]*)+$/.test(database)) {
        throw new Error('IoTDB tree database must be a path below root, such as root.fuxa');
    }
    return database;
}

function getValueInfo(value) {
    if (utils.isNullOrUndefined(value)) {
        return null;
    }
    if (utils.isBoolean(value)) {
        return { dataType: TSDataType.BOOLEAN, sqlType: 'BOOLEAN', value };
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            return null;
        }
        return { dataType: TSDataType.DOUBLE, sqlType: 'DOUBLE', value };
    }
    if (Buffer.isBuffer(value)) {
        return { dataType: TSDataType.BLOB, sqlType: 'BLOB', value: value.toString('base64') };
    }
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    if (text === undefined) {
        return null;
    }
    return { dataType: TSDataType.TEXT, sqlType: 'TEXT', value: text };
}

function getTimestamp(value) {
    const timestamp = value === undefined || value === null ? Date.now() : Number(value);
    return Number.isSafeInteger(timestamp) && timestamp >= 0 ? timestamp : null;
}

function IoTDB(_settings, _log, _currentStorage) {
    const daqstore = _settings.daqstore || {};
    const logger = _log;
    const currentStorage = _currentStorage;
    const database = daqstore.iotdbDatabase || 'root.fuxa';
    const config = {
        host: daqstore.host || '127.0.0.1',
        port: Number(daqstore.iotdbPort) || 6667,
        username: daqstore.credentials?.username || 'root',
        password: daqstore.credentials?.password || 'root',
        fetchSize: 512,
    };
    const schemaTypes = new Map();
    let session = null;
    let connectPromise = null;
    let operationQueue = Promise.resolve();
    let closing = false;

    this.setCall = function (_fncGetProp) {
        fncGetTagProp = _fncGetProp;
        return this.addDaqValues;
    };
    let fncGetTagProp = null;

    this.init = async function () {
        await connect();
    };

    this.addDaqValues = function (tagsValues, _deviceName, deviceId) {
        const dataToRestore = [];
        const devices = new Map();

        for (const tagId in tagsValues) {
            const tag = tagsValues[tagId];
            if (!tag || !tag.daq) {
                continue;
            }
            if (tag.daq.restored) {
                dataToRestore.push({ id: tag.id, deviceId, value: tag.value });
            }
            if (!tag.daq.enabled || utils.isNullOrUndefined(tag.value)) {
                continue;
            }

            const value = getValueInfo(tag.value);
            const timestamp = getTimestamp(tag.timestamp);
            if (!value || timestamp === null) {
                logger.warn(`iotdb-addDaqValues skipped unsupported value for tag ${tagId}`);
                continue;
            }

            const devicePath = encodePathSegment('d', deviceId);
            const measurement = encodePathSegment('m', tagId);
            const device = devices.get(devicePath) || { measurementTypes: new Map(), points: new Map() };
            const existingType = device.measurementTypes.get(measurement);
            if (existingType !== undefined && existingType !== value.dataType) {
                logger.error(`iotdb-addDaqValues tag ${tagId} changed value type within a batch`);
                continue;
            }
            device.measurementTypes.set(measurement, value.dataType);
            if (!device.points.has(timestamp)) {
                device.points.set(timestamp, new Map());
            }
            device.points.get(timestamp).set(measurement, value.value);
            devices.set(devicePath, device);
        }

        if (dataToRestore.length && currentStorage) {
            currentStorage.setValues(dataToRestore);
        }
        if (devices.size === 0) {
            return Promise.resolve();
        }
        if (closing) {
            return Promise.reject(new Error('IoTDB storage is closing'));
        }

        return enqueue(async () => {
            const activeSession = await connect();
            try {
                const tablets = [];
                for (const [devicePath, device] of devices) {
                    const measurements = [...device.measurementTypes.keys()];
                    for (const measurement of measurements) {
                        await ensureTimeseries(activeSession, devicePath, measurement, device.measurementTypes.get(measurement));
                    }
                    const timestamps = [...device.points.keys()].sort((a, b) => a - b);
                    const values = timestamps.map(timestamp => {
                        const point = device.points.get(timestamp);
                        return measurements.map(measurement => point.has(measurement) ? point.get(measurement) : null);
                    });
                    tablets.push({
                        deviceId: `${getValidatedDatabasePath()}.${devicePath}`,
                        measurements,
                        dataTypes: measurements.map(measurement => device.measurementTypes.get(measurement)),
                        timestamps,
                        values,
                    });
                }
                await activeSession.insertTablets(tablets);
            } catch (error) {
                await invalidateSession(activeSession);
                throw error;
            }
        }).catch(error => {
            logger.error(`iotdb-addDaqValues failed! ${error.message || error}`);
        });
    };

    this.getDaqValue = function (tagId, fromts, tots) {
        const from = getTimestamp(fromts);
        const to = getTimestamp(tots);
        if (from === null || to === null || from >= to) {
            return Promise.reject(new RangeError('IoTDB history range must be a valid increasing millisecond range'));
        }

        return enqueue(async () => {
            const activeSession = await connect();
            const measurement = encodePathSegment('m', tagId);
            const query = `SELECT ${measurement} FROM ${getValidatedDatabasePath()}.** WHERE time >= ${from} AND time < ${to}`;
            let dataSet;
            try {
                dataSet = await activeSession.executeQueryStatement(query);
                const columns = dataSet.getColumnNames();
                const columnTypes = dataSet.getColumnTypes();
                const selectedColumns = columns
                    .map((name, index) => ({
                        name: String(name).replace(/`/g, ''),
                        index,
                        dataType: String(columnTypes[index] || '').toUpperCase(),
                    }))
                    .filter(column => column.name.endsWith(`.${measurement}`));
                const data = [];
                while (await dataSet.hasNext()) {
                    const row = dataSet.next();
                    const dt = Number(row.getTimestamp());
                    for (const column of selectedColumns) {
                        let value = row.getValueByIndex(column.index);
                        if (value !== null && value !== undefined) {
                            if (column.dataType === 'BLOB') {
                                value = Buffer.from(Buffer.isBuffer(value) ? value.toString('utf8') : String(value), 'base64');
                            }
                            data.push({ dt, value });
                        }
                    }
                }
                return data.sort((a, b) => a.dt - b.dt);
            } catch (error) {
                await invalidateSession(activeSession);
                logger.error(`iotdb-getDaqValue failed! ${error.message || error}`);
                throw error;
            } finally {
                if (dataSet) {
                    await dataSet.close();
                }
            }
        });
    };

    this.close = function () {
        closing = true;
        return operationQueue.then(async () => {
            if (connectPromise) {
                await connectPromise.catch(() => null);
            }
            const currentSession = session;
            session = null;
            schemaTypes.clear();
            if (currentSession) {
                await currentSession.close();
                logger.info('IoTDB connection closed');
            }
        });
    };

    this.getDaqMap = function (tagId) {
        const map = {};
        map[tagId] = true;
        return map;
    };

    async function connect() {
        if (closing) {
            throw new Error('IoTDB storage is closed');
        }
        if (session && session.isOpen()) {
            return session;
        }
        if (connectPromise) {
            return connectPromise;
        }

        connectPromise = (async () => {
            const candidate = new Session(config);
            try {
                await candidate.open();
                try {
                    await candidate.executeNonQueryStatement(`CREATE DATABASE ${getValidatedDatabasePath()}`);
                } catch (error) {
                    if (!/has already been created as database/i.test(error.message || '')) {
                        throw error;
                    }
                }
                session = candidate;
                logger.info(`IoTDB connected to ${config.host}:${config.port}`);
                return candidate;
            } catch (error) {
                await candidate.close().catch(() => {});
                throw error;
            }
        })();
        try {
            return await connectPromise;
        } finally {
            connectPromise = null;
        }
    }

    function enqueue(operation) {
        const result = operationQueue.then(operation, operation);
        operationQueue = result.catch(() => {});
        return result;
    }

    function getValidatedDatabasePath() {
        return getDatabasePath(database);
    }

    async function ensureTimeseries(activeSession, devicePath, measurement, dataType) {
        const path = `${getValidatedDatabasePath()}.${devicePath}.${measurement}`;
        const knownType = schemaTypes.get(path);
        if (knownType !== undefined) {
            if (knownType !== dataType) {
                throw new Error(`IoTDB measurement ${path} cannot change its stored data type`);
            }
            return;
        }

        const typeName = dataType === TSDataType.BOOLEAN ? 'BOOLEAN' :
            dataType === TSDataType.DOUBLE ? 'DOUBLE' :
                dataType === TSDataType.BLOB ? 'BLOB' : 'TEXT';
        const encoding = dataType === TSDataType.DOUBLE ? 'GORILLA' : 'PLAIN';
        try {
            await activeSession.executeNonQueryStatement(
                `CREATE TIMESERIES ${path} WITH DATATYPE=${typeName}, ENCODING=${encoding}`
            );
        } catch (error) {
            if (!/already exist(?:s)?/i.test(error.message || '')) {
                throw error;
            }
            const existingType = await getTimeseriesType(activeSession, path);
            if (existingType !== typeName) {
                throw new Error(`IoTDB measurement ${path} cannot change its stored data type`);
            }
        }
        schemaTypes.set(path, dataType);
    }

    async function getTimeseriesType(activeSession, path) {
        const dataSet = await activeSession.executeQueryStatement(`SHOW TIMESERIES ${path}`);
        try {
            const columns = dataSet.getColumnNames().map(name => String(name).toLowerCase());
            const pathIndex = columns.indexOf('timeseries');
            const typeIndex = columns.indexOf('datatype');
            if (pathIndex === -1 || typeIndex === -1) {
                throw new Error('IoTDB SHOW TIMESERIES returned an unsupported result');
            }
            while (await dataSet.hasNext()) {
                const row = dataSet.next();
                if (String(row.getValueByIndex(pathIndex)) === path) {
                    return String(row.getValueByIndex(typeIndex)).toUpperCase();
                }
            }
            return null;
        } finally {
            await dataSet.close();
        }
    }

    async function invalidateSession(activeSession) {
        if (session === activeSession) {
            session = null;
            schemaTypes.clear();
        }
        await activeSession.close().catch(() => {});
    }

    this.init().catch(error => {
        logger.error(`iotdb-init failed! ${error.message || error}`);
    });
}

module.exports = {
    create: function (data, logger, currentStorage) {
        return new IoTDB(data, logger, currentStorage);
    },
    _private: {
        encodePathSegment,
        getDatabasePath,
        getTimestamp,
        getValueInfo,
    }
};
