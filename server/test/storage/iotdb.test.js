'use strict';

const assert = require('node:assert/strict');
const Module = require('module');
const iotdbStorage = require('../../runtime/storage/iotdb');

const TSDataType = { BOOLEAN: 0, DOUBLE: 4, TEXT: 5, BLOB: 10 };

function createDataSet(columns, rows, types = []) {
    let index = 0;
    return {
        closed: false,
        getColumnNames() { return columns; },
        getColumnTypes() { return types; },
        async hasNext() { return index < rows.length; },
        next() {
            const row = rows[index++];
            return {
                getTimestamp() { return row.timestamp; },
                getValueByIndex(columnIndex) { return row.values[columnIndex]; },
            };
        },
        async close() { this.closed = true; },
    };
}

function createStorage({ queryResult, settings, currentStorage, onExecuteNonQueryStatement } = {}) {
    const statements = [];
    const tablets = [];
    const errors = [];
    const warnings = [];
    const info = [];
    let dataSet = queryResult || createDataSet([], []);

    class FakeSession {
        constructor(config) {
            this.config = config;
            this.opened = false;
            this.closed = false;
        }
        async open() { this.opened = true; }
        isOpen() { return this.opened && !this.closed; }
        async close() { this.closed = true; }
        async executeNonQueryStatement(sql) {
            statements.push(sql);
            if (onExecuteNonQueryStatement) {
                await onExecuteNonQueryStatement(sql);
            }
        }
        async insertTablets(values) { tablets.push(...values); }
        async executeQueryStatement(sql) {
            statements.push(sql);
            return dataSet;
        }
    }

    const modulePath = require.resolve('../../runtime/storage/iotdb');
    const originalLoad = Module._load;
    delete require.cache[modulePath];
    Module._load = function (request) {
        if (request === '@iotdb/client') {
            return { Session: FakeSession, TSDataType };
        }
        return originalLoad.apply(this, arguments);
    };

    let storage;
    try {
        const adapter = require(modulePath);
        storage = adapter.create(settings || {
            daqstore: {
                host: 'iotdb.test',
                iotdbPort: 16667,
                iotdbDatabase: 'root.fuxa',
                credentials: { username: 'root', password: 'test-password' },
            },
        }, {
            info(message) { info.push(message); },
            warn(message) { warnings.push(message); },
            error(message) { errors.push(message); },
        }, currentStorage);
        return {
            storage,
            statements,
            tablets,
            errors,
            warnings,
            info,
            setDataSet(next) { dataSet = next; },
        };
    } finally {
        Module._load = originalLoad;
        delete require.cache[modulePath];
    }
}

