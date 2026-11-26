'use strict';

const assert = require('assert');
const EventEmitter = require('events');
const Module = require('module');

describe('MQTT incoming payload size limit', function () {
    it('accepts payloads at the limit and ignores larger payloads', async function () {
        const mqttClient = new EventEmitter();
        mqttClient.connected = true;
        mqttClient.subscribe = (topics, callback) => callback(null);
        mqttClient.end = (force, callback) => callback && callback();

        const originalLoad = Module._load;
        Module._load = function (request) {
            if (request === 'mqtt') {
                return { connect: () => mqttClient };
            }
            return originalLoad.apply(this, arguments);
        };

        let device;
        try {
            const mqttModulePath = require.resolve('../../runtime/devices/mqtt');
            delete require.cache[mqttModulePath];
            const mqttModule = require(mqttModulePath);
            const tag = { id: 'temperature', address: 'plant/temperature', rawValue: null };
            device = mqttModule.create({
                id: 'mqtt-device', name: 'MQTT device', property: { address: 'mqtt://localhost' },
                tags: { temperature: tag }
            }, { info() {}, warn() {}, error() {} }, new EventEmitter(), {});

            const connecting = device.connect();
            mqttClient.emit('connect');
            await connecting;

            const maxPayloadSize = 2 * 1024 * 1024;
            const acceptedPayload = Buffer.alloc(maxPayloadSize, 0x61);
            mqttClient.emit('message', 'plant/temperature', acceptedPayload);
            assert.strictEqual(tag.rawValue.length, maxPayloadSize);
            assert.strictEqual(tag.rawValue[0], 'a');

            mqttClient.emit('message', 'plant/temperature', Buffer.alloc(maxPayloadSize + 1, 0x62));
            assert.strictEqual(tag.rawValue.length, maxPayloadSize);
            assert.strictEqual(tag.rawValue[0], 'a');
        } finally {
            Module._load = originalLoad;
            if (device) {
                await device.disconnect();
            }
            delete require.cache[require.resolve('../../runtime/devices/mqtt')];
        }
    });
});
