'use strict';

const assert = require('assert').strict;
const EventEmitter = require('events');
const Module = require('module');
const sinon = require('sinon');

// node-snap7 constants, as the real library defines them.
const S7WLBit = 0x01;
const S7WLByte = 0x02;
const S7WLWord = 0x04;
const S7WLDWord = 0x06;
const S7WLReal = 0x08;
const S7AreaDB = 0x84;

describe('S7 write values', () => {
    let driver;
    let client;
    let logger;
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        client = {
            S7WLBit, S7WLByte, S7WLWord, S7WLDWord, S7WLReal, S7AreaDB,
            WriteMultiVars: sandbox.stub().callsFake((items, callback) => {
                callback(null, items.map(() => ({ Result: 0 })));
            }),
            ErrorText: sandbox.stub().returns('error')
        };
        logger = { info: sandbox.spy(), warn: sandbox.spy(), error: sandbox.spy() };
        delete require.cache[require.resolve('../../runtime/devices/s7')];

        const originalLoad = Module._load;
        sandbox.stub(Module, '_load').callsFake(function (request, parent, isMain) {
            if (request === 'node-snap7' && parent.filename === require.resolve('../../runtime/devices/s7')) {
                return { S7Client: function MockS7Client() { return client; } };
            }
            return originalLoad.apply(this, arguments);
        });
        driver = require('../../runtime/devices/s7');
    });

    afterEach(() => {
        sandbox.restore();
        delete require.cache[require.resolve('../../runtime/devices/s7')];
    });

    function createDevice(tag) {
        return driver.create({
            name: 'S7 test',
            property: { address: '127.0.0.1', port: 102, rack: 0, slot: 1 },
            tags: { tag1: Object.assign({ id: 'tag1', name: 'Tag 1' }, tag) }
        }, logger, new EventEmitter(), null, undefined);
    }

    async function writtenItem(tag, value) {
        const device = createDevice(tag);
        assert.equal(await device.setValue('tag1', value), true);
        sinon.assert.calledOnce(client.WriteMultiVars);
        return client.WriteMultiVars.firstCall.args[0][0];
    }

    describe('write completion', () => {
        const tag = { type: 'Int', address: 'DB4.DBW2' };
        for (const failure of [false, true]) {
            it(`waits for a delayed ${failure ? 'failed' : 'successful'} callback`, async () => {
                client.WriteMultiVars.resetBehavior();
                const device = createDevice(tag);
                const pending = device.setValue('tag1', 42);
                let settled = false;
                pending.then(() => { settled = true; }, () => { settled = true; });
                await new Promise(setImmediate);
                sinon.assert.calledOnce(client.WriteMultiVars);
                const callback = client.WriteMultiVars.firstCall.args[1];
                try {
                    assert.equal(settled, false, 'write must remain pending until its callback');
                    sinon.assert.notCalled(logger.info);
                    sinon.assert.notCalled(logger.error);
                } finally {
                    callback(failure ? 7 : null, [{ Result: 0 }]);
                }
                assert.equal(await pending, !failure);
                if (failure) sinon.assert.calledWithMatch(logger.error, '_writeVars error!');
                else sinon.assert.calledWithMatch(logger.info, 'setValue(tag1, 42)');
            });
        }
        for (const kind of ['transport', 'item', 'throw']) {
            it(`returns false for a ${kind} error and allows a later successful write`, async () => {
                if (kind === 'throw') client.WriteMultiVars.throws(new Error('controlled write error'));
                else client.WriteMultiVars.callsFake((items, cb) => cb(kind === 'transport' ? 7 : null,
                    [{ Result: kind === 'item' ? 9 : 0 }]));
                const device = createDevice(tag);
                assert.equal(await device.setValue('tag1', 42), false);
                sinon.assert.calledWithMatch(logger.error, '_writeVars error!');
                sinon.assert.notCalled(logger.info);
                client.WriteMultiVars.callsFake((items, cb) => cb(null, [{ Result: 0 }]));
                assert.equal(await device.setValue('tag1', 43), true);
            });
        }
        it('returns false for an unknown tag without writing', async () => {
            assert.equal(await createDevice(tag).setValue('missing', 42), false);
            sinon.assert.notCalled(client.WriteMultiVars);
        });
    });

    describe('Bool tags', () => {
        const bool = { type: 'Bool', address: 'DB3.DBX0.1' };

        // `true` and 'true'/'on' were written as 0: parseFloat() of them is NaN.
        const setsBit = [true, 1, '1', 'true', 'TRUE', ' on ', 2, '2', '1.5'];
        const clearsBit = [false, 0, '0', 'false', 'off', '', null];

        for (const value of setsBit) {
            it(`writes ${JSON.stringify(value)} as 1`, async () => {
                const item = await writtenItem(bool, value);
                assert.deepEqual(item.Data, Buffer.from([0x01]));
            });
        }

        for (const value of clearsBit) {
            it(`writes ${JSON.stringify(value)} as 0`, async () => {
                const item = await writtenItem(bool, value);
                assert.deepEqual(item.Data, Buffer.from([0x00]));
            });
        }

        it('writes the single addressed bit', async () => {
            const item = await writtenItem(bool, true);
            assert.equal(item.WordLen, S7WLBit);
            assert.equal(item.Area, S7AreaDB);
            assert.equal(item.DBNumber, 3);
            assert.equal(item.Start, 0 * 8 + 1);
        });
    });

    describe('other types are unchanged', () => {
        it('writes a Real', async () => {
            const item = await writtenItem({ type: 'Real', address: 'DB5.DBD8' }, 55.5);
            const expected = Buffer.alloc(4);
            expected.writeFloatBE(55.5);
            assert.deepEqual(item.Data, expected);
            assert.equal(item.WordLen, S7WLReal);
        });

        it('writes an Int from a numeric string', async () => {
            const item = await writtenItem({ type: 'Int', address: 'DB4.DBW2' }, '42');
            const expected = Buffer.alloc(2);
            expected.writeInt16BE(42);
            assert.deepEqual(item.Data, expected);
        });
    });
});
