'use strict';

const assert = require('node:assert/strict');
const registerNode = require('../../integrations/node-red/node-red-contrib-fuxa/nodes/fuxa-get-daq');

function createNode(config = {}, query = async () => []) {
    const handlers = {};
    const calls = [];
    const sent = [];
    const errors = [];
    const lookups = [];
    let Constructor;
    registerNode({
        nodes: {
            createNode(node) {
                node.on = (event, callback) => { handlers[event] = callback; };
                node.send = msg => sent.push(msg);
                node.error = (error, msg) => errors.push({ error, msg });
            },
            registerType(type, ctor) {
                assert.equal(type, 'get-daq');
                Constructor = ctor;
            }
        },
        settings: { functionGlobalContext: { fuxa: {
            getTagId(name) { lookups.push(name); return name === 'Pressure' ? 'tag-1' : null; },
            async getDaq(...args) { calls.push(args); return query(...args); }
        } } }
    });
    new Constructor(config);
    return { input: msg => handlers.input(msg), calls, sent, errors, lookups };
}

describe('Node-RED get-daq timestamp contract', () => {
    it('converts configured editor date strings to millisecond timestamps', async () => {
        const node = createNode({ tagId: 'tag-1', from: '2026-01-01 00:00:00', to: '2026-01-02 00:00:00' });
        await node.input({});
        assert.deepEqual(node.calls, [['tag-1', new Date('2026-01-01 00:00:00').getTime(), new Date('2026-01-02 00:00:00').getTime()]]);
    });

    it('converts ISO message timestamps and preserves the requested range', async () => {
        const node = createNode({ tagId: 'tag-1' });
        await node.input({ from: '2026-01-01T02:00:00+02:00', to: '2026-01-02T00:00:00Z' });
        assert.deepEqual(node.calls, [['tag-1', Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 2)]]);
    });

    it('message timestamps override static node settings as documented', async () => {
        const node = createNode({ tagId: 'tag-1', from: 100, to: 200 });
        await node.input({ from: 300, to: 400 });
        assert.deepEqual(node.calls, [['tag-1', 300, 400]]);
    });

    it('preserves zero and permits a zero-width range at the epoch', async () => {
        const node = createNode({ tagId: 'tag-1' });
        await node.input({ from: 0, to: 0 });
        assert.deepEqual(node.calls, [['tag-1', 0, 0]]);
    });

    it('accepts numeric timestamp strings without interpreting them as dates', async () => {
        const node = createNode({ tagId: 'tag-1' });
        await node.input({ from: '0', to: '1767225600000' });
        assert.deepEqual(node.calls, [['tag-1', 0, 1767225600000]]);
    });

    it('uses one clock sample for the default last-hour range', async () => {
        const originalNow = Date.now;
        let reads = 0;
        Date.now = () => { reads++; return 7200000; };
        try {
            const node = createNode({ tagId: 'tag-1', from: '', to: '' });
            await node.input({});
            assert.deepEqual(node.calls, [['tag-1', 3600000, 7200000]]);
            assert.equal(reads, 1);
        } finally {
            Date.now = originalNow;
        }
    });

    it('blank and null message timestamps fall back independently to configured values', async () => {
        const node = createNode({ tagId: 'tag-1', from: 10, to: 20 });
        await node.input({ from: '  ', to: null });
        assert.deepEqual(node.calls, [['tag-1', 10, 20]]);
    });

    it('overrides just one endpoint while preserving the other configured endpoint', async () => {
        const node = createNode({ tagId: 'tag-1', from: 10, to: 20 });
        await node.input({ to: 30 });
        assert.deepEqual(node.calls, [['tag-1', 10, 30]]);
    });

    for (const value of ['not-a-date', NaN, Infinity, false, {}, []]) {
        it(`rejects invalid start timestamp ${String(value)} (${typeof value}) before storage is queried`, async () => {
            const node = createNode({ tagId: 'tag-1' });
            const msg = { from: value, to: 100 };
            await node.input(msg);
            assert.equal(node.calls.length, 0);
            assert.equal(node.sent.length, 0);
            assert.equal(node.errors.length, 1);
            assert.match(String(node.errors[0].error), /from.*timestamp/i);
            assert.equal(node.errors[0].msg, msg);
        });
    }

    it('rejects an invalid end timestamp before storage is queried', async () => {
        const node = createNode({ tagId: 'tag-1' });
        await node.input({ from: 0, to: 'not-a-date' });
        assert.equal(node.calls.length, 0);
        assert.equal(node.sent.length, 0);
        assert.match(String(node.errors[0].error), /to.*timestamp/i);
    });

    it('rejects a reversed range rather than querying an unintended window', async () => {
        const node = createNode({ tagId: 'tag-1' });
        await node.input({ from: 20, to: 10 });
        assert.equal(node.calls.length, 0);
        assert.equal(node.sent.length, 0);
        assert.match(String(node.errors[0].error), /from.*to/i);
    });

    it('preserves tag-name lookup and the original message when returning rows', async () => {
        const rows = [{ dt: 15, value: '42' }];
        const node = createNode({ tag: 'Pressure' }, async () => rows);
        const msg = { from: 10, to: 20, topic: 'request', correlationId: 'abc' };
        await node.input(msg);
        assert.deepEqual(node.lookups, ['Pressure']);
        assert.deepEqual(node.calls, [['tag-1', 10, 20]]);
        assert.equal(node.sent[0], msg);
        assert.equal(msg.payload, rows);
        assert.equal(msg.correlationId, 'abc');
        assert.equal(msg.topic, 'request');
    });

    it('reports storage failures without forwarding a successful message', async () => {
        const failure = new Error('storage offline');
        const node = createNode({ tagId: 'tag-1' }, async () => { throw failure; });
        const msg = { from: 10, to: 20 };
        await node.input(msg);
        assert.equal(node.sent.length, 0);
        assert.deepEqual(node.errors, [{ error: failure, msg }]);
    });

    it('does not query storage when tag lookup fails', async () => {
        const node = createNode({ tag: 'missing' });
        await node.input({ from: 10, to: 20 });
        assert.equal(node.calls.length, 0);
        assert.equal(node.sent.length, 0);
        assert.match(String(node.errors[0].error), /Tag not found/);
    });

    describe('SQLite-backed query contract', () => {
        let db;

        beforeEach(async () => {
            const sqlite3 = require('sqlite3');
            db = await new Promise((resolve, reject) => {
                const database = new sqlite3.Database(':memory:', err => err ? reject(err) : resolve(database));
            });
            await new Promise((resolve, reject) => db.exec(
                "CREATE TABLE data (id TEXT, dt INTEGER, value TEXT);" +
                "INSERT INTO data VALUES ('tag-1', 0, 'epoch')," +
                "('tag-1', 1767225600000, 'start'), ('tag-1', 1767268800000, 'middle')," +
                "('tag-1', 1767312000000, 'end'), ('other-tag', 1767268800000, 'other');",
                err => err ? reject(err) : resolve()
            ));
        });

        afterEach(async () => {
            if (db) await new Promise((resolve, reject) => db.close(err => err ? reject(err) : resolve()));
            db = null;
        });

        function query(tagId, from, to) {
            // Same parameterized numeric timestamp predicate as sqlite/index.js.
            return new Promise((resolve, reject) => db.all(
                'SELECT dt, value FROM data WHERE id = ? AND dt BETWEEN ? and ? ORDER BY dt ASC',
                [tagId, from, to],
                (err, rows) => err ? reject(err) : resolve(rows)
            ));
        }

        it('returns only the requested tag and ISO date window from numeric SQLite rows', async () => {
            const node = createNode({ tagId: 'tag-1' }, query);
            await node.input({ from: '2026-01-01T06:00:00Z', to: '2026-01-01T18:00:00Z' });
            assert.equal(node.errors.length, 0);
            assert.deepEqual(node.sent[0].payload, [{ dt: 1767268800000, value: 'middle' }]);
        });

        it('returns the epoch row rather than silently querying the last hour', async () => {
            const node = createNode({ tagId: 'tag-1' }, query);
            await node.input({ from: 0, to: 0 });
            assert.equal(node.errors.length, 0);
            assert.deepEqual(node.sent[0].payload, [{ dt: 0, value: 'epoch' }]);
        });
    });
});
