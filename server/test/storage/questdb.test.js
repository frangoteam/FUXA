const assert = require('node:assert/strict');
const Module = require('module');

describe('QuestDB UNS paths', () => {
    let storage;
    let rows;
    let flushed;
    let errors;

    beforeEach(() => {
        rows = [];
        errors = [];
        let resolveFlush;
        flushed = new Promise(resolve => { resolveFlush = resolve; });
        let row;
        const sender = {
            table(name) { row = { table: name }; return this; },
            symbol(name, value) { row[name] = value; return this; },
            stringColumn(name, value) { row[name] = value; return this; },
            floatColumn(name, value) { row[name] = value; return this; },
            async at(timestamp, unit) { rows.push({ ...row, timestamp, unit }); },
            async flush() { resolveFlush(); },
            async close() {},
        };
        const originalLoad = Module._load;
        const path = require.resolve('../../runtime/storage/questdb');
        delete require.cache[path];
        Module._load = function (request) {
            if (request === 'pg') {
                return { Pool: class { async query() { return { rows: [] }; } async end() {} } };
            }
            if (request === '@questdb/nodejs-client') {
                return { Sender: { async fromConfig() { return sender; } } };
            }
            return originalLoad.apply(this, arguments);
        };
        try {
            storage = require(path).create({ daqstore: {} }, {
                info() {}, warn() {}, error(message) { errors.push(message); },
            });
        } finally {
            Module._load = originalLoad;
            delete require.cache[path];
        }
    });

    afterEach(() => storage.close());

    const cases = [
        ['nested device path', { tagref: { unsPath: ' Floor/Meter/Power ' } }, 'Floor/Meter/Power'],
        ['direct script path', { unsPath: 'Script/Power' }, 'Script/Power'],
        ['direct path takes precedence', { unsPath: 'Direct', tagref: { unsPath: 'Nested' } }, 'Direct'],
        ['explicit empty path', { unsPath: '', tagref: { unsPath: 'Nested' } }, undefined],
        ['explicit null path', { unsPath: null, tagref: { unsPath: 'Nested' } }, undefined],
        ['missing path', {}, undefined],
        ['null tag reference', { tagref: null }, undefined],
        ['blank nested path', { tagref: { unsPath: '   ' } }, undefined],
    ];

    for (const [name, metadata, expected] of cases) {
        it(name, async () => {
            const tag = { id: 'power', value: 42, timestamp: 1234, daq: { enabled: true }, ...metadata };
            const before = JSON.stringify(tag);
            storage.addDaqValues({ power: tag }, 'Meter', 'device-1');
            await flushed;
            assert.deepEqual(errors, []);
            assert.equal(rows.length, 1);
            assert.equal(rows[0].uns_path, expected);
            assert.equal(rows[0].tag_id, 'power');
            assert.equal(rows[0].device_id, 'device-1');
            assert.equal(rows[0].device_name, 'Meter');
            assert.equal(rows[0].number_value, 42);
            assert.equal(rows[0].timestamp, 1234);
            assert.equal(rows[0].unit, 'ms');
            assert.equal(JSON.stringify(tag), before);
        });
    }
});
