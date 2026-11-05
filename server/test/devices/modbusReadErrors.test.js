'use strict';

const assert = require('assert').strict;
const EventEmitter = require('events');
const Module = require('module');
const sinon = require('sinon');

const datatypes = require('../../runtime/devices/modbus/datatypes');

describe('Modbus read results', () => {
    let driver;
    let client;
    let logger;
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        client = {
            readCoils: sandbox.stub().resolves({ data: true, buffer: Buffer.alloc(2) }),
            readDiscreteInputs: sandbox.stub().resolves({ data: true, buffer: Buffer.alloc(2) }),
            readInputRegisters: sandbox.stub().resolves({ data: true, buffer: Buffer.alloc(2) }),
            readHoldingRegisters: sandbox.stub().resolves({ data: true, buffer: Buffer.alloc(2) })
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

    function createDevice(read) {
        const config = {
            id: `modbus-${read.name}`,
            name: `Modbus ${read.name}`,
            property: { delay: 1 },
            tags: {
                tag1: {
                    name: 'Tag 1',
                    type: read.type,
                    memaddress: read.memory,
                    address: '1',
                    divisor: 1
                }
            }
        };
        const device = driver.create(config, logger, new EventEmitter(), null, {});
        device.init(driver.ModbusTypes.TCP);
        device.load(config);
        return device;
    }

    function pollWithin(device, timeout = 250) {
        let timer;
        return Promise.race([
            device._polling(),
            new Promise((resolve, reject) => {
                timer = setTimeout(() => reject(new Error('poll did not settle')), timeout);
            })
        ]).finally(() => clearTimeout(timer));
    }

    const reads = [
        { name: 'coils', method: 'readCoils', memory: '000000', type: 'Bool' },
        { name: 'discrete inputs', method: 'readDiscreteInputs', memory: '100000', type: 'Bool' },
        { name: 'input registers', method: 'readInputRegisters', memory: '300000', type: 'UInt16' },
        { name: 'holding registers', method: 'readHoldingRegisters', memory: '400000', type: 'UInt16' }
    ];

    for (const read of reads) {
        describe(read.name, () => {
            it('completes a successful read', async () => {
                const device = createDevice(read);

                await pollWithin(device);

                sinon.assert.calledOnce(client[read.method]);
                assert.equal(typeof device.lastReadTimestamp(), 'number');
                sinon.assert.notCalled(logger.error);
            });

            it('releases polling after a transport rejection', async () => {
                const device = createDevice(read);
                client[read.method].onFirstCall().rejects(new Error('transport failed'));

                await pollWithin(device);
                await pollWithin(device);

                sinon.assert.calledTwice(client[read.method]);
                sinon.assert.calledWithMatch(logger.error, '_readMemory error! Error: transport failed');
            });

            it('releases polling after a parser exception', async () => {
                const device = createDevice(read);
                const parser = sandbox.stub(datatypes[read.type], 'parser').throws(new Error('parse failed'));

                await pollWithin(device);
                parser.restore();
                await pollWithin(device);

                sinon.assert.calledTwice(client[read.method]);
                sinon.assert.calledWithMatch(logger.error, '_readMemory error! Error: parse failed');
            });
        });
    }

    it('preserves fields from structured transport errors in the log', async () => {
        const device = createDevice(reads[2]);
        client.readInputRegisters.returns(Promise.reject({
            code: 'ECONNREFUSED',
            address: '127.0.0.1',
            port: 65000
        }));

        await pollWithin(device);

        sinon.assert.calledWithMatch(logger.error,
            '_readMemory error! {"code":"ECONNREFUSED","address":"127.0.0.1","port":65000}');
        assert.equal(logger.error.args.some(([message]) => String(message).includes('[object Object]')), false);
    });
});
