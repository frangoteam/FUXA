'use strict';

const assert = require('assert').strict;
const register = require('../../integrations/node-red/node-red-contrib-fuxa/nodes/fuxa-get-historical-tags');

function createNode(tags, query, resolveTag = name => ({ Pressure: 'id-p', Flow: 'id-f' })[name]) {
    let Constructor;
    const handlers = {};
    const sent = [];
    const errors = [];
    const warnings = [];
    const calls = [];
    const fuxa = {
        getTagId: resolveTag,
        async getHistoricalTags(...args) { calls.push(args); return query(...args); },
    };
    register({ nodes: {
        registerType(type, ctor) { assert.equal(type, 'get-historical-tags'); Constructor = ctor; },
        createNode(node) {
            node.on = (event, handler) => { handlers[event] = handler; };
            node.context = () => ({ global: { get: name => name === 'fuxa' ? fuxa : undefined } });
            node.send = msg => sent.push(msg);
            node.error = (error, msg) => errors.push({ error, msg });
            node.warn = warning => warnings.push(warning);
        },
    } });
    new Constructor({ tags, from: 10, to: 30 });
    return { input: msg => handlers.input(msg), sent, errors, warnings, calls };
}

const pressure = [{ x: new Date(15), y: 101 }];
const flow = [{ x: new Date(20), y: 7 }];

