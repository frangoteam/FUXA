'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const EventEmitter = require('node:events');
const Events = require('../../runtime/events');
const utils = require('../../runtime/utils');

const SIX_HOURS = 6 * 60 * 60 * 1000;
const flushQueries = () => new Promise(resolve => setImmediate(resolve));

// Execute the actual runtime and register its handlers, without starting devices,
// storage, scheduled jobs or heartbeat timers. Model io.emit as a broadcast so
// a response sent to the wrong Socket.IO API is visible to every test client.
function createRuntime(getNodeValues) {
    const sockets = [];
    const calls = [];
    let onConnection;
    const io = {
        on(event, handler) {
            assert.equal(event, 'connection');
            onConnection = handler;
        },
        emit(event, payload) {
            sockets.forEach(socket => socket.emit(event, payload));
        }
    };
    const dependencies = {
        bluebird: Promise,
        './events': Events,
        './utils': utils,
        path,
        jsonwebtoken: { verify: token => ({ id: token, groups: 1 }) },
        './localization': { init() {} },
        './storage/daqstorage': {
            init() {},
            getNodeValues(...args) {
                calls.push(args);
                return getNodeValues(...args);
            }
        }
    };
    for (const name of ['devices', 'project', 'users', 'apikeys', 'plugins',
        'scheduler/scheduler-storage', 'scheduler/scheduler-service',
        'recipes/recipe-storage', 'recipes/recipe-service']) {
        dependencies[`./${name}`] = { init: () => Promise.resolve() };
    }
    for (const name of ['alarms', 'notificator', 'scripts', 'jobs']) {
        dependencies[`./${name}`] = { create: () => ({}) };
    }
    const filename = path.join(__dirname, '../../runtime/index.js');
    const context = {
        module: { exports: {} },
        require(name) {
            assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
            return dependencies[name];
        },
        console,
        setInterval() {}
    };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
    context.module.exports.init(io, { authJwt: {} }, { secureEnabled: true },
        { info() {}, warn() {}, error() {} }, new EventEmitter());

    return {
        calls,
        async connect(id) {
            const handlers = new Map();
            const socket = {
                id,
                handshake: { query: { token: id } },
                received: [],
                on: (event, handler) => handlers.set(event, handler),
                emit(event, payload) {
                    // Normalize VM-realm objects as they would be on the wire.
                    this.received.push({ event, payload: JSON.parse(JSON.stringify(payload)) });
                },
                query: message => handlers.get(Events.IoEventTypes.DAQ_QUERY)(message)
            };
            sockets.push(socket);
            await onConnection(socket);
            assert.equal(socket.isAuthenticated, true);
            return socket;
        }
    };
}

function query(overrides = {}) {
    return { gid: 'shared-chart', sids: ['tag-a'], from: 1000, to: 2000, ...overrides };
}

describe('DAQ query response scoping', () => {
    it('delivers a history result only to the requesting session', async () => {
        const runtime = createRuntime(async () => [{ dt: 1500, value: 42 }]);
        const requester = await runtime.connect('operator-a');
        const idle = await runtime.connect('operator-b');

        requester.query(query());
        await flushQueries();

        assert.deepEqual(requester.received, [{ event: 'daq-result', payload: {
            gid: 'shared-chart', result: [[{ dt: 1500, value: 42 }]], chunk: { index: 1, of: 1 }
        } }]);
        assert.deepEqual(idle.received, []);
        assert.deepEqual(runtime.calls, [['tag-a', 1000, 2000]]);
    });

    it('keeps every history chunk private and preserves tag order and metadata', async () => {
        const runtime = createRuntime(async (sid, from, to) => [{ sid, from, to }]);
        const requester = await runtime.connect('operator-a');
        const idle = await runtime.connect('operator-b');
        const end = 1000 + SIX_HOURS + 100;

        requester.query(query({ sids: ['tag-b', 'tag-a'], to: end, chunked: true }));
        await flushQueries();

        assert.deepEqual(requester.received.map(message => message.payload), [
            { gid: 'shared-chart', result: [
                [{ sid: 'tag-b', from: 1000, to: 1000 + SIX_HOURS }],
                [{ sid: 'tag-a', from: 1000, to: 1000 + SIX_HOURS }]
            ], chunk: { index: 1, of: 2 } },
            { gid: 'shared-chart', result: [
                [{ sid: 'tag-b', from: 1000 + SIX_HOURS, to: end }],
                [{ sid: 'tag-a', from: 1000 + SIX_HOURS, to: end }]
            ], chunk: { index: 2, of: 2 } }
        ]);
        assert.deepEqual(idle.received, []);
    });

    it('isolates overlapping requests with the same chart ID finishing out of order', async () => {
        const pending = new Map();
        const runtime = createRuntime((sid, from) => new Promise(resolve => pending.set(from, resolve)));
        const a = await runtime.connect('operator-a');
        const b = await runtime.connect('operator-b');

        a.query(query());
        b.query(query({ from: 3000, to: 4000 }));
        pending.get(3000)(['range-b']);
        await flushQueries();
        assert.deepEqual(a.received, []);
        assert.equal(b.received.length, 1);
        pending.get(1000)(['range-a']);
        await flushQueries();

        assert.equal(a.received.length, 1);
        assert.equal(b.received.length, 1);
        assert.deepEqual(a.received[0].payload.result, [['range-a']]);
        assert.deepEqual(b.received[0].payload.result, [['range-b']]);
    });

    for (const synchronous of [false, true]) {
        it(`scopes a ${synchronous ? 'synchronous storage throw' : 'rejected storage query'} error to its requester`, async () => {
            const failure = { message: 'storage unavailable' };
            const runtime = createRuntime(() => {
                if (synchronous) throw failure;
                return Promise.reject(failure);
            });
            const requester = await runtime.connect('operator-a');
            const idle = await runtime.connect('operator-b');

            requester.query(query({ to: 1000 + SIX_HOURS * 2, chunked: true }));
            await flushQueries();

            assert.deepEqual(requester.received, [{ event: 'daq-error', payload: {
                gid: 'shared-chart', error: failure
            } }]);
            assert.deepEqual(idle.received, []);
            assert.equal(runtime.calls.length, 1, 'do not query later chunks after failure');
        });
    }

    it('ignores an incomplete query without querying storage or emitting responses', async () => {
        const runtime = createRuntime(async () => []);
        const requester = await runtime.connect('operator-a');
        const idle = await runtime.connect('operator-b');
        requester.query(query({ sids: [] }));
        await flushQueries();
        assert.deepEqual(runtime.calls, []);
        assert.deepEqual(requester.received, []);
        assert.deepEqual(idle.received, []);
    });
});
