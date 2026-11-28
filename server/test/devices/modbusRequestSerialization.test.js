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
            writeRegister: sandbox.stub().resolves(),
            close: sandbox.stub()
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

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    function createDevice(property = { delay: 0 }, modbusType = driver.ModbusTypes.RTU, tags = null) {
        const data = {
            id: 'modbus-1',
            name: 'Modbus test',
            property: { serializeRequests: true, ...property },
            tags: tags || {
                tag1: {
                    id: 'tag1', name: 'Tag 1', type: 'UInt16',
                    memaddress: '400000', address: '1', divisor: 1
                }
            }
        };
        const device = driver.create(data, logger, new EventEmitter(), null, {});
        device.init(modbusType);
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

    it('recovers from a request that never settles once it is past the stall limit', async () => {
        client.writeRegister.returns(new Promise(() => {}));
        client.readHoldingRegisters.resolves({ data: [7], buffer: Buffer.from([0, 7]) });
        // timeout 50ms -> stalled after 100ms on the wire (wide margin for the ~15ms clock tick on Windows)
        const device = createDevice({ delay: 0, timeout: 50 });

        device.setValue('tag1', 9);
        while (!client.writeRegister.called) {
            await new Promise(resolve => setImmediate(resolve));
        }

        await device.polling();
        sinon.assert.notCalled(client.close);

        await sleep(150);
        await device.polling();
        sinon.assert.calledOnce(client.close);
        sinon.assert.notCalled(client.readHoldingRegisters);

        // the stalled promise still holds the old lock: the next poll must not be blocked by it
        await device.polling();
        sinon.assert.calledOnce(client.readHoldingRegisters);
    });

    it('does not close the client while a slow scan is still progressing', async () => {
        // 3 blocks, each answered in 15ms: the scan lasts far longer than the polling ticks
        // and than the stall limit (2 x 20ms), but no single request is stalled
        client.readHoldingRegisters.callsFake(() => sleep(15).then(() => ({ data: [7], buffer: Buffer.from([0, 7]) })));
        const device = createDevice({ delay: 0, timeout: 20 }, driver.ModbusTypes.RTU, {
            tag1: { id: 'tag1', name: 'Tag 1', type: 'UInt16', memaddress: '400000', address: '1', divisor: 1 },
            tag2: { id: 'tag2', name: 'Tag 2', type: 'UInt16', memaddress: '400000', address: '201', divisor: 1 },
            tag3: { id: 'tag3', name: 'Tag 3', type: 'UInt16', memaddress: '400000', address: '401', divisor: 1 }
        });

        device.polling();
        // timer ticks every 10ms, fired without waiting like the device polling interval
        const ticks = [];
        for (let i = 0; i < 8; i++) {
            await sleep(10);
            ticks.push(device.polling());
        }
        await Promise.all(ticks);

        sinon.assert.notCalled(client.close);
        sinon.assert.notCalled(logger.warn);
    });

    it('fails a write that waits too long for a stuck poll', async () => {
        client.readHoldingRegisters.returns(new Promise(() => {}));
        // 1 block -> lock timeout = (1 + 1) * (5 + 10) = 30ms
        const device = createDevice({ delay: 0, timeout: 5 });

        device.polling();
        await new Promise(resolve => setImmediate(resolve));

        assert.equal(await device.setValue('tag1', 9), false);
        sinon.assert.notCalled(client.writeRegister);
        sinon.assert.calledWithMatch(logger.error, /timeout waiting for the client/);
    });

    describe('serializeRequests option', () => {
        function startPollThenWrite(device) {
            let finishRead;
            client.readHoldingRegisters.returns(new Promise(resolve => {
                finishRead = () => resolve({ data: [7], buffer: Buffer.from([0, 7]) });
            }));
            const poll = device.polling();
            return new Promise(resolve => setImmediate(resolve)).then(() => {
                const write = device.setValue('tag1', 9);
                return new Promise(resolve => setImmediate(resolve)).then(() => ({ poll, write, finishRead }));
            });
        }

        [
            { name: 'RTU', modbusType: 'RTU', property: {} },
            { name: 'TCP', modbusType: 'TCP', property: { connectionOption: 'TcpPort' } }
        ].forEach(({ name, modbusType, property }) => {
            it(`keeps the previous behavior on ${name} when the option is not set`, async () => {
                const device = createDevice({ delay: 0, ...property, serializeRequests: undefined }, driver.ModbusTypes[modbusType]);

                const { poll, write, finishRead } = await startPollThenWrite(device);
                sinon.assert.calledOnce(client.writeRegister);

                finishRead();
                await poll;
                assert.equal(await write, true);
            });

            it(`serializes requests on ${name} when the option is enabled`, async () => {
                const device = createDevice({ delay: 0, ...property }, driver.ModbusTypes[modbusType]);

                const { poll, write, finishRead } = await startPollThenWrite(device);
                sinon.assert.notCalled(client.writeRegister);

                finishRead();
                await poll;
                assert.equal(await write, true);
                sinon.assert.calledOnce(client.writeRegister);
            });
        });

        it('does not apply the stall recovery when the option is not set', async () => {
            client.readHoldingRegisters.returns(new Promise(() => {}));
            const device = createDevice({ delay: 0, timeout: 50, serializeRequests: undefined });

            device.polling();
            await sleep(150);
            await device.polling();

            sinon.assert.notCalled(client.close);
            sinon.assert.neverCalledWithMatch(logger.warn, /request stalled/);
        });
    });
});
