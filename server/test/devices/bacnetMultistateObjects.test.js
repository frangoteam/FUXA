'use strict';

const assert = require('assert').strict;
const EventEmitter = require('events');
const sinon = require('sinon');

const utils = require('../../runtime/utils');

describe('BACnet multi-state objects', () => {
    const ObjectType = {
        ANALOG_OUTPUT: 1,
        BINARY_OUTPUT: 4,
        DEVICE: 8,
        MULTI_STATE_INPUT: 13,
        MULTI_STATE_OUTPUT: 14,
        MULTI_STATE_VALUE: 19,
        CALENDAR: 6
    };
    const PropertyIdentifier = {
        OBJECT_LIST: 76,
        OBJECT_NAME: 77,
        PRESENT_VALUE: 85
    };
    const ApplicationTag = {
        NULL: 0,
        REAL: 4,
        ENUMERATED: 9,
        ERROR: 12
    };

    let sandbox;
    let MockBacnet;
    let writes;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(utils, 'getNetworkInterfaces').returns(['127.0.0.1']);
        sandbox.stub(console, 'log');
        writes = [];

        MockBacnet = class extends EventEmitter {
            constructor() {
                super();
                this.close = sandbox.spy();
            }

            whoIs() {
                setImmediate(() => this.emit('iAm', {
                    payload: { deviceId: 7, maxApdu: 1476, segmentation: 0, vendorId: 1 },
                    header: { sender: { address: '192.168.1.30' } }
                }));
            }

            readProperty(address, object, property, callback) {
                if (property === PropertyIdentifier.OBJECT_LIST) {
                    callback(null, { values: [
                        { value: { type: ObjectType.MULTI_STATE_INPUT, instance: 1 } },
                        { value: { type: ObjectType.MULTI_STATE_OUTPUT, instance: 2 } },
                        { value: { type: ObjectType.MULTI_STATE_VALUE, instance: 3 } },
                        { value: { type: ObjectType.CALENDAR, instance: 4 } }
                    ] });
                    return;
                }
                assert.equal(property, PropertyIdentifier.OBJECT_NAME);
                callback(null, { values: [{ value: `Point ${object.type}` }] });
            }

            writeProperty(address, object, property, values, options, callback) {
                writes.push({ address, object: { ...object }, property, values, options });
                callback(null, true);
            }
        };
        MockBacnet.enum = { ObjectType, PropertyIdentifier, ApplicationTag };
    });

    afterEach(() => {
        sandbox.restore();
        delete require.cache[require.resolve('../../runtime/devices/bacnet')];
    });

    function createDevice(tags = {}) {
        delete require.cache[require.resolve('../../runtime/devices/bacnet')];
        const driver = require('../../runtime/devices/bacnet');
        const data = {
            id: 'bacnet-1',
            name: 'BACnet',
            property: { address: '127.0.0.1' },
            tags
        };
        const logger = { info: sandbox.spy(), warn: sandbox.spy(), error: sandbox.spy() };
        const manager = { require: sandbox.stub().withArgs('node-bacnet').returns(MockBacnet) };
        return driver.create(data, logger, new EventEmitter(), manager, {});
    }

    it('discovers every multi-state object as a selectable variable', async () => {
        const device = createDevice();
        await device.connect();

        const objects = await device.browse({ id: 7 });

        assert.deepEqual(objects.map(object => ({
            id: object.id,
            class: object.class,
            name: object.name
        })), [
            { id: '13-1', class: 'Variable', name: 'Point 13' },
            { id: '14-2', class: 'Variable', name: 'Point 14' },
            { id: '19-3', class: 'Variable', name: 'Point 19' }
        ]);
    });

    for (const [name, type, expectedTag] of [
        ['multi-state output', ObjectType.MULTI_STATE_OUTPUT, ApplicationTag.ENUMERATED],
        ['multi-state value', ObjectType.MULTI_STATE_VALUE, ApplicationTag.ENUMERATED],
        ['analog output', ObjectType.ANALOG_OUTPUT, ApplicationTag.REAL],
        ['binary output', ObjectType.BINARY_OUTPUT, ApplicationTag.ENUMERATED]
    ]) {
        it(`encodes ${name} writes with the BACnet application tag`, async () => {
            const device = createDevice({
                tag: { id: 'tag', memaddress: '7', address: `${type}-1`, type: 'number' }
            });
            await device.connect();

            assert.equal(await device.setValue('tag', '2'), true);
            await new Promise(resolve => setImmediate(resolve));

            assert.equal(writes.length, 1);
            assert.equal(writes[0].property, PropertyIdentifier.PRESENT_VALUE);
            assert.deepEqual(writes[0].values, [{ type: expectedTag, value: 2 }]);
        });
    }
});
