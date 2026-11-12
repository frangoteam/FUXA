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

const SECRET = 'device-tags-subscribe-fixture';
const TAG = 't1';

function waitForEvent(client, event, predicate = () => true, timeout = 3000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            client.off(event, handler);
            reject(new Error(`Timed out waiting for ${event}`));
        }, timeout);
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

function registerRuntime(io, log) {
    const init = () => Promise.resolve();
    const dependencies = {
        bluebird: require('bluebird'), './events': Events, './utils': utils,
        path, jsonwebtoken: jwt, './localization': { init },
        './storage/daqstorage': { init, getNodeValues: () => Promise.resolve([]) }
    };
    dependencies['./devices'] = { init, getDevicesValues: () => ({}) };
    for (const name of ['project', 'users', 'apikeys', 'plugins',
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
    context.module.exports.init(io, {
        authJwt: {
            secretCode: SECRET,
            getGuestToken: () => jwt.sign({ id: 'guest', groups: 0 }, SECRET, { expiresIn: '1m' })
        }
    }, { secureEnabled: true, broadcastAll: false }, log, new EventEmitter());
    return context.module.exports;
}

describe('device-tags-subscribe payload validation', () => {
    let httpServer;
    let io;
    let runtime;
    let connect;
    let clients;
    let errors;

    before(async () => {
        clients = [];
        errors = [];
        const logger = {
            info() { },
            warn() { },
            error(message) { errors.push(String(message)); }
        };
        httpServer = http.createServer();
        io = new Server(httpServer, { serveClient: false, transports: ['websocket'] });
        runtime = registerRuntime(io, logger);
        // Acknowledgement barrier: assert absence only after the server has
        // processed every packet this client sent before it.
        io.on('connection', socket => socket.on('fixture:barrier', acknowledge => acknowledge()));
        await new Promise((resolve, reject) => {
            httpServer.once('error', reject);
            httpServer.listen(0, '127.0.0.1', resolve);
        });
        connect = loadBrowserClient();
    });

    after(async () => {
        clients.forEach(client => client.close());
        io.close();
        await new Promise(resolve => httpServer.close(resolve));
    });

    beforeEach(() => {
        errors.length = 0;
    });

    function session(token) {
        const url = `http://127.0.0.1:${httpServer.address().port}`;
        const client = connect(url, {
            transports: ['websocket'], reconnection: false, forceNew: true,
            autoConnect: false, timeout: 3000,
            query: token ? { token } : {}
        });
        clients.push(client);
        return new Promise((resolve, reject) => {
            client.once('connect', () => resolve(client));
            client.once('connect_error', reject);
            client.connect();
        });
    }

    function operatorToken(id = 'operator') {
        return jwt.sign({ id, groups: 1 }, SECRET, { expiresIn: '1m' });
    }

    function barrier(client) {
        return new Promise(resolve => client.emit('fixture:barrier', resolve));
    }

    function nextValues(client) {
        return waitForEvent(client, Events.IoEventTypes.DEVICE_VALUES, message =>
            Array.isArray(message && message.values) && message.values.some(value => value.id === TAG)
        );
    }

    function emitValue() {
        runtime.events.emit('device-value:changed', {
            id: 'dev-1',
            values: { [TAG]: { id: TAG, value: 1, timestamp: Date.now(), quality: 'good' } }
        });
    }

    it('keeps broadcasting when a socket subscribes with tagsId: null', async () => {
        const bad = await session(null);                        // guest, no token
        const observer = await session(operatorToken());

        observer.emit('device-tags-subscribe', { tagsId: [TAG] });
        await barrier(observer);
        bad.emit('device-tags-subscribe', { tagsId: null });
        await barrier(bad);

        const received = nextValues(observer);
        emitValue();
        const message = await received;

        assert.deepEqual(Array.from(message.values, value => value.id), [TAG]);
        assert.deepEqual(errors, []);
        bad.close();
    });

    it('keeps emitting tag-value:changed after a malformed subscription', async () => {
        const bad = await session(null);
        const observer = await session(operatorToken());

        observer.emit('device-tags-subscribe', { tagsId: [TAG] });
        await barrier(observer);
        bad.emit('device-tags-subscribe', { tagsId: null });
        await barrier(bad);

        runtime.events.emit('tag-change:subscription', TAG);
        const changed = new Promise(resolve => runtime.events.once('tag-value:changed', resolve));
        emitValue();
        const value = await changed;

        assert.equal(value.id, TAG);
        assert.deepEqual(errors, []);
        bad.close();
    });

    it('ignores a subscribe message without a payload', async () => {
        const bad = await session(null);
        const observer = await session(operatorToken());

        observer.emit('device-tags-subscribe', { tagsId: [TAG] });
        await barrier(observer);
        bad.emit('device-tags-subscribe');
        await barrier(bad);

        assert.deepEqual(errors, []);

        const received = nextValues(observer);
        emitValue();
        const message = await received;
        assert.deepEqual(Array.from(message.values, value => value.id), [TAG]);
        bad.close();
    });
});

