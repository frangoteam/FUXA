'use strict';

const assert = require('node:assert/strict');
const EventEmitter = require('node:events');
const Module = require('node:module');
const sinon = require('sinon');
const utils = require('../../runtime/utils');

describe('BACnet object-list discovery', function () {
    let sandbox, client, device;

    beforeEach(async function () {
        sandbox = sinon.createSandbox();
        client = new EventEmitter();
        client.close = sandbox.spy();
        client.whoIs = () => client.emit('iAm', {
            payload: { deviceId: 321 },
            header: { sender: { address: '127.0.0.2' } }
        });
        client.readProperty = sandbox.stub().callsFake((address, object, property, options, callback) => {
            if (typeof options === 'function') {
                callback = options;
                options = undefined;
            }
            if (property === 76) {
                if (!options) {
                    if (client.completeObjectList) {
                        callback(null, { values: client.completeObjectList });
                    } else {
                        callback(new Error('BacnetAbort: segmentation not supported'));
                    }
                } else if (options.arrayIndex === 0) {
                    callback(null, { values: [{ value: 3 }] });
                } else {
                    callback(null, { values: [{ value: {
                        type: options.arrayIndex - 1,
                        instance: 100 + options.arrayIndex
                    } }] });
                }
            } else if (property === 77) {
                callback(null, { values: [{ value: `Object ${object.instance}` }] });
            } else {
                callback(new Error(`unexpected property ${property}`));
            }
        });

        function ControlledBacnet() { return client; }
        ControlledBacnet.enum = {
            ApplicationTag: { NULL: 0, REAL: 4, ENUMERATED: 9, ERROR: 105 },
            ObjectType: {
                ANALOG_INPUT: 0, ANALOG_OUTPUT: 1, ANALOG_VALUE: 2,
                BINARY_INPUT: 3, BINARY_OUTPUT: 4, BINARY_VALUE: 5, DEVICE: 8
            },
            PropertyIdentifier: { OBJECT_LIST: 76, OBJECT_NAME: 77, PRESENT_VALUE: 85 }
        };

        const filename = require.resolve('../../runtime/devices/bacnet');
        delete require.cache[filename];
        const originalLoad = Module._load;
        sandbox.stub(Module, '_load').callsFake(function (request, parent) {
            if (request === 'node-bacnet' && parent.filename === filename) return ControlledBacnet;
            return originalLoad.apply(this, arguments);
        });
        sandbox.stub(utils, 'getNetworkInterfaces').returns(['127.0.0.1']);
        sandbox.stub(console, 'log');
        const driver = require(filename);
        device = driver.create({
            name: 'BACnet discovery',
            property: { address: '127.0.0.1' },
            tags: {}
        }, { info: sandbox.spy(), warn: sandbox.spy(), error: sandbox.spy() }, new EventEmitter());
        await device.connect();
    });

    afterEach(async function () {
        try { if (device) await device.disconnect(); }
        finally {
            sandbox.restore();
            delete require.cache[require.resolve('../../runtime/devices/bacnet')];
        }
    });

    it('falls back to indexed reads when the complete object list exceeds one APDU', async function () {
        const objects = await device.browse({ id: 321 });

        assert.deepEqual(objects, [
            { type: 0, instance: 101, parent: 321, id: '0-101', name: 'Object 101', class: 'Variable' },
            { type: 1, instance: 102, parent: 321, id: '1-102', name: 'Object 102', class: 'Variable' },
            { type: 2, instance: 103, parent: 321, id: '2-103', name: 'Object 103', class: 'Variable' }
        ]);
        assert.deepEqual(
            client.readProperty.getCalls().filter(call => call.args[2] === 76)
                .map(call => call.args[3] && call.args[3].arrayIndex),
            [undefined, 0, 1, 2, 3]
        );
    });

    it('keeps the single-request path when the device returns a complete object list', async function () {
        client.completeObjectList = [
            { value: { type: 8, instance: 321 } },
            { value: { type: 2, instance: 207 } }
        ];

        assert.deepEqual(await device.browse({ id: 321 }), [
            { type: 2, instance: 207, parent: 321, id: '2-207', name: 'Object 207', class: 'Variable' }
        ]);
        assert.deepEqual(
            client.readProperty.getCalls().filter(call => call.args[2] === 76)
                .map(call => call.args[3] && call.args[3].arrayIndex),
            [undefined]
        );
    });
});
