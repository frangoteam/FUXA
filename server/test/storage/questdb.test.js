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
                    async query(sql) {
                        queries.push(sql);
                        return poolQuery ? poolQuery(sql) : { rows: [] };
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
