'use strict';

const assert = require('assert').strict;
const EventEmitter = require('events');
const Module = require('module');
const sinon = require('sinon');

describe('Modbus read error diagnostics', () => {
    let client;
    let driver;
    let logger;
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        client = {
            readHoldingRegisters: sandbox.stub()
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

    function createDevice() {
        const data = {
            id: 'modbus-1',
            name: 'Modbus test',
            property: {},
            tags: {
                tag1: {
                    id: 'tag1', name: 'Tag 1', type: 'UInt16',
                    memaddress: '400000', address: '1', divisor: 1
                }
            }
        };
        const device = driver.create(data, logger, new EventEmitter(), null, {});
        device.init(driver.ModbusTypes.TCP);
        device.load(data);
        return device;
    }

    async function pollWith(error) {
        client.readHoldingRegisters.rejects(error);
        await createDevice().polling();
        sinon.assert.calledOnce(logger.error);
        return logger.error.firstCall.args[0];
    }

    it('includes connection metadata from structured transport errors', async () => {
        const message = await pollWith({
            code: 'ECONNREFUSED', syscall: 'connect', address: '127.0.0.1', port: 1502
        });

        assert.match(message, /ECONNREFUSED/);
        assert.match(message, /connect/);
        assert.match(message, /127\.0\.0\.1/);
        assert.match(message, /1502/);
        assert.doesNotMatch(message, /\[object Object\]/);
    });

    it('uses the message carried by a structured Modbus error', async () => {
        const message = await pollWith({ modbusCode: 2, message: 'Illegal data address' });

        assert.match(message, /Illegal data address/);
        assert.match(message, /modbusCode/);
        assert.match(message, /2/);
        assert.doesNotMatch(message, /\[object Object\]/);
    });

    it('preserves ordinary Error diagnostics', async () => {
        const message = await pollWith(new Error('socket closed'));

        assert.match(message, /socket closed/);
    });
});