describe('IoTDB storage', () => {
    it('creates a database and stores supported value types in tree tablets', async () => {
        const ctx = createStorage();
        const deviceId = 'device.1/line';
        const measurements = ['temperature', 'running', 'state', 'binary'].map(tagId =>
            iotdbStorage._private.encodePathSegment('m', tagId));
        const binaryValue = Buffer.from([0, 1, 127, 255]);

        await ctx.storage.addDaqValues({
            temperature: { id: 'temperature', value: 26.5, timestamp: 1000, daq: { enabled: true } },
            running: { id: 'running', value: true, timestamp: 1000, daq: { enabled: true } },
            state: { id: 'state', value: 'ready', timestamp: 1001, daq: { enabled: true } },
            binary: { id: 'binary', value: binaryValue, timestamp: 1002, daq: { enabled: true } },
        }, 'Meter', deviceId);

        assert.ok(ctx.statements.includes('CREATE DATABASE root.fuxa'));
        assert.equal(ctx.statements.filter(sql => sql.startsWith('CREATE TIMESERIES')).length, 4);
        assert.ok(ctx.statements.some(sql => sql.includes(`${measurements[0]} WITH DATATYPE=DOUBLE, ENCODING=GORILLA`)));
        assert.ok(ctx.statements.some(sql => sql.includes(`${measurements[1]} WITH DATATYPE=BOOLEAN, ENCODING=PLAIN`)));
        assert.ok(ctx.statements.some(sql => sql.includes(`${measurements[2]} WITH DATATYPE=TEXT, ENCODING=PLAIN`)));
        assert.ok(ctx.statements.some(sql => sql.includes(`${measurements[3]} WITH DATATYPE=BLOB, ENCODING=PLAIN`)));
        assert.equal(ctx.tablets.length, 1);
        assert.equal(ctx.tablets[0].deviceId,
            `root.fuxa.${iotdbStorage._private.encodePathSegment('d', deviceId)}`);
        assert.deepEqual(ctx.tablets[0].measurements, measurements);
        assert.deepEqual(ctx.tablets[0].dataTypes, [TSDataType.DOUBLE, TSDataType.BOOLEAN, TSDataType.TEXT, TSDataType.BLOB]);
        assert.deepEqual(ctx.tablets[0].timestamps, [1000, 1001, 1002]);
        assert.deepEqual(ctx.tablets[0].values, [
            [26.5, true, null, null],
            [null, null, 'ready', null],
            [null, null, null, binaryValue.toString('base64')],
        ]);
        assert.deepEqual(ctx.errors, []);
        await ctx.storage.close();
    });

    it('reads all device series for one tag with an exclusive end time and closes the dataset', async () => {
        const ctx = createStorage();
        const measurement = iotdbStorage._private.encodePathSegment('m', 'power');
        const dataSet = createDataSet([
            `root.fuxa.${iotdbStorage._private.encodePathSegment('d', 'device1')}.${measurement}`,
            `root.fuxa.${iotdbStorage._private.encodePathSegment('d', 'device2')}.${measurement}`,
        ], [
            { timestamp: 1200, values: [4.5, null] },
            { timestamp: 1300, values: [null, 9.25] },
        ], ['DOUBLE', 'DOUBLE']);
        ctx.setDataSet(dataSet);

        const values = await ctx.storage.getDaqValue('power', 1000, 1400);

        assert.equal(ctx.statements[1], `SELECT ${measurement} FROM root.fuxa.** WHERE time >= 1000 AND time < 1400`);
        assert.deepEqual(values, [{ dt: 1200, value: 4.5 }, { dt: 1300, value: 9.25 }]);
        assert.equal(dataSet.closed, true);
        assert.deepEqual(ctx.errors, []);
        await ctx.storage.close();
    });

    it('restores binary values from the client BLOB text representation', async () => {
        const tagId = 'binary';
        const measurement = iotdbStorage._private.encodePathSegment('m', tagId);
        const expected = Buffer.from([0, 1, 127, 255]);
        const dataSet = createDataSet([
            `root.fuxa.${iotdbStorage._private.encodePathSegment('d', 'device1')}.${measurement}`,
        ], [
            { timestamp: 1200, values: [expected.toString('base64')] },
        ], ['BLOB']);
        const ctx = createStorage({ queryResult: dataSet });

        const values = await ctx.storage.getDaqValue(tagId, 1000, 1400);

        assert.deepEqual(values, [{ dt: 1200, value: expected }]);
        await ctx.storage.close();
    });

    it('restores tagged values locally while skipping disabled and invalid writes', async () => {
        const restored = [];
        const currentStorage = { setValues(values) { restored.push(...values); } };
        const ctx = createStorage({ currentStorage });
        const batch = {
            restored: { id: 'restored', value: 7, daq: { enabled: false, restored: true } },
            invalid: { id: 'invalid', value: Number.NaN, daq: { enabled: true } },
        };
        await ctx.storage.addDaqValues(batch, 'Meter', 'device-1');

        assert.deepEqual(restored, [{ id: 'restored', deviceId: 'device-1', value: 7 }]);
        assert.equal(ctx.warnings.length, 1);
        assert.equal(ctx.tablets.length, 0);
        await ctx.storage.close();
    });

    it('reuses an existing timeseries only when its stored type matches', async () => {
        const deviceId = 'device-1';
        const tagId = 'power';
        const devicePath = iotdbStorage._private.encodePathSegment('d', deviceId);
        const measurement = iotdbStorage._private.encodePathSegment('m', tagId);
        const path = `root.fuxa.${devicePath}.${measurement}`;
        const ctx = createStorage({
            queryResult: createDataSet(['Timeseries', 'DataType'], [
                { timestamp: 0, values: [path, 'DOUBLE'] },
            ]),
            onExecuteNonQueryStatement(sql) {
                if (sql.startsWith('CREATE DATABASE')) {
                    throw new Error('root.fuxa has already been created as database');
                }
                if (sql.startsWith('CREATE TIMESERIES')) {
                    throw new Error(`Path [${path}] already exist`);
                }
            },
        });

        await ctx.storage.addDaqValues({
            [tagId]: { id: tagId, value: 26.5, timestamp: 1000, daq: { enabled: true } },
        }, 'Meter', deviceId);

        assert.ok(ctx.statements.includes('CREATE DATABASE root.fuxa'));
        assert.ok(ctx.statements.includes(`SHOW TIMESERIES ${path}`));
        assert.equal(ctx.tablets.length, 1);
        assert.deepEqual(ctx.errors, []);
        await ctx.storage.close();

        const mismatch = createStorage({
            queryResult: createDataSet(['Timeseries', 'DataType'], [
                { timestamp: 0, values: [path, 'TEXT'] },
            ]),
            onExecuteNonQueryStatement(sql) {
                if (sql.startsWith('CREATE TIMESERIES')) {
                    throw new Error(`Path [${path}] already exist`);
                }
            },
        });
        await mismatch.storage.addDaqValues({
            [tagId]: { id: tagId, value: 26.5, timestamp: 1000, daq: { enabled: true } },
        }, 'Meter', deviceId);

        assert.equal(mismatch.tablets.length, 0);
        assert.match(mismatch.errors[0], /cannot change its stored data type/);
        await mismatch.storage.close();
    });

    it('rejects unsafe database paths and invalid history ranges', async () => {
        assert.throws(() => iotdbStorage._private.getDatabasePath('root.fuxa; DROP DATABASE root'), /must be a path below root/);
        assert.throws(() => iotdbStorage._private.getDatabasePath('fuxa'), /must be a path below root/);
        const encoded = iotdbStorage._private.encodePathSegment('m', 'tag.with/path');
        assert.match(encoded, /^m_[a-f0-9]+$/);
        assert.notEqual(encoded, iotdbStorage._private.encodePathSegment('m', 'tag.with.path'));

        const ctx = createStorage();
        await assert.rejects(ctx.storage.getDaqValue('power', 1000, 1000), /increasing millisecond range/);
        await ctx.storage.close();
    });
});
