'use strict';

const assert = require('assert');
const EventEmitter = require('events');
const Module = require('module');
const path = require('path');

function createDevice(currentValue) {
    const writes = [];
    const comm = {
        load() {},
        getValue: id => ({ id, value: currentValue, ts: 1234 }),
        setValue: async (id, value) => {
            writes.push({ id, value });
            return true;
        }
    };
    const filename = require.resolve('../../runtime/devices/device');
    const isolated = new Module(filename, module);
    isolated.filename = filename;
    isolated.paths = Module._nodeModulePaths(path.dirname(filename));
    isolated.require = request => request === './genericethernetip'
        ? { create: () => comm }
        : Module.prototype.require.call(isolated, request);
    isolated._compile(require('fs').readFileSync(filename, 'utf8'), filename);

    const Device = isolated.exports;
    const runtime = {
        logger: { info() {}, warn() {}, error() {} },
        events: new EventEmitter(),
        plugins: { manager: {} },
        project: { getDeviceProperty() {} },
        settings: { daqEnabled: false }
    };
    const device = Device.create({
        id: 'relative-write',
        name: 'Relative Write',
        type: Device.DeviceType.GenericEthernetIP,
        enabled: true,
        property: {},
        tags: {}
    }, runtime);
    return { device, writes };
}

describe('device relative writes', function () {
    it('adds to the current server-side value instead of trusting stale client state', async function () {
        const { device, writes } = createDevice(10);

        await device.setValue('speed', 103, ['add', '3']);

        assert.deepStrictEqual(writes, [{ id: 'speed', value: 13 }]);
    });

    it('subtracts from the current server-side value instead of trusting stale client state', async function () {
        const { device, writes } = createDevice(10);

        await device.setValue('speed', 96, ['remove', '4']);

        assert.deepStrictEqual(writes, [{ id: 'speed', value: 6 }]);
    });

    it('preserves direct writes when no relative action is requested', async function () {
        const { device, writes } = createDevice(10);

        await device.setValue('speed', 42);

        assert.deepStrictEqual(writes, [{ id: 'speed', value: 42 }]);
    });
});
