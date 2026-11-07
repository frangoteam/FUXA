'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const EventEmitter = require('node:events');

describe('S7 negotiated PDU reads', () => {
    function fixture(pdu, count = 41, options = {}) {
        const filename = require.resolve('../../runtime/devices/s7');
        const isolated = new Module(filename, module);
        isolated.filename = filename;
        isolated.paths = Module._nodeModulePaths(path.dirname(filename));
        const batches = [];
        const errors = [];
        let inFlight = 0;
        let peak = 0;
        const native = { S7Client: function () {
            const client = {
                S7WLBit: 1, S7WLByte: 2, S7WLWord: 4, S7WLDWord: 6, S7WLReal: 8,
                S7AreaDB: 0x84, S7AreaMK: 0x83, S7AreaPA: 0x82,
                Connected: () => true, ErrorText: code => `controlled error ${code}`,
                PDULength: () => pdu,
                ReadMultiVars(items, callback) {
                    batches.push(items.slice());
                    inFlight++;
                    peak = Math.max(peak, inFlight);
                    setImmediate(() => {
                        inFlight--;
                        if (options.fail) return callback(123);
                        const size = 12 + 12 * items.length;
                        if (size > (pdu || 240)) return callback(0x00700000);
                        callback(0, items.map(item => {
                            const buffer = Buffer.alloc(item.type === 'BOOL' ? 1 : 2);
                            if (item.type === 'BOOL') buffer[0] = 1;
                            else buffer.writeInt16BE(item.Start);
                            return { Result: 0, Data: buffer };
                        }));
                    });
                },
                DBRead(db, start, size, callback) {
                    inFlight++;
                    peak = Math.max(peak, inFlight);
                    setImmediate(() => { inFlight--; callback(options.failDb ? 123 : 0, Buffer.alloc(size)); });
                }
            };
            if (options.noPduMethod) delete client.PDULength;
            return client;
        } };
        isolated.require = request => {
            if (request === 'node-snap7') return native;
            if (request === '../device-utils') return { tagValueCompose: async value => value, tagDaqToSave: () => false };
            return Module.prototype.require.call(isolated, request);
        };
        isolated._compile(fs.readFileSync(filename, 'utf8'), filename);
        const tags = Object.fromEntries(Array.from({ length: count }, (_, i) => [`t${i}`,
            { id: `t${i}`, name: `Tag ${i}`, type: options.bits ? 'Bool' : 'Int',
                address: options.bits ? `Q${i}.0` : `QW${i * 2}` }]));
        if (options.db) tags.db = { id: 'db', name: 'DB', type: 'Int', address: 'DB1.DBW0' };
        const data = { id: 'plc', name: 'PLC', property: { address: '127.0.0.1', rack: 0, slot: 1 }, tags };
        const device = isolated.exports.create(data, { info() {}, warn() {}, error: error => errors.push(error) }, new EventEmitter());
        device.load(data);
        return { device, batches, errors, peak: () => peak };
    }

    for (const pdu of [240, 480, 960]) {
        it(`reads every output once with PDU ${pdu} without exceeding it`, async () => {
            const f = fixture(pdu);
            await f.device.polling();
            assert.deepEqual(f.errors, []);
            assert.equal(f.device.getStatus(), 'connect-ok');
            assert.equal(f.batches.flat().length, 41);
            assert.equal(new Set(f.batches.flat().map(item => item.id)).size, 41);
            assert.ok(f.batches.every(batch => batch.length <= 20 && 12 + 12 * batch.length <= pdu));
            for (let i = 0; i < 41; i++) assert.equal(f.device.getValue(`t${i}`).value, i * 2);
            assert.equal(f.peak(), 1);
        });
    }

    for (const [label, options] of [['unavailable method', { noPduMethod: true }], ['false PDU', {}]]) {
        it(`uses a conservative PDU with ${label}`, async () => {
            const f = fixture(false, 20, options);
            await f.device.polling();
            assert.deepEqual(f.errors, []);
            assert.deepEqual(f.batches.map(batch => batch.length), [19, 1]);
        });
    }

    it('preserves output bit values across PDU batches', async () => {
        const f = fixture(240, 21, { bits: true });
        await f.device.polling();
        assert.deepEqual(f.errors, []);
        for (let i = 0; i < 21; i++) assert.equal(f.device.getValue(`t${i}`).value, 1);
    });

    it('serializes DB reads and mixed-variable batches on the native client', async () => {
        const f = fixture(240, 21, { db: true });
        await f.device.polling();
        assert.deepEqual(f.errors, []);
        assert.equal(f.peak(), 1);
        assert.equal(f.device.getValue('db').value, 0);
    });

    for (const [label, options] of [['multi-variable', { fail: true }], ['DB', { db: true, failDb: true }]]) {
        it(`reports a ${label} read error and releases polling for retry`, async () => {
            const f = fixture(240, 21, options);
            await f.device.polling();
            assert.equal(f.device.getStatus(), 'connect-error');
            assert.equal(f.device.lastReadTimestamp(), undefined);
            const errorCount = f.errors.length;
            await f.device.polling();
            assert.ok(f.errors.length > errorCount);
        });
    }
});
