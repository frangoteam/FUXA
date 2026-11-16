'use strict';

const assert = require('assert').strict;
const EventEmitter = require('events');
const fs = require('fs');
const Module = require('module');

// Snap7 separates TCP (low 16 bits), ISO (next 4) and client/S7 errors.
const ISO_SEND_ERROR = 0x00090000;
const CLIENT_ITEM_ERROR = 0x00900000;
const flush = () => new Promise(resolve => setImmediate(resolve));

describe('S7 read connection recovery', function () {
    function fixture(tags = { tag: { id: 'tag', name: 'Tag', type: 'Int', address: 'MW0' } }) {
        const clients = [];
        const logger = { info() {}, warn() {}, error() {} };
        const filename = require.resolve('../../runtime/devices/s7');
        const isolated = new Module(filename, module);
        isolated.filename = filename;
        isolated.paths = Module._nodeModulePaths(require('path').dirname(filename));
        const native = {
            S7Client: function () {
                const client = {
                    S7WLBit: 1, S7WLByte: 2, S7WLWord: 4, S7WLDWord: 6, S7WLReal: 8,
                    S7AreaDB: 0x84, S7AreaMK: 0x83,
                    connected: false, connects: 0, disconnects: 0, reads: 0, value: 17,
                    Connected() { return this.connected; },
                    ConnectTo(_host, _rack, _slot, callback) { this.connects++; this.connected = true; callback(0); },
                    Disconnect() { this.disconnects++; this.connected = false; },
                    ErrorText(code) { return `controlled Snap7 error ${code}`; },
                    DBRead(_db, _offset, length, callback) {
                        this.reads++;
                        if (this.dbRead) return this.dbRead(callback);
                        const buffer = Buffer.alloc(length); buffer.writeInt16BE(this.value); callback(0, buffer);
                    },
                    ReadMultiVars(items, callback) {
                        this.reads++;
                        if (this.multiRead) return this.multiRead(callback, items);
                        callback(0, items.map(() => { const buffer = Buffer.alloc(2); buffer.writeInt16BE(this.value); return { Result: 0, Data: buffer }; }));
                    }
                };
                clients.push(client);
                return client;
            }
        };
        isolated.require = request => request === 'node-snap7' ? native : Module.prototype.require.call(isolated, request);
        isolated._compile(fs.readFileSync(filename, 'utf8'), filename);
        const driver = isolated.exports;
        const events = new EventEmitter();
        const values = [];
        events.on('device-value:changed', event => values.push(JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(event.values))))));
        const data = { id: 's7-1', name: 'PLC', type: 'S7', polling: -1, enabled: true,
            property: { address: '127.0.0.1', rack: 0, slot: 1 }, tags };
        const create = () => { const device = driver.create(data, logger, events); device.load(data); return device; };
        const device = create();
        return { device, client: clients[0], clients, create, driver, data, logger, events, values };
    }

    for (const [kind, address] of [['db', 'DB1.DBW0'], ['multi', 'MW0']]) {
        for (const [label, code] of [['TCP', 104], ['ISO', ISO_SEND_ERROR], ['combined', CLIENT_ITEM_ERROR | 104]]) {
            it(`disconnects and clears ${kind} values after a ${label} read error, then reads after reconnect`, async function () {
                const f = fixture({ tag: { id: 'tag', name: 'Tag', type: 'Int', address } });
                await f.device.connect(); await f.device.polling();
                assert.equal(f.device.getValue('tag').value, 17);
                const timestamp = f.device.lastReadTimestamp();
                f.client[kind + 'Read'] = callback => callback(code);
                await f.device.polling();
                assert.equal(f.client.disconnects, 1);
                assert.equal(f.device.isConnected(), false);
                assert.equal(f.device.getStatus(), 'connect-error');
                assert.equal(f.device.getValue('tag').value, null);
                assert.equal(f.values.at(-1).tag.value, null);
                assert.equal(f.device.lastReadTimestamp(), timestamp);
                delete f.client[kind + 'Read']; f.client.value = 29;
                await f.device.connect(); await f.device.polling();
                assert.equal(f.client.connects, 2);
                assert.equal(f.device.getStatus(), 'connect-ok');
                assert.equal(f.device.getValue('tag').value, 29);
            });
        }
        it(`keeps the connection for a ${kind} client/configuration read error`, async function () {
            const f = fixture({ tag: { id: 'tag', name: 'Tag', type: 'Int', address } });
            await f.device.connect(); await f.device.polling();
            f.client[kind + 'Read'] = callback => callback(CLIENT_ITEM_ERROR);
            await f.device.polling();
            assert.equal(f.client.disconnects, 0);
            assert.equal(f.device.isConnected(), true);
        });
    }

    it('keeps per-item S7 errors separate from transport failures', async function () {
        const f = fixture(); await f.device.connect(); await f.device.polling();
        f.client.multiRead = callback => callback(0, [{ Result: CLIENT_ITEM_ERROR }]);
        await f.device.polling();
        assert.equal(f.client.disconnects, 0);
        assert.equal(f.device.isConnected(), true);
    });

    it('does not coerce non-numeric adapter errors into transport codes', async function () {
        const f = fixture(); await f.device.connect(); await f.device.polling();
        f.client.multiRead = callback => callback('104');
        await f.device.polling();
        assert.equal(f.client.disconnects, 0);
        assert.equal(f.device.isConnected(), true);
    });

    it('still clears values and releases the poll when native disconnect throws', async function () {
        const f = fixture(); await f.device.connect(); await f.device.polling();
        f.client.multiRead = callback => callback(104);
        f.client.Disconnect = function () { this.disconnects++; throw new Error('controlled disconnect failure'); };
        await f.device.polling();
        assert.equal(f.client.disconnects, 1);
        assert.equal(f.device.getValue('tag').value, null);
        assert.equal(f.device.getStatus(), 'connect-error');
        await f.device.polling();
        assert.equal(f.client.disconnects, 2, 'the working flag is released even if disconnect fails');
    });

    for (const first of ['db', 'multi']) {
        it(`waits for outstanding reads before clearing values after an early ${first} transport error`, async function () {
            const f = fixture({ db: { id: 'db', name: 'DB', type: 'Int', address: 'DB1.DBW0' },
                marker: { id: 'marker', name: 'Marker', type: 'Int', address: 'MW0' } });
            await f.device.connect(); await f.device.polling();
            let finish;
            f.client[first + 'Read'] = callback => callback(ISO_SEND_ERROR);
            f.client[(first === 'db' ? 'multi' : 'db') + 'Read'] = callback => { finish = callback; };
            const pending = f.device.polling(); await flush();
            assert.equal(f.client.disconnects, 0, 'native reads must settle before disconnect');
            const reads = f.client.reads;
            await f.device.polling();
            assert.equal(f.client.reads, reads, 'a second poll must not overlap outstanding native reads');
            const data = Buffer.from([0, 42]);
            finish(0, first === 'db' ? [{ Result: 0, Data: data }] : data);
            await pending;
            assert.equal(f.client.disconnects, 1);
            assert.equal(f.device.getValue('db').value, null);
            assert.equal(f.device.getValue('marker').value, null);
            assert.equal(f.device.getStatus(), 'connect-error');
        });
    }

    it('notices a later transport error even if another chunk failed with a client error first', async function () {
        const tags = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`t${i}`, { id: `t${i}`, name: `Tag ${i}`, type: 'Int', address: `MW${i * 2}` }]));
        const f = fixture(tags); await f.device.connect(); await f.device.polling();
        let finish;
        f.client.multiRead = (callback, items) => items.length === 20 ? callback(CLIENT_ITEM_ERROR) : (finish = callback);
        const pending = f.device.polling(); await flush();
        finish(ISO_SEND_ERROR); await pending;
        assert.equal(f.client.disconnects, 1);
        assert.ok(Object.values(f.device.getValues()).every(tag => tag.value === null));
    });

    it('does not disconnect another S7 device sharing the same driver module', async function () {
        const f = fixture(); const other = f.create();
        await f.device.connect(); await other.connect();
        await f.device.polling(); await other.polling();
        f.client.multiRead = callback => callback(104); await f.device.polling();
        assert.equal(f.client.disconnects, 1);
        assert.equal(f.clients[1].disconnects, 0);
        assert.equal(other.isConnected(), true);
        assert.equal(other.getValue('tag').value, 17);
    });

    it('lets the actual device state machine reconnect after transport loss', async function () {
        const f = fixture();
        const filename = require.resolve('../../runtime/devices/device');
        const isolated = new Module(filename, module); isolated.filename = filename;
        isolated.paths = Module._nodeModulePaths(require('path').dirname(filename));
        isolated.require = request => request === './s7' ? { create: () => f.device } : Module.prototype.require.call(isolated, request);
        isolated._compile(fs.readFileSync(filename, 'utf8'), filename);
        const Device = isolated.exports;
        const data = { ...f.data, type: Device.DeviceType.S7 };
        const device = Device.create(data, { logger: f.logger, events: f.events, plugins: { manager: {} },
            project: { getDeviceProperty() {} }, settings: { daqEnabled: false } });
        try {
            device.load(data); device.start(); await flush();
            await f.device.polling();
            f.client.multiRead = callback => callback(104); await f.device.polling();
            device.checkStatus(); device.checkStatus(); await flush();
            assert.equal(f.client.connects, 2);
            delete f.client.multiRead; f.client.value = 31; await f.device.polling();
            assert.equal(f.device.getValue('tag').value, 31);
        } finally { await device.stop(); }
    });
});
