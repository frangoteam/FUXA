'use strict';

const assert = require('assert').strict;
const EventEmitter = require('events');
const sinon = require('sinon');

describe('BACnet disconnect', () => {
    let sandbox;
    let MockBacnet;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(console, 'log');

        MockBacnet = class extends EventEmitter {
            constructor(settings) {
                super();
                this.settings = settings;
                this.close = sandbox.spy();
            }

            whoIs() {
                setImmediate(() => this.emit('iAm', {
                    payload: { deviceId: 7, maxApdu: 1476, segmentation: 0, vendorId: 1 },
                    header: { sender: { address: '192.168.1.30' } }
                }));
            }
        };
    });

    afterEach(() => {
        sandbox.restore();
        delete require.cache[require.resolve('../../runtime/devices/bacnet')];
    });

    it('reports connect-off and clears the values', async () => {
        delete require.cache[require.resolve('../../runtime/devices/bacnet')];
        const driver = require('../../runtime/devices/bacnet');
        const events = new EventEmitter();
        const logger = { info: sandbox.spy(), warn: sandbox.spy(), error: sandbox.spy() };
        const manager = { require: sandbox.stub().withArgs('node-bacnet').returns(MockBacnet) };
        const device = driver.create({ id: 'bacnet-1', name: 'BACnet', property: {}, tags: {} }, logger, events, manager, {});
        await device.connect();

        const statuses = [];
        let valueEvents = 0;
        events.on('device-status:changed', (event) => statuses.push(event.status));
        events.on('device-value:changed', () => valueEvents++);

        await device.disconnect();

        assert.deepEqual(statuses, ['connect-off']);
        assert.equal(device.getStatus(), 'connect-off');
        assert.equal(valueEvents, 1);
        assert.equal(device.isConnected(), false);
    });
});
