'use strict';

const assert = require('assert').strict;
const EventEmitter = require('events');
const Module = require('module');
const sinon = require('sinon');
const { Mutex } = require('async-mutex');

describe('Modbus write results', () => {
    let driver;
    let client;
    let logger;
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        client = {
            writeCoil: sandbox.stub().resolves(),
            writeRegister: sandbox.stub().resolves(),
            writeRegisters: sandbox.stub().resolves()
        };
        logger = { info: sandbox.spy(), warn: sandbox.spy(), error: sandbox.spy() };
        sandbox.stub(console, 'error');
        delete require.cache[require.resolve('../../runtime/devices/modbus')];
        driver = require('../../runtime/devices/modbus');

        const originalLoad = Module._load;
        sandbox.stub(Module, '_load').callsFake(function (request, parent, isMain) {
            if (request === 'modbus-serial' && parent.filename === require.resolve('../../runtime/devices/modbus')) {
                return function MockModbusClient() { return client; };
            }
            return originalLoad.apply(this, arguments);
        });
    });

    afterEach(() => {
        sandbox.restore();
        delete require.cache[require.resolve('../../runtime/devices/modbus')];
    });

    function createDevice(tag = {}, property = {}, runtime = {}) {
        const device = driver.create({
            name: 'Modbus test',
            property,
            tags: {
                tag1: Object.assign({
                    name: 'Tag 1', type: 'UInt16', memaddress: '400000', address: '1', divisor: 1
                }, tag)
            }
        }, logger, new EventEmitter(), null, runtime);
        device.init(driver.ModbusTypes.TCP);
        return device;
    }

    const writes = [
        { name: 'coil', method: 'writeCoil', tag: { type: 'Bool', memaddress: '0' } },
        { name: 'single register', method: 'writeRegister', tag: {} },
        { name: 'multiple registers', method: 'writeRegisters', tag: { type: 'UInt32' } },
        { name: 'forced FC16', method: 'writeRegisters', tag: {}, property: { forceFC16: true } }
    ];

    for (const write of writes) {
        describe(write.name, () => {
            it('returns true when the transport write succeeds', async () => {
                const device = createDevice(write.tag, write.property);

                assert.equal(await device.setValue('tag1', 1), true);
                sinon.assert.calledOnce(client[write.method]);
                sinon.assert.notCalled(logger.error);
            });

            it('returns false when the transport write rejects', async () => {
                const device = createDevice(write.tag, write.property);
                client[write.method].rejects(new Error('write rejected'));

                assert.equal(await device.setValue('tag1', 1), false);
                sinon.assert.calledOnce(client[write.method]);
                sinon.assert.calledWithMatch(logger.error, 'write rejected');
                sinon.assert.notCalled(logger.info);
            });

            it('returns false when the transport write throws', async () => {
                const device = createDevice(write.tag, write.property);
                client[write.method].throws(new Error('write threw'));

                assert.equal(await device.setValue('tag1', 1), false);
                sinon.assert.calledOnce(client[write.method]);
                sinon.assert.calledWithMatch(logger.error, 'write threw');
                sinon.assert.notCalled(logger.info);
            });
        });
    }

    it('waits for the transport outcome before resolving', async () => {
        let rejectWrite;
        client.writeRegister.returns(new Promise((resolve, reject) => { rejectWrite = reject; }));
        const device = createDevice();
        let settled = false;
        const write = device.setValue('tag1', 1).then(result => { settled = true; return result; });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(settled, false);

        rejectWrite(new Error('delayed failure'));
        assert.equal(await write, false);
    });

    it('returns false for an unknown tag without sending a write', async () => {
        assert.equal(await createDevice().setValue('missing', 1), false);
        sinon.assert.notCalled(client.writeCoil);
        sinon.assert.notCalled(client.writeRegister);
        sinon.assert.notCalled(client.writeRegisters);
    });

    it('returns false when the memory area does not support writes', async () => {
        const device = createDevice({ memaddress: '300000' });

        assert.equal(await device.setValue('tag1', 1), false);
        sinon.assert.notCalled(client.writeRegister);
        sinon.assert.notCalled(client.writeRegisters);
    });

    it('releases a shared socket mutex after failure so another write can succeed', async () => {
        const mutex = new Mutex();
        const device = createDevice({}, { address: 'test-socket', socketReuse: 'ReuseSerial' }, {
            socketMutex: new Map([['test-socket', mutex]])
        });
        client.writeRegister.onFirstCall().rejects(new Error('first write failed'));

        assert.equal(await device.setValue('tag1', 1), false);
        assert.equal(mutex.isLocked(), false);
        assert.equal(await device.setValue('tag1', 2), true);
        assert.equal(mutex.isLocked(), false);
        sinon.assert.calledTwice(client.writeRegister);
    });

    it('returns false when acquiring the shared socket mutex fails', async () => {
        const device = createDevice({}, { address: 'test-socket', socketReuse: 'ReuseSerial' }, {
            socketMutex: new Map([['test-socket', {
                acquire: sandbox.stub().rejects(new Error('mutex unavailable'))
            }]])
        });

        assert.equal(await device.setValue('tag1', 1), false);
        sinon.assert.notCalled(client.writeRegister);
        sinon.assert.calledWithMatch(logger.error, 'mutex unavailable');
    });
});
