'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const registerNode = require('../../integrations/node-red/node-red-contrib-fuxa/nodes/fuxa-get-history-alarms');

function createNode(config = {}, query = async () => []) {
    const handlers = {};
    const calls = [];
    const sent = [];
    const errors = [];
    let Constructor;
    registerNode({
        nodes: {
            createNode(node) {
                node.on = (event, callback) => { handlers[event] = callback; };
                node.send = msg => sent.push(msg);
                node.error = (error, msg) => errors.push({ error, msg });
            },
            registerType(type, ctor) {
                assert.equal(type, 'get-history-alarms');
                Constructor = ctor;
            }
        },
        settings: { functionGlobalContext: { fuxa: {
            async getHistoryAlarms(...args) { calls.push(args); return query(...args); }
        } } }
    });
    new Constructor(config);
    return { input: msg => handlers.input(msg), calls, sent, errors };
}

describe('Node-RED alarm-history timestamp contract', () => {
    it('converts configured editor dates to milliseconds using local time', async () => {
        const node = createNode({ start: '2026-01-01 00:00:00', end: '2026-01-02 00:00:00' });
        await node.input({});
        assert.deepEqual(node.calls, [[new Date('2026-01-01 00:00:00').getTime(), new Date('2026-01-02 00:00:00').getTime()]]);
    });

    it('preserves explicit ISO offsets', async () => {
        const node = createNode();
        await node.input({ start: '2026-01-01T02:00:00+02:00', end: '2026-01-02T00:00:00Z' });
        assert.deepEqual(node.calls, [[Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 2)]]);
    });

    it('message endpoints override configured dates as documented', async () => {
        const node = createNode({ start: 100, end: 200 });
        await node.input({ start: 300, end: 400 });
        assert.deepEqual(node.calls, [[300, 400]]);
    });

    it('preserves numeric zero endpoints', async () => {
        const node = createNode();
        await node.input({ start: 0, end: 0 });
        assert.deepEqual(node.calls, [[0, 0]]);
    });

    it('interprets numeric strings as milliseconds, not calendar years', async () => {
        const node = createNode();
        await node.input({ start: '0', end: '1767225600000' });
        assert.deepEqual(node.calls, [[0, 1767225600000]]);
    });

    it('samples the default 24-hour window clock once', async () => {
        const original = Date.now;
        let reads = 0;
        Date.now = () => { reads++; return 172800000; };
        try {
            const node = createNode({ start: '', end: '' });
            await node.input({});
            assert.deepEqual(node.calls, [[86400000, 172800000]]);
            assert.equal(reads, 1);
        } finally {
            Date.now = original;
        }
    });

    it('blank/null message endpoints independently fall back to configuration', async () => {
        const node = createNode({ start: 10, end: 20 });
        await node.input({ start: '  ', end: null });
        assert.deepEqual(node.calls, [[10, 20]]);
    });

    it('overrides one endpoint without dropping the other configured endpoint', async () => {
        const node = createNode({ start: 10, end: 20 });
        await node.input({ end: 30 });
        assert.deepEqual(node.calls, [[10, 30]]);
    });

    for (const value of ['not-a-date', NaN, Infinity, false, {}, []]) {
        it(`rejects invalid start ${String(value)} (${typeof value}) before querying history`, async () => {
            const node = createNode();
            const msg = { start: value, end: 100 };
            await node.input(msg);
            assert.equal(node.calls.length, 0);
            assert.equal(node.sent.length, 0);
            assert.equal(node.errors.length, 1);
            assert.match(String(node.errors[0].error), /start.*timestamp/i);
            assert.equal(node.errors[0].msg, msg);
        });
    }

    it('rejects invalid end values before querying history', async () => {
        const node = createNode();
        await node.input({ start: 0, end: 'not-a-date' });
        assert.equal(node.calls.length, 0);
        assert.equal(node.sent.length, 0);
        assert.match(String(node.errors[0].error), /end.*timestamp/i);
    });

    it('rejects reversed ranges before querying history', async () => {
        const node = createNode();
        await node.input({ start: 20, end: 10 });
        assert.equal(node.calls.length, 0);
        assert.equal(node.sent.length, 0);
        assert.match(String(node.errors[0].error), /start.*end/i);
    });

    it('retains the original message, metadata and returned rows', async () => {
        const rows = [{ ontime: 15, text: 'Temperature' }];
        const node = createNode({}, async () => rows);
        const msg = { start: 10, end: 20, topic: 'alarm-window', correlationId: 'request-1' };
        await node.input(msg);
        assert.equal(node.sent[0], msg);
        assert.equal(msg.payload, rows);
        assert.equal(msg.topic, 'alarm-window');
        assert.equal(msg.correlationId, 'request-1');
    });

    it('does not emit a successful message after storage rejects', async () => {
        const error = new Error('history unavailable');
        const node = createNode({}, async () => { throw error; });
        const msg = { start: 10, end: 20 };
        await node.input(msg);
        assert.equal(node.sent.length, 0);
        assert.deepEqual(node.errors, [{ error, msg }]);
    });

    describe('real alarm manager and SQLite history', () => {
        const storage = require('../../runtime/alarms/alarmstorage');
        const alarms = require('../../runtime/alarms');
        let directory;
        let manager;

        beforeEach(async () => {
            directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fuxa-node-red-alarm-range-'));
            const runtime = { settings: { workDir: directory }, devices: {}, events: {}, logger: {
                info() {}, error() {}, warn() {}
            } };
            await storage.init(runtime.settings, runtime.logger);
            manager = alarms.create(runtime);
            await storage.setAlarms([0, 1767225600000, 1767268800000, 1767312000000].map(ontime => ({
                getId: () => `alarm-${ontime}^~^high`, type: 'high', status: 'active',
                ontime, offtime: 0, acktime: 0, userack: '', value: ontime,
                subproperty: { group: 'fixture', text: String(ontime) }
            })));
        });

        afterEach(() => {
            storage.close();
            if (directory) fs.rmSync(directory, { recursive: true, force: true });
        });

        function history(start, end) {
            return manager.getAlarmsHistory({ start, end }, -1);
        }

        it('returns only the requested ISO window from real stored alarms', async () => {
            const node = createNode({}, history);
            await node.input({ start: '2026-01-01T06:00:00Z', end: '2026-01-01T18:00:00Z' });
            assert.equal(node.errors.length, 0);
            assert.deepEqual(node.sent[0].payload.map(row => row.ontime), [1767268800000]);
        });

        it('returns the epoch row without widening a zero-end range to all history', async () => {
            const node = createNode({}, history);
            await node.input({ start: 0, end: 0 });
            assert.equal(node.errors.length, 0);
            assert.deepEqual(node.sent[0].payload.map(row => row.ontime), [0]);
            assert.deepEqual((await storage.getAlarmsHistory(0, 0)).map(row => row.ontime), [0]);
        });

        it('honors numeric-string message overrides through manager and SQLite', async () => {
            const node = createNode({ start: 1767225600000, end: 1767312000000 }, history);
            await node.input({ start: '1767268800000', end: '1767268800000' });
            assert.equal(node.errors.length, 0);
            assert.deepEqual(node.sent[0].payload.map(row => row.ontime), [1767268800000]);
        });

        it('keeps omitted storage endpoints compatible with the full-history default', async () => {
            assert.equal((await storage.getAlarmsHistory()).length, 4);
        });
    });
});
