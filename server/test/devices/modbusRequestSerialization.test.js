'use strict';

const assert = require('assert').strict;
const EventEmitter = require('events');
const Module = require('module');
const sinon = require('sinon');

describe('Modbus request serialization', () => {
    let client;
    let driver;
    let logger;
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        client = {
            readHoldingRegisters: sandbox.stub(),
            writeRegister: sandbox.stub().resolves()
        };
        logger = { info: sandbox.spy(), warn: sandbox.spy(), error: sandbox.spy() };
        sandbox.stub(console, 'error');

        delete require.cache[require.resolve('../../runtime/devices/modbus')];
        const originalLoad = Module._load;
        sandbox.stub(Module, '_load').callsFake(function (request, parent, isMain) {
            if (request === 'modbus-serial' && parent.filename === require.resolve('../../runtime/devices/modbus')) {
                return function MockModbusClient() { return client; };
            }
            return originalLoad.apply(this, arguments);
        });
        driver = require('../../runtime/devices/modbus');
    });

    afterEach(() => {
        sandbox.restore();
        delete require.cache[require.resolve('../../runtime/devices/modbus')];
    });

    function createDevice() {
        const data = {
            id: 'modbus-1',
            name: 'Modbus test',
            property: { delay: 0 },
            tags: {
                tag1: {
                    id: 'tag1', name: 'Tag 1', type: 'UInt16',
                    memaddress: '400000', address: '1', divisor: 1
                }
            }
        };
        const device = driver.create(data, logger, new EventEmitter(), null, {});
        device.init(driver.ModbusTypes.RTU);
        device.load(data);
        return device;
    }

    it('waits for an active poll before sending a serial write', async () => {
        let finishRead;
        client.readHoldingRegisters.returns(new Promise(resolve => {
            finishRead = () => resolve({ data: [7], buffer: Buffer.from([0, 7]) });
        }));
        const device = createDevice();

        const poll = device.polling();
        await new Promise(resolve => setImmediate(resolve));
        const write = device.setValue('tag1', 9);
        await new Promise(resolve => setImmediate(resolve));

        sinon.assert.calledOnce(client.readHoldingRegisters);
        sinon.assert.notCalled(client.writeRegister);

        finishRead();
        await poll;
        assert.equal(await write, true);
        sinon.assert.calledOnceWithExactly(client.writeRegister, 0, Buffer.from([0, 9]));
    });

    it('does not queue timer polls behind an active serial write', async () => {
        let finishWrite;
        client.writeRegister.returns(new Promise(resolve => { finishWrite = resolve; }));
        client.readHoldingRegisters.resolves({ data: [7], buffer: Buffer.from([0, 7]) });
        const device = createDevice();

        const write = device.setValue('tag1', 9);
        await new Promise(resolve => setImmediate(resolve));
        await device.polling();

        sinon.assert.notCalled(client.readHoldingRegisters);
        finishWrite();
        assert.equal(await write, true);

        await device.polling();
        sinon.assert.calledOnce(client.readHoldingRegisters);
    });

    it('releases the client after a failed poll so a write can proceed', async () => {
        client.readHoldingRegisters.rejects(new Error('read failed'));
        const device = createDevice();

        await device.polling();

        assert.equal(await device.setValue('tag1', 9), true);
        sinon.assert.calledOnce(client.writeRegister);
    });

    it('releases the client after a failed write so polling can resume', async () => {
        client.writeRegister.rejects(new Error('write failed'));
        client.readHoldingRegisters.resolves({ data: [7], buffer: Buffer.from([0, 7]) });
        const device = createDevice();

        assert.equal(await device.setValue('tag1', 9), false);
        await device.polling();

        sinon.assert.calledOnce(client.readHoldingRegisters);
    });
});
