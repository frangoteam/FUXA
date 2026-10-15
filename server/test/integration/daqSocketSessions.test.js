'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const vm = require('node:vm');
const EventEmitter = require('node:events');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Events = require('../../runtime/events');
const utils = require('../../runtime/utils');

const SIX_HOURS = 6 * 60 * 60 * 1000;
const SECRET = 'daq-session-fixture-only';

function waitForEvent(client, event, predicate = () => true) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            client.off(event, handler);
            reject(new Error(`Timed out waiting for ${event}`));
        }, 3000);
        function handler(message) {
            if (!predicate(message)) return;
            clearTimeout(timer);
            client.off(event, handler);
            resolve(message);
        }
        client.on(event, handler);
    });
}

// Use the browser client shipped by socket.io, with the existing ws dependency
// providing WebSocket in Node. This exercises real framing and network delivery
// without adding a client package or requiring a browser installation.
function loadBrowserClient() {
    const context = {
        WebSocket: require('ws'), setTimeout, clearTimeout, setInterval, clearInterval
    };
    const source = path.join(path.dirname(require.resolve('socket.io')), '../client-dist/socket.io.js');
    vm.runInNewContext(fs.readFileSync(source, 'utf8'), context, { filename: source });
    return context.io;
}

function registerRuntime(io, getNodeValues) {
    const init = () => Promise.resolve();
    const dependencies = {
        bluebird: require('bluebird'), './events': Events, './utils': utils,
        path, jsonwebtoken: jwt, './localization': { init },
        './storage/daqstorage': { init, getNodeValues }
    };
    for (const name of ['devices', 'project', 'users', 'apikeys', 'plugins',
        'scheduler/scheduler-storage', 'scheduler/scheduler-service',
        'recipes/recipe-storage', 'recipes/recipe-service']) {
        dependencies[`./${name}`] = { init };
    }
    for (const name of ['alarms', 'notificator', 'scripts', 'jobs']) {
        dependencies[`./${name}`] = { create: () => ({}) };
    }
    const filename = path.join(__dirname, '../../runtime/index.js');
    const context = {
        module: { exports: {} }, console, setInterval() {},
        require(name) {
            assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
            return dependencies[name];
        }
    };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
    context.module.exports.init(io, { authJwt: { secretCode: SECRET } },
        { secureEnabled: true }, { info() {}, warn() {}, error() {} }, new EventEmitter());
}

describe('DAQ history over real Socket.IO sessions', () => {
    let io;
    let clients;
    let calls;
    let a;
    let b;

    async function start(getNodeValues) {
        calls = [];
        const server = http.createServer();
        io = new Server(server, { serveClient: false, transports: ['websocket'] });
        registerRuntime(io, (...args) => {
            calls.push(args);
            return getNodeValues(...args);
        });
        io.on('connection', socket => {
            // Acknowledgements provide an ordering barrier on each connection:
            // assert absence only after earlier outbound packets have arrived.
            socket.on('fixture:barrier', acknowledge => acknowledge());
        });
        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', resolve);
        });
        const connect = loadBrowserClient();
        async function session(id) {
            const client = connect(`http://127.0.0.1:${server.address().port}`, {
                transports: ['websocket'], reconnection: false, forceNew: true,
                autoConnect: false, timeout: 3000,
                query: { token: jwt.sign({ id, groups: 1 }, SECRET, { expiresIn: '1m' }) }
            });
            clients.push(client);
            client.messages = [];
            for (const event of ['daq-result', 'daq-error']) {
                client.on(event, payload => client.messages.push({
                    event, payload: JSON.parse(JSON.stringify(payload))
                }));
            }
            await new Promise((resolve, reject) => {
                client.once('connect', resolve);
                client.once('connect_error', reject);
                client.connect();
            });
            assert.equal(client.io.engine.transport.name, 'websocket');
            return client;
        }
        a = await session('operator-a');
        b = await session('operator-b');
    }

    function barrier(client) {
        return client.timeout(3000).emitWithAck('fixture:barrier');
    }

    function query(overrides = {}) {
        return { gid: 'shared-chart', sids: ['tag-a'], from: 1000, to: 2000, ...overrides };
    }

    beforeEach(() => { clients = []; });
    afterEach(async () => {
        clients.forEach(client => client.close());
        if (io) await new Promise(resolve => io.close(resolve));
        io = null;
    });

    for (const chunked of [false, true]) {
        it(`delivers ${chunked ? 'chunked' : 'single'} results only to the requesting authenticated session`, async () => {
            await start(async (sid, from, to) => [{ sid, from, to }]);
            const end = chunked ? 1000 + SIX_HOURS + 100 : 2000;
            const expectedChunks = chunked ? 2 : 1;
            const complete = waitForEvent(a, 'daq-result', value => value.chunk.index === expectedChunks);
            a.emit('daq-query', query({ sids: ['tag-b', 'tag-a'], to: end, chunked }));
            await complete;
            await barrier(b);

            assert.deepEqual(b.messages, []);
            assert.equal(a.messages.length, expectedChunks);
            for (let i = 0; i < expectedChunks; i++) {
                const from = i ? 1000 + SIX_HOURS : 1000;
                const to = chunked && i === 0 ? 1000 + SIX_HOURS : end;
                assert.deepEqual(a.messages[i], { event: 'daq-result', payload: {
                    gid: 'shared-chart', result: [
                        [{ sid: 'tag-b', from, to }], [{ sid: 'tag-a', from, to }]
                    ], chunk: { index: i + 1, of: expectedChunks }
                } });
            }
        });
    }

    it('isolates concurrent requests with identical chart IDs completed in reverse order', async () => {
        const pending = new Map();
        await start((sid, from) => new Promise(resolve => pending.set(from, resolve)));
        a.emit('daq-query', query());
        b.emit('daq-query', query({ from: 3000, to: 4000 }));
        await Promise.all([barrier(a), barrier(b)]);
        assert.equal(calls.length, 2);
        const bComplete = waitForEvent(b, 'daq-result');
        pending.get(3000)(['range-b']);
        await bComplete;
        await barrier(a);
        assert.deepEqual(a.messages, []);

        const aComplete = waitForEvent(a, 'daq-result');
        pending.get(1000)(['range-a']);
        await aComplete;
        await barrier(b);
        assert.equal(a.messages.length, 1);
        assert.equal(b.messages.length, 1);
        assert.deepEqual(a.messages[0].payload.result, [['range-a']]);
        assert.deepEqual(b.messages[0].payload.result, [['range-b']]);
    });

    for (const synchronous of [false, true]) {
        it(`scopes ${synchronous ? 'synchronous' : 'later-chunk asynchronous'} errors and stops subsequent chunks`, async () => {
            const failure = { message: 'fixture storage unavailable' };
            await start((sid, from) => {
                if (synchronous) throw failure;
                return from === 1000 ? Promise.resolve(['first-chunk']) : Promise.reject(failure);
            });
            const complete = waitForEvent(a, 'daq-error');
            a.emit('daq-query', query({ to: 1000 + SIX_HOURS * 3, chunked: true }));
            await complete;
            await barrier(b);

            assert.deepEqual(b.messages, []);
            assert.deepEqual(a.messages.at(-1), { event: 'daq-error', payload: {
                gid: 'shared-chart', error: failure
            } });
            assert.equal(calls.length, synchronous ? 1 : 2);
            assert.equal(a.messages.length, synchronous ? 1 : 2);
            if (!synchronous) assert.equal(a.messages[0].event, 'daq-result');
        });
    }
});
