'use strict';

const assert = require('assert');
const EventEmitter = require('events');
const Module = require('module');
const Device = require('../../runtime/devices/device');

describe('device lifecycle', function () {
    it('does not start polling when a pending connection completes after stop', async function () {
        let resolveConnect;
        let disconnectCount = 0;
        let pollingCount = 0;
        const comm = {
            connect: () => new Promise(resolve => { resolveConnect = resolve; }),
            disconnect: async () => { disconnectCount++; },
            isConnected: () => false,
            polling: () => { pollingCount++; },
            load() {},
            getStatus: () => 'connect-off',
            getValues: () => ({}),
            getValue: () => null,
            getTagProperty: () => null,
            lastReadTimestamp: () => 0,
            bindAddDaq() {}
        };
        const originalPluginPath = require.resolve('../../runtime/devices/genericethernetip');
        const originalLoad = Module._load;
        Module._load = function (request) {
            if (request === 'fake-generic-enip-plugin') {
                return { create: () => comm };
            }
            return originalLoad.apply(this, arguments);
        };
        try {
            Device.loadPlugin(Device.DeviceType.GenericEthernetIP, 'fake-generic-enip-plugin');
        } finally {
            Module._load = originalLoad;
        }

        const runtime = {
            logger: { info() {}, warn() {}, error() {} },
            events: new EventEmitter(),
            plugins: { manager: {} },
            project: { getDeviceProperty() {} },
            settings: { daqEnabled: false }
        };
        const device = Device.create({
            id: 'device-lifecycle', name: 'PLC', type: Device.DeviceType.GenericEthernetIP,
            enabled: true, polling: 10, property: {}, tags: {}
        }, runtime);

        try {
            device.start();
            assert.strictEqual(typeof resolveConnect, 'function');
            await device.stop();
            resolveConnect();
            await new Promise(resolve => setTimeout(resolve, 30));

            assert.strictEqual(pollingCount, 0);
            assert.strictEqual(disconnectCount, 2);
        } finally {
            Device.loadPlugin(Device.DeviceType.GenericEthernetIP, originalPluginPath);
        }
    });
});
