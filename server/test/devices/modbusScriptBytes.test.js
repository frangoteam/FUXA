'use strict';
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');
const Module = require('node:module');
const sinon = require('sinon');

describe('Modbus write-script byte arrays', function () {
    let sandbox, driver, client, logger, runScript;
    beforeEach(function () {
        sandbox = sinon.createSandbox();
        client = { writeRegister: sandbox.stub().resolves(), writeRegisters: sandbox.stub().resolves() };
        logger = { info() {}, warn() {}, error: sandbox.spy() };
        runScript = sandbox.stub();
        const filename = require.resolve('../../runtime/devices/modbus');
        delete require.cache[filename];
        driver = require(filename);
        const originalLoad = Module._load;
        sandbox.stub(Module, '_load').callsFake(function (request, parent, isMain) {
            if (request === 'modbus-serial' && parent.filename === filename) {
                return function ControlledClient() { return client; };
            }
            return originalLoad.apply(this, arguments);
        });
    });
    afterEach(function () {
        sandbox.restore();
        delete require.cache[require.resolve('../../runtime/devices/modbus')];
    });
    function device(type = 'UInt16', memaddress = '400000') {
        const result = driver.create({ name: 'Script bytes', property: {}, tags: {
            target: { name: 'Target', type, memaddress, address: '8', divisor: 1,
                scaleWriteFunction: 'synthetic-script', scaleWriteParams: JSON.stringify([{ name: 'offset', type: 'value', value: 0 }]) }
        } }, logger, new EventEmitter(), null, { scriptsMgr: { runScript } });
        result.init(driver.ModbusTypes.TCP);
        return result;
    }
    const cases = [
        ['one register', Object.freeze([0x12, 0x34]), 'writeRegister', Buffer.from([0x12, 0x34])],
        ['two registers', Object.freeze([0x12, 0x34, 0xab, 0xcd]), 'writeRegisters', Buffer.from([0x12, 0x34, 0xab, 0xcd])],
        ['three registers', Object.freeze([0, 1, 0, 2, 0, 3]), 'writeRegisters', Buffer.from([0, 1, 0, 2, 0, 3])],
        ['zero register', Object.freeze([0, 0]), 'writeRegister', Buffer.from([0, 0])],
        ['existing short Buffer', Buffer.from([0x12, 0x34]), 'writeRegister', Buffer.from([0x12, 0x34])],
        ['existing long Buffer', Buffer.from([0x12, 0x34, 0xab, 0xcd]), 'writeRegisters', Buffer.from([0x12, 0x34, 0xab, 0xcd])],
        ['existing scalar', 7, 'writeRegister', 7]
    ];
    for (const [name, output, method, expected] of cases) {
        it(`writes ${name} with the expected byte order and function`, async function () {
            const before = Array.isArray(output) ? [...output] : Buffer.isBuffer(output) ? Buffer.from(output) : output;
            runScript.resolves(output);
            assert.equal(await device().setValue('target', 42), true);
            sinon.assert.calledOnceWithExactly(client[method], 7, expected);
            sinon.assert.notCalled(client[method === 'writeRegister' ? 'writeRegisters' : 'writeRegister']);
            sinon.assert.calledOnceWithExactly(runScript, { id: 'synthetic-script', name: null, parameters: [
                { name: 'value', type: 'value', value: 42 }, { name: 'offset', type: 'value', value: 0 }
            ] }, false);
            assert.deepEqual(output, before);
            sinon.assert.notCalled(logger.error);
        });
    }
    it('rejects an odd byte-array length before transport', async function () {
        runScript.resolves([1, 2, 3]);
        assert.equal(await device().setValue('target', 42), false);
        sinon.assert.notCalled(client.writeRegister);
        sinon.assert.notCalled(client.writeRegisters);
        sinon.assert.calledWithMatch(logger.error, 'returned buffer invalid must be mod 2');
    });
    const numberCases = [
        ['UInt32MLE number', 'UInt32MLE', 600000, Buffer.from([0x27, 0xc0, 0x00, 0x09])],
        ['UInt32 number', 'UInt32', 600000, Buffer.from([0x00, 0x09, 0x27, 0xc0])],
        ['Int32LE negative number', 'Int32LE', -2, Buffer.from([0xfe, 0xff, 0xff, 0xff])],
        ['Float32 number', 'Float32', 1.5, Buffer.from([0x3f, 0xc0, 0x00, 0x00])],
        ['Int64 number', 'Int64', 5, Buffer.from([0, 0, 0, 0, 0, 0, 0, 5])],
        ['UInt32MLE numeric string', 'UInt32MLE', ' 600000 ', Buffer.from([0x27, 0xc0, 0x00, 0x09])]
    ];
    for (const [name, type, output, expected] of numberCases) {
        it(`formats a ${name} with the tag type before writing`, async function () {
            runScript.resolves(output);
            assert.equal(await device(type).setValue('target', 42), true);
            sinon.assert.calledOnceWithExactly(client.writeRegisters, 7, expected);
            sinon.assert.notCalled(client.writeRegister);
            sinon.assert.notCalled(logger.error);
        });
    }
    it('keeps a numeric string as a number for a single register', async function () {
        runScript.resolves('7');
        assert.equal(await device().setValue('target', 42), true);
        sinon.assert.calledOnceWithExactly(client.writeRegister, 7, 7);
        sinon.assert.notCalled(logger.error);
    });
    for (const [name, output, text] of [['undefined', undefined, 'undefined'], ['null', null, 'null'], ['NaN', NaN, 'number NaN'],
        ['Infinity', Infinity, 'number Infinity'], ['empty string', '', 'string ""'], ['text', 'abc', 'string "abc"'], ['object', { v: 1 }, 'object']]) {
        it(`rejects a script result of ${name} without a transport write`, async function () {
            runScript.resolves(output);
            assert.equal(await device('UInt32MLE').setValue('target', 42), false);
            sinon.assert.notCalled(client.writeRegister);
            sinon.assert.notCalled(client.writeRegisters);
            sinon.assert.calledOnce(logger.error);
            sinon.assert.calledWithMatch(logger.error, `returned value invalid (${text})`);
        });
    }
    it('passes a coil script result to the coil write', async function () {
        client.writeCoil = sandbox.stub().resolves();
        runScript.resolves(true);
        assert.equal(await device('Bool', '000000').setValue('target', 1), true);
        sinon.assert.calledOnceWithExactly(client.writeCoil, 7, true);
        sinon.assert.notCalled(logger.error);
    });
    it('rejects an undefined coil script result without a transport write', async function () {
        client.writeCoil = sandbox.stub().resolves();
        runScript.resolves(undefined);
        assert.equal(await device('Bool', '000000').setValue('target', 1), false);
        sinon.assert.notCalled(client.writeCoil);
        sinon.assert.calledWithMatch(logger.error, 'returned value invalid (undefined)');
    });
    it('logs an out of range number for the tag type without a transport write', async function () {
        runScript.resolves(-1);
        assert.equal(await device('UInt32MLE').setValue('target', 42), false);
        sinon.assert.notCalled(client.writeRegisters);
        sinon.assert.calledWithMatch(logger.error, 'setValue script error!');
    });
    it('preserves script rejection without a transport write', async function () {
        runScript.rejects(new Error('synthetic script failure'));
        assert.equal(await device().setValue('target', 42), false);
        sinon.assert.notCalled(client.writeRegister);
        sinon.assert.notCalled(client.writeRegisters);
        sinon.assert.calledWithMatch(logger.error, 'synthetic script failure');
    });
});
