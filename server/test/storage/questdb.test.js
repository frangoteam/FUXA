const assert = require('node:assert/strict');
const Module = require('module');

function createQuestDbStorage({ poolQuery } = {}) {
    const rows = [];
    const errors = [];
    const warnings = [];
    const queries = [];
    let resolveFlush;
    const flushed = new Promise(resolve => { resolveFlush = resolve; });
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
            return {
                Pool: class {
                    async query(sql, params) {
                        queries.push(sql);
                        return poolQuery ? poolQuery(sql, params) : { rows: [] };
                    }
                    async end() {}
                }
            };
        }
        if (request === '@questdb/nodejs-client') {
            return { Sender: { async fromConfig() { return sender; } } };
        }
        return originalLoad.apply(this, arguments);
    };
    let storage;
    try {
        storage = require(path).create({ daqstore: {} }, {
            info() {},
            warn(message) { warnings.push(message); },
            error(message) { errors.push(message); },
        });
    } finally {
        Module._load = originalLoad;
        delete require.cache[path];
    }
    return { storage, rows, errors, warnings, queries, flushed };
}

describe('QuestDB UNS paths', () => {
    let ctx;

    beforeEach(() => {
        ctx = createQuestDbStorage();
    });

    afterEach(() => ctx.storage.close());

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
            const { storage, rows, errors, flushed } = ctx;
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

describe('QuestDB tag names', () => {
    let ctx;

    beforeEach(() => {
        ctx = createQuestDbStorage();
    });

    afterEach(() => ctx.storage.close());

    const cases = [
        ['direct tag name', { name: 'Power' }, 'Power'],
        ['nested device tag name', { tagref: { name: 'Meter Power' } }, 'Meter Power'],
        ['surrounding whitespace is preserved', { tagref: { name: ' Meter Power ' } }, ' Meter Power '],
        ['direct name takes precedence', { name: 'Direct', tagref: { name: 'Nested' } }, 'Direct'],
        ['empty direct name falls back to nested', { name: '', tagref: { name: 'Nested' } }, 'Nested'],
        ['missing name', {}, undefined],
        ['null tag reference', { tagref: null }, undefined],
        ['empty nested name', { tagref: { name: '' } }, undefined],
    ];

    for (const [name, metadata, expected] of cases) {
        it(name, async () => {
            const { storage, rows, errors, flushed } = ctx;
            const tag = { id: 'power', value: 42, timestamp: 1234, daq: { enabled: true }, ...metadata };
            const before = JSON.stringify(tag);
            storage.addDaqValues({ power: tag }, 'Meter', 'device-1');
            await flushed;
            assert.deepEqual(errors, []);
            assert.equal(rows.length, 1);
            assert.equal(rows[0].tag_name, expected);
            assert.equal(rows[0].tag_id, 'power');
            assert.equal(rows[0].device_id, 'device-1');
            assert.equal(rows[0].device_name, 'Meter');
            assert.equal(rows[0].number_value, 42);
            assert.equal(JSON.stringify(tag), before);
        });
    }
});

describe('QuestDB schema', () => {
    let ctx;

    afterEach(() => ctx.storage.close());

    it('creates the table with a tag_name column and migrates existing tables', async () => {
        ctx = createQuestDbStorage();
        ctx.storage.addDaqValues({ power: { id: 'power', name: 'Power', value: 1, daq: { enabled: true } } }, 'Meter', 'device-1');
        await ctx.flushed;
        assert.equal(ctx.queries.length, 3);
        assert.match(ctx.queries[0], /CREATE TABLE IF NOT EXISTS meters \([^)]*\btag_name SYMBOL\b/);
        assert.match(ctx.queries[1], /table_columns\('meters'\)/);
        assert.match(ctx.queries[2], /^ALTER TABLE meters ADD COLUMN tag_name SYMBOL$/);
        assert.deepEqual(ctx.errors, []);
        assert.deepEqual(ctx.warnings, []);
    });

    it('skips the tag_name migration when the column already exists', async () => {
        ctx = createQuestDbStorage({
            poolQuery(sql) {
                if (sql.includes('table_columns')) {
                    return { rows: [{ column: 'tag_id' }, { column: 'tag_name' }] };
                }
                if (sql.startsWith('ALTER TABLE')) {
                    throw new Error('unexpected ALTER');
                }
                return { rows: [] };
            }
        });
        ctx.storage.addDaqValues({ power: { id: 'power', name: 'Power', value: 1, daq: { enabled: true } } }, 'Meter', 'device-1');
        await ctx.flushed;
        assert.equal(ctx.queries.length, 2);
        assert.ok(!ctx.queries.some(sql => sql.startsWith('ALTER TABLE')));
        assert.deepEqual(ctx.errors, []);
        assert.deepEqual(ctx.warnings, []);
    });

    it('keeps writing when the tag_name migration is rejected', async () => {
        ctx = createQuestDbStorage({
            poolQuery(sql) {
                if (sql.startsWith('ALTER TABLE')) {
                    throw new Error('unsupported');
                }
                return { rows: [] };
            }
        });
        ctx.storage.addDaqValues({ power: { id: 'power', name: 'Power', value: 1, daq: { enabled: true } } }, 'Meter', 'device-1');
        await ctx.flushed;
        assert.deepEqual(ctx.errors, []);
        assert.equal(ctx.warnings.length, 1);
        assert.match(ctx.warnings[0], /tag_name.*unsupported/);
        assert.equal(ctx.rows.length, 1);
        assert.equal(ctx.rows[0].tag_name, 'Power');
    });
});

describe('QuestDB history timestamps', () => {
    const realTypes = require('pg').types;
    let originalTz;
    let ctx;

    before(() => {
        originalTz = process.env.TZ;
        // A non-UTC server zone exposes local-time parsing of QuestDB timestamps.
        process.env.TZ = 'Europe/Helsinki';
    });

    after(() => {
        if (originalTz === undefined) {
            delete process.env.TZ;
        } else {
            process.env.TZ = originalTz;
        }
    });

    afterEach(() => ctx.storage.close());

    it('reads QuestDB UTC timestamps without a local-time shift', async () => {
        assert.equal(new Date(Date.UTC(2026, 10, 11)).getTimezoneOffset(), -120);
        const stored = Date.UTC(2026, 10, 11, 10, 0, 0, 123);
        let selectParams;
        ctx = createQuestDbStorage({
            poolQuery(sql, params) {
                // Only answer the history query; schema queries get no rows.
                if (!sql.includes('WHERE tag_id = $1')) {
                    return { rows: [] };
                }
                selectParams = params;
                // Answer like pg would: a LONG cast arrives as an int8 string, while a
                // bare TIMESTAMP column (OID 1114, no zone) is parsed as local time.
                const selectsEpoch = /cast\(timestamp AS long\) AS ts/i.test(sql);
                const parseLocal = realTypes.getTypeParser(1114, 'text');
                const row = (micros, timestamp, number_value, string_value) => (selectsEpoch
                    ? { ts: micros, number_value, string_value }
                    : { timestamp: parseLocal(timestamp), number_value, string_value });
                return { rows: [
                    row('1794391200123456', '2026-11-11 10:00:00.123456', 42, null),
                    row('1794391201000000', '2026-11-11 10:00:01', null, 'on'),
                ] };
            }
        });
        const rows = await ctx.storage.getDaqValue('power', stored - 3600e3, stored + 3600e3);
        assert.deepEqual(rows, [
            { dt: stored, value: 42 },
            { dt: Date.UTC(2026, 10, 11, 10, 0, 1), value: 'on' },
        ]);
        assert.deepEqual(selectParams, ['power', '2026-11-11T09:00:00.123Z', '2026-11-11T11:00:00.123Z']);
        assert.deepEqual(ctx.errors, []);
    });
});