describe('Node-RED historical tag names', () => {
    for (const tags of [
        ['missing', 'Pressure', 'Flow'],
        ['Pressure', 'missing', 'Flow'],
        ['Pressure', 'Flow', 'missing'],
    ]) {
        it(`keeps samples attached to their resolved names with missing tag at index ${tags.indexOf('missing')}`, async () => {
            // Storage key order is not the request order.
            const node = createNode(tags, async () => ({ 'id-f': flow, 'id-p': pressure }));
            const msg = { correlationId: 'history-1' };
            await node.input(msg);
            assert.deepEqual(node.calls, [[['id-p', 'id-f'], 10, 30]]);
            assert.deepEqual(msg.payload, { Pressure: pressure, Flow: flow });
            assert.equal(msg.topic, 'Pressure');
            assert.equal(msg.correlationId, 'history-1');
            assert.equal(node.sent[0], msg);
            assert.deepEqual(node.warnings, ['Tag not found: missing']);
            assert.deepEqual(node.errors, []);
        });
    }

    for (const tags of ['["missing","Pressure","Flow"]', 'missing, Pressure, Flow']) {
        it(`preserves name mappings in ${tags.startsWith('[') ? 'JSON' : 'legacy comma-separated'} configuration`, async () => {
            const node = createNode(tags, async () => ({ 'id-p': pressure, 'id-f': flow }));
            const msg = {};
            await node.input(msg);
            assert.deepEqual(msg.payload, { Pressure: pressure, Flow: flow });
            assert.equal(msg.topic, 'Pressure');
        });
    }

    it('retains duplicate valid references without shifting later series', async () => {
        const node = createNode(['missing', 'Pressure', 'Pressure', 'Flow'], async () => ({ 'id-p': pressure, 'id-f': flow }));
        const msg = {};
        await node.input(msg);
        assert.deepEqual(msg.payload, { Pressure: pressure, Flow: flow });
        assert.deepEqual(node.calls[0][0], ['id-p', 'id-p', 'id-f']);
    });

    it('keeps empty valid series and uses the first resolved tag as the topic', async () => {
        const node = createNode(['missing', 'Pressure', 'Flow'], async () => ({ 'id-p': [], 'id-f': flow }));
        const msg = {};
        await node.input(msg);
        assert.deepEqual(msg.payload, { Pressure: [], Flow: flow });
        assert.equal(msg.topic, 'Pressure');
    });

    it('ignores unrelated and inherited storage keys without mislabeling them', async () => {
        const data = Object.assign(Object.create({ 'id-p': pressure }), { unrelated: pressure, 'id-f': flow });
        const node = createNode(['Pressure', 'Flow'], async () => data);
        const msg = {};
        await node.input(msg);
        assert.deepEqual(msg.payload, { Flow: flow });
        assert.deepEqual(node.errors, []);
    });

    it('accepts a null-prototype storage result and retains normal sample filtering', async () => {
        const data = Object.assign(Object.create(null), { 'id-p': [
            null, { x: 10, y: null }, { x: 11 }, { y: 1 },
            { x: 12, y: 0 }, { x: 13, y: false }, { x: 14, y: '' },
        ] });
        const node = createNode(['missing', 'Pressure'], async () => data);
        const msg = {};
        await node.input(msg);
        assert.deepEqual(msg.payload, { Pressure: [{ x: 12, y: 0 }, { x: 13, y: false }, { x: 14, y: '' }] });
        assert.deepEqual(node.errors, []);
    });

    it('returns special object-property tag names as own series keys', async () => {
        const node = createNode(['__proto__', 'constructor'], async () => ({ 'id-p': pressure, 'id-f': flow }),
            name => name === '__proto__' ? 'id-p' : 'id-f');
        const msg = {};
        await node.input(msg);
        assert.equal(Object.getPrototypeOf(msg.payload), Object.prototype);
        assert.ok(Object.prototype.hasOwnProperty.call(msg.payload, '__proto__'));
        assert.deepEqual(msg.payload.__proto__, pressure);
        assert.deepEqual(msg.payload.constructor, flow);
        assert.deepEqual(Object.keys(msg.payload), ['__proto__', 'constructor']);
    });

    it('does not query or emit when no tag resolves', async () => {
        const node = createNode(['missing', 'also-missing'], async () => { throw new Error('must not query'); });
        const msg = {};
        await node.input(msg);
        assert.equal(node.calls.length, 0);
        assert.equal(node.sent.length, 0);
        assert.deepEqual(node.warnings, ['Tag not found: missing', 'Tag not found: also-missing']);
        assert.deepEqual(node.errors, [{ error: 'No valid tags found', msg }]);
    });

    it('reports storage failures against the input message without emitting data', async () => {
        const failure = new Error('history offline');
        const node = createNode(['Pressure'], async () => { throw failure; });
        const msg = {};
        await node.input(msg);
        assert.equal(node.sent.length, 0);
        assert.deepEqual(node.errors, [{ error: failure, msg }]);
    });

    it('preserves identities through the actual device manager and a SQLite-backed history query', async () => {
        const sqlite3 = require('sqlite3');
        const db = await new Promise((resolve, reject) => {
            const database = new sqlite3.Database(':memory:', error => error ? reject(error) : resolve(database));
        });
        // Isolate the manager's module-scoped runtime from other backend suites.
        const filename = require.resolve('../../runtime/devices');
        const previous = require.cache[filename];
        delete require.cache[filename];
        const manager = require(filename);
        delete require.cache[filename];
        if (previous) require.cache[filename] = previous;
        try {
            await new Promise((resolve, reject) => db.exec(
                "CREATE TABLE history (id TEXT, dt INTEGER, value REAL);" +
                "INSERT INTO history VALUES ('id-p',15,101),('id-f',20,7),('id-p',40,999);",
                error => error ? reject(error) : resolve()));
            manager.init({
                project: { getDevices: () => ({ plc: { tags: {
                    pressure: { id: 'id-p', name: 'Pressure' }, flow: { id: 'id-f', name: 'Flow' },
                } } }) },
                logger: { error: error => { throw new Error(String(error)); } },
                daqStorage: { async getNodesValues(ids, from, to) {
                    const result = {};
                    for (const id of ids) {
                        const rows = await new Promise((resolve, reject) => db.all(
                            'SELECT dt, value FROM history WHERE id=? AND dt>=? AND dt<=? ORDER BY dt',
                            [id, from, to], (error, rows) => error ? reject(error) : resolve(rows)));
                        result[id] = rows.map(row => ({ x: new Date(row.dt), y: row.value }));
                    }
                    return result;
                } },
            });
            const node = createNode(['missing', 'Pressure', 'Flow'], manager.getHistoricalTags, manager.getTagId);
            const msg = {};
            await node.input(msg);
            assert.deepEqual(msg.payload, { Pressure: pressure, Flow: flow });
            assert.equal(msg.topic, 'Pressure');
            assert.deepEqual(node.errors, []);
        } finally {
            await new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
        }
    });
});
