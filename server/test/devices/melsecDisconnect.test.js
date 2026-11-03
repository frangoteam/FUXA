'use strict';

const assert = require('assert');
const EventEmitter = require('events');
const Module = require('module');

describe('melsec disconnect during connect', function () {
    let melsec;
    let pending;
    let instances;
    let originalLoad;

    before(function () {
        // mcprotocol never calls the connect callback after dropConnection() while the TCP connect is in progress
        pending = [];
        instances = [];
        function FakeMcProtocol() { }
        FakeMcProtocol.prototype.initiateConnection = function (params, callback) {
            this.isoclient = new EventEmitter();
            this.isoclient.on('error', () => { });
            instances.push(this);
            pending.push(callback);
        };
        FakeMcProtocol.prototype.setTranslationCB = function () { };
        FakeMcProtocol.prototype.addItems = function () { };
        FakeMcProtocol.prototype.dropConnection = function () {
            // like mcprotocol connectionCleanup(): socket keeps connecting without an 'error' listener
            this.isoclient.removeAllListeners('error');
        };
        originalLoad = Module._load;
        Module._load = function (request) {
            if (request === 'mcprotocol') {
                return FakeMcProtocol;
            }
            return originalLoad.apply(this, arguments);
        };
        delete require.cache[require.resolve('../../runtime/devices/melsec')];
        melsec = require('../../runtime/devices/melsec');
    });

    after(function () {
        Module._load = originalLoad;
        delete require.cache[require.resolve('../../runtime/devices/melsec')];
    });

    function createClient() {
        const logger = { info() { }, warn() { }, error() { } };
        return melsec.create({ id: 'plc', name: 'PLC', property: { address: '192.168.0.1:1025' }, tags: {} }, logger, new EventEmitter(), null, {});
    }

    function settled(promise, ms) {
        return Promise.race([
            promise.then(() => 'resolved', () => 'rejected'),
            new Promise((resolve) => setTimeout(() => resolve('pending'), ms))
        ]);
    }

    it('rejects a pending connect when disconnected', async function () {
        const client = createClient();
        const connecting = client.connect();
        await client.disconnect();
        assert.strictEqual(await settled(connecting, 200), 'rejected');
        assert.strictEqual(client.isConnected(), false);
    });

    it('ignores a late callback of the aborted connection', async function () {
        const client = createClient();
        const connecting = client.connect();
        const lateCallback = pending[pending.length - 1];
        await client.disconnect();
        await settled(connecting, 200);
        lateCallback();
        assert.strictEqual(client.isConnected(), false);
    });

    it('does not throw on a late socket error of the dropped connection', async function () {
        const client = createClient();
        const connecting = client.connect();
        await client.disconnect();
        await settled(connecting, 200);
        const socket = instances[instances.length - 1].isoclient;
        assert.doesNotThrow(() => socket.emit('error', new Error('connect ETIMEDOUT')));
    });

    it('can connect again after an aborted connect', async function () {
        const client = createClient();
        const first = client.connect();
        await client.disconnect();
        await settled(first, 200);
        const second = client.connect();
        pending[pending.length - 1]();
        assert.strictEqual(await settled(second, 200), 'resolved');
        assert.strictEqual(client.isConnected(), true);
    });
});
