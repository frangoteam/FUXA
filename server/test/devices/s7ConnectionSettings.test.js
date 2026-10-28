'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const EventEmitter = require('node:events');

// Exercise the real driver with only the native transport replaced.
function fixture(rack, slot, options = {}) {
    const calls = [];
    const errors = [];
    let connectedReads = 0;
    const native = { S7Client: function () {
        return {
            Connected() { connectedReads++; return false; },
            ConnectTo(address, actualRack, actualSlot, callback) {
                calls.push({ address, rack: actualRack, slot: actualSlot });
                if (options.throwError) throw options.throwError;
                callback(options.callbackError || 0);
            },
        };
    } };
    const filename = require.resolve('../../runtime/devices/s7');
    const isolated = new Module(filename, module);
    isolated.filename = filename;
    isolated.paths = Module._nodeModulePaths(path.dirname(filename));
    isolated.require = request => request === 'node-snap7' ? native : Module.prototype.require.call(isolated, request);
    isolated._compile(fs.readFileSync(filename, 'utf8'), filename);
    const device = isolated.exports.create({
        id: 'synthetic-s7', name: 'Synthetic S7',
        property: { address: '127.0.0.1', rack, slot }, tags: {},
    }, { info() {}, warn() {}, error: value => errors.push(value) }, new EventEmitter());
    return { device, calls, errors, connectedReads: () => connectedReads };
}

describe('S7 rack and slot validation', () => {
    for (const [label, rack, slot, expectedRack, expectedSlot] of [
        ['numeric settings', 0, 2, 0, 2],
        ['CSV strings', '0', '2', 0, 2],
        ['trimmed CSV strings', ' 0 ', ' 2 ', 0, 2],
        ['leading zeroes', '00', '02', 0, 2],
        ['mixed settings', 1, '3', 1, 3],
        ['zero settings', 0, 0, 0, 0],
    ]) {
        it('preserves ' + label + ' as numeric native arguments', async () => {
            const f = fixture(rack, slot);
            await f.device.connect();
            assert.deepEqual(f.calls, [{ address: '127.0.0.1', rack: expectedRack, slot: expectedSlot }]);
            assert.equal(f.device.getStatus(), 'connect-ok');
            assert.deepEqual(f.errors, []);
        });
    }

    const invalid = [
        ['trailing text', '2oops'],
        ['decimal text', '2.5'],
        ['negative fraction', -0.5],
        ['positive fraction', 2.5],
        ['exponent text', '2e1'],
        ['hexadecimal text', '0x10'],
        ['unsafe integer', Number.MAX_SAFE_INTEGER + 1],
        ['array', [2]],
        ['boolean', true],
        ['object', { value: 2 }],
        ['empty text', ''],
        ['whitespace', '   '],
        ['null', null],
        ['missing', undefined],
        ['negative integer', -1],
    ];
    for (const field of ['rack', 'slot']) {
        for (const [label, value] of invalid) {
            it('rejects ' + field + ' ' + label + ' before any native connection attempt', async () => {
                const f = fixture(field === 'rack' ? value : 0, field === 'slot' ? value : 2);
                await assert.rejects(f.device.connect());
                assert.deepEqual(f.calls, []);
                assert.equal(f.connectedReads(), 0);
                assert.equal(f.device.getStatus(), 'connect-failed');
                assert.equal(f.errors.length, 1);
                assert.match(f.errors[0], /missing connection data/);
            });
        }
    }

    it('retains native callback failure handling for valid CSV settings', async () => {
        const f = fixture('0', '2', { callbackError: 123 });
        await assert.rejects(f.device.connect());
        assert.deepEqual(f.calls, [{ address: '127.0.0.1', rack: 0, slot: 2 }]);
        assert.equal(f.device.getStatus(), 'connect-error');
        assert.match(f.errors[0], /connect failed/);
    });

    it('retains native exception handling for valid CSV settings', async () => {
        const f = fixture('0', '2', { throwError: new Error('controlled native failure') });
        await assert.rejects(f.device.connect());
        assert.deepEqual(f.calls, [{ address: '127.0.0.1', rack: 0, slot: 2 }]);
        assert.equal(f.device.getStatus(), 'connect-error');
        assert.match(f.errors[0], /controlled native failure/);
    });
});
