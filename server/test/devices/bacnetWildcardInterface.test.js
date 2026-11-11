'use strict';

const assert = require('assert').strict;
const EventEmitter = require('events');
const sinon = require('sinon');

const utils = require('../../runtime/utils');

describe('BACnet wildcard interface', () => {
    let sandbox;
    let MockBacnet;
    let logger;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(utils, 'getNetworkInterfaces').returns(['127.0.0.1', '192.168.1.20']);
        sandbox.stub(console, 'log');
        logger = { info: sandbox.spy(), warn: sandbox.spy(), error: sandbox.spy() };

        MockBacnet = class extends EventEmitter {
            constructor(settings) {
                super();
                this.settings = settings;
                this.close = sandbox.spy();
                MockBacnet.instances.push(this);
            }

            whoIs() {
                setImmediate(() => this.emit('iAm', {
                    payload: { deviceId: 7, maxApdu: 1476, segmentation: 0, vendorId: 1 },
                    header: { sender: { address: '192.168.1.30' } }
                }));
            }
        };
        MockBacnet.instances = [];
    });

    afterEach(() => {
        sandbox.restore();
        delete require.cache[require.resolve('../../runtime/devices/bacnet')];
    });

    function createDevice(address) {
        delete require.cache[require.resolve('../../runtime/devices/bacnet')];
        const driver = require('../../runtime/devices/bacnet');
        const property = {};
        if (address !== undefined) property.address = address;
        const data = { id: 'bacnet-1', name: 'BACnet', property, tags: {} };
        const manager = { require: sandbox.stub().withArgs('node-bacnet').returns(MockBacnet) };
        return driver.create(data, logger, new EventEmitter(), manager, {});
    }

    for (const address of [undefined, '0.0.0.0']) {
        it(`connects through the wildcard interface when address is ${String(address)}`, async () => {
            const device = createDevice(address);

            await device.connect();

            assert.equal(MockBacnet.instances.length, 1);
            assert.equal(MockBacnet.instances[0].settings.interface, '0.0.0.0');
            assert.equal(MockBacnet.instances[0].settings.port, 47808);
            assert.equal(device.isConnected(), true);
        });
    }

    it('continues to accept an available explicit interface and port', async () => {
        const device = createDevice('192.168.1.20:47809');

        await device.connect();

        assert.equal(MockBacnet.instances.length, 1);
        assert.equal(MockBacnet.instances[0].settings.interface, '192.168.1.20');
        assert.equal(MockBacnet.instances[0].settings.port, 47809);
    });

    it('rejects an unavailable explicit interface before opening the BACnet client', async () => {
        const device = createDevice('192.0.2.10');

        await assert.rejects(device.connect());

        assert.equal(MockBacnet.instances.length, 0);
        sinon.assert.calledWithMatch(logger.error, "selected interface don't exist");
    });
});
