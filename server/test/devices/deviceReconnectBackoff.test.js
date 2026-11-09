'use strict';

const assert = require('assert').strict;
const EventEmitter = require('events');
const fs = require('fs');
const Module = require('module');
const path = require('path');

const flush = () => new Promise(resolve => setImmediate(resolve));

describe('Device reconnect backoff', function () {
    let clock;
    let current;
    const realNow = Date.now;

    beforeEach(function () {
        clock = 1000000;
        Date.now = () => clock;
        current = null;
    });

    afterEach(async function () {
        Date.now = realNow;
        if (current) {
            await current.device.stop();
            current = null;
        }
    });

    // Loads the device manager with the S7 driver replaced by a controllable fake,
    // so a connect attempt can fail or succeed on demand without any socket.
    function build() {
        const state = { connects: 0, disconnects: 0, connected: false, lastRead: 0, fail: true };
        const errors = [];
        const warns = [];
        const comm = {
            load() {},
            init() {},
            connect() {
                state.connects++;
                if (state.fail) {
                    return Promise.reject(new Error('no route to host'));
                }
                state.connected = true;
                state.lastRead = Date.now();
                return Promise.resolve(true);
            },
            disconnect() {
                state.disconnects++;
                state.connected = false;
                return Promise.resolve(true);
            },
            isConnected() { return state.connected; },
            polling() {},
            getValue() { return null; },
            getValues() { return {}; },
            getStatus() { return 'connect-ok'; },
            setValue() { return true; },
            lastReadTimestamp() { return state.lastRead; }
        };
        const filename = require.resolve('../../runtime/devices/device');
        const isolated = new Module(filename, module);
        isolated.filename = filename;
        isolated.paths = Module._nodeModulePaths(path.dirname(filename));
        isolated.require = request => request === './s7'
            ? { create: () => comm }
            : Module.prototype.require.call(isolated, request);
        isolated._compile(fs.readFileSync(filename, 'utf8'), filename);
        const Device = isolated.exports;

        const data = {
            id: 'dev-backoff-1', name: 'Backoff', type: Device.DeviceType.S7,
            polling: 100, enabled: true, property: { address: '127.0.0.1' }, tags: {}
        };
        const device = Device.create(data, {
            logger: {
                info() {},
                warn: msg => warns.push(String(msg)),
                error: msg => errors.push(String(msg))
            },
            events: new EventEmitter(),
            plugins: { manager: {} },
            project: { getDeviceProperty() {} },
            settings: { daqEnabled: false }
        });
        device.load(data);
        current = { device, state, errors, warns };
        return current;
    }

    // Runs one checkStatus tick (what the 5s timer does) and lets the promise settle.
    const tick = async f => {
        f.device.checkStatus();
        await flush();
        await flush();
    };

    const advance = async (f, ms) => {
        clock += ms;
        await tick(f);
    };

    it('waits longer between each failed connection attempt', async function () {
        const f = build();
        f.device.start();
        await flush();
        assert.equal(f.state.connects, 1, 'first attempt happens immediately');

        await advance(f, 1000);
        assert.equal(f.state.connects, 1, 'no retry before the 5s backoff');

        await advance(f, 4000);
        assert.equal(f.state.connects, 2, 'retry after 5s');

        await advance(f, 5000);
        assert.equal(f.state.connects, 2, 'the second backoff is 10s, not 5s');

        await advance(f, 5000);
        assert.equal(f.state.connects, 3, 'retry after 10s');
    });

    it('opens the circuit after three failures', async function () {
        const f = build();
        f.device.start();
        await flush();
        await advance(f, 5000);
        await advance(f, 10000);
        assert.equal(f.state.connects, 3, 'three attempts before the circuit opens');
        assert.ok(f.warns.some(w => w.includes('circuit open')), 'circuit open is logged');

        // Both the backoff (20s) and a chunk of the quarantine (60s) still hold.
        await advance(f, 30000);
        assert.equal(f.state.connects, 3, 'no attempt while the circuit is open');

        await advance(f, 35000);
        assert.equal(f.state.connects, 4, 'retry after the quarantine expires');
    });

    it('resets the backoff after a successful connection', async function () {
        const f = build();
        f.device.start();
        await flush();
        await advance(f, 5000);
        assert.equal(f.state.connects, 2, 'second attempt after 5s');

        f.state.fail = false;
        await advance(f, 10000);
        assert.equal(f.state.connects, 3, 'device connects after the 10s backoff');
        assert.equal(f.device.getStatus(), 'connect-ok');

        f.state.fail = true;
        f.state.connected = false;   // the driver reports the link as lost
        await tick(f);               // status goes back to INIT
        await tick(f);
        assert.equal(f.state.connects, 4, 'a failure after a good connection retries immediately');

        await advance(f, 1000);
        assert.equal(f.state.connects, 4, 'and the backoff starts again from 5s');

        await advance(f, 4000);
        assert.equal(f.state.connects, 5, 'retry after 5s');
    });

    it('clears the backoff when the device is stopped', async function () {
        const f = build();
        f.device.start();
        await flush();
        await advance(f, 5000);
        assert.equal(f.state.connects, 2, 'two attempts so far');

        await f.device.stop();
        f.device.start();
        await flush();
        assert.equal(f.state.connects, 3, 'stop() clears the pending backoff');
    });

    it('forces a reconnect when a connected device stops answering', async function () {
        const f = build();
        f.state.fail = false;
        f.device.start();
        await flush();
        assert.equal(f.device.getStatus(), 'connect-ok');

        // The driver keeps the connection flag but every read times out.
        f.state.lastRead = clock - 5000;
        for (let i = 0; i < 3; i++) {
            await tick(f);
        }

        assert.ok(f.warns.some(w => w.includes('reads are stale')), 'stale reads are reported');
        assert.equal(f.state.disconnects, 1, 'the device is disconnected before reconnecting');
    });
});
