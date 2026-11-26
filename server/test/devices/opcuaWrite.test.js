'use strict';

const assert = require('assert').strict;
const EventEmitter = require('events');
const Module = require('module');
const sinon = require('sinon');

describe('OPC UA write results', () => {
    let driver;
    let session;
    let logger;
    let sandbox;
    const good = { isGood: () => true, toString: () => 'Good' };
    const bad = { isGood: () => false, toString: () => 'BadNotWritable' };

    // Support both library overloads so the same tests exercise the original driver.
    function writeResult(statusCodes, error = null) {
        session.write.callsFake((nodes, callback) => {
            if (callback) {
                setImmediate(() => callback(error, statusCodes));
                return;
            }
            return new Promise((resolve, reject) => {
                setImmediate(() => error ? reject(error) : resolve(statusCodes));
            });
        });
    }

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        session = new EventEmitter();
        session.write = sandbox.stub();
        session.createSubscription2 = sandbox.stub().callsArgWith(1, null, {});
        const client = new EventEmitter();
        client.connect = sandbox.stub().callsArgWith(1, null);
        client.createSession = sandbox.stub().callsArgWith(1, null, session);
        logger = { info: sandbox.spy(), warn: sandbox.spy(), error: sandbox.spy() };
        const opcua = {
            OPCUAClient: { create: () => client },
            AttributeIds: { Value: 13 },
            DataType: {
                Boolean: 1, SByte: 2, Byte: 3, Int16: 4, UInt16: 5, Int32: 6, UInt32: 7,
                Int64: 8, UInt64: 9, Float: 10, Double: 11, String: 12, ByteString: 15
            }
        };
        const originalLoad = Module._load;
        sandbox.stub(Module, '_load').callsFake(function (request, parent, isMain) {
            if (request === 'node-opcua' && parent.filename === require.resolve('../../runtime/devices/opcua')) {
                return opcua;
            }
            return originalLoad.apply(this, arguments);
        });
        delete require.cache[require.resolve('../../runtime/devices/opcua')];
        driver = require('../../runtime/devices/opcua');
        writeResult([good]);
    });

    afterEach(async () => {
        await new Promise(resolve => setImmediate(resolve));
        sandbox.restore();
        delete require.cache[require.resolve('../../runtime/devices/opcua')];
    });

    async function createDevice(connect = true, tags = null, runtime = {}) {
        const device = driver.create({
            id: 'opcua-test', name: 'OPC UA test', property: { address: 'opc.tcp://test:4840' },
            tags: tags || { tag1: { name: 'Tag 1', type: 'Double', address: 'ns=1;s=ReadOnlyValue' } }
        }, logger, new EventEmitter(), null, runtime);
        if (connect) {
            await device.connect();
        }
        logger.info.resetHistory();
        return device;
    }

    it('returns true only after a Good write result', async () => {
        const device = await createDevice();
        assert.equal(await device.setValue('tag1', 123), true);
        sinon.assert.calledOnce(session.write);
        assert.equal(session.write.firstCall.args[0][0].value.value.value, 123);
        sinon.assert.calledWithMatch(logger.info, 'setValue(tag1, 123)');
        sinon.assert.notCalled(logger.error);
    });

    it('returns false for BadNotWritable without a transport error', async () => {
        const device = await createDevice();
        writeResult([bad]);
        assert.equal(await device.setValue('tag1', 123), false);
        sinon.assert.calledWithMatch(logger.error, 'BadNotWritable');
        sinon.assert.notCalled(logger.info);
    });

    it('returns false when the write rejects', async () => {
        const device = await createDevice();
        writeResult(undefined, new Error('session write failed'));
        assert.equal(await device.setValue('tag1', 123), false);
        sinon.assert.calledWithMatch(logger.error, 'session write failed');
        sinon.assert.notCalled(logger.info);
    });

    it('returns false when the write throws synchronously', async () => {
        const device = await createDevice();
        session.write.throws(new Error('write threw'));
        assert.equal(await device.setValue('tag1', 123), false);
        sinon.assert.calledWithMatch(logger.error, 'write threw');
    });

    it('does not resolve before the write outcome is available', async () => {
        const device = await createDevice();
        let finish;
        session.write.callsFake((nodes, callback) => {
            if (callback) {
                finish = () => callback(null, [bad]);
                return;
            }
            return new Promise(resolve => { finish = () => resolve([bad]); });
        });
        let settled = false;
        const pending = device.setValue('tag1', 123).then(result => {
            settled = true;
            return result;
        });
        await new Promise(resolve => setImmediate(resolve));
        const settledBeforeResult = settled;
        finish();
        const result = await pending;
        assert.equal(settledBeforeResult, false);
        assert.equal(result, false);
    });

    it('does not report success when the result list is empty', async () => {
        const device = await createDevice();
        writeResult([]);
        assert.equal(await device.setValue('tag1', 123), false);
        sinon.assert.notCalled(logger.info);
    });

    it('returns false without a session', async () => {
        const device = await createDevice(false);
        assert.equal(await device.setValue('tag1', 123), false);
        sinon.assert.notCalled(session.write);
    });

    it('returns false for an unknown tag without sending a write', async () => {
        const device = await createDevice();
        assert.equal(await device.setValue('missing', 123), false);
        sinon.assert.notCalled(session.write);
    });

    describe('write scaling before type conversion', () => {
        const expression = (writeExpression) => ({ mode: 'expression', readExpression: 'x', writeExpression });

        async function written(tag, value) {
            const device = await createDevice(true, { tag1: Object.assign({ name: 'Tag 1', address: 'ns=1;s=Value' }, tag) });
            session.write.resetHistory();
            assert.equal(await device.setValue('tag1', value), true);
            return session.write.firstCall.args[0][0].value.value.value;
        }

        it('scales an Int32 expression tag before integer conversion', async () => {
            const tag = { type: 'Int32', scale: expression('this * 1000') };
            assert.equal(await written(tag, '61.850'), 61850);
            assert.equal(await written(tag, 61.7), 61700);
        });

        it('scales an Int16 expression tag before integer conversion', async () => {
            const tag = { type: 'Int16', scale: expression('this * 10') };
            assert.equal(await written(tag, '12.3'), 123);
            assert.equal(await written(tag, '0.5'), 5);
        });

        it('uses the read dataType when scaling an integer tag', async () => {
            const tag = { type: 'Double', dataType: 6, scale: expression('this * 1000') };
            assert.equal(await written(tag, '61.850'), 61850);
        });

        it('scales an Int32 linear tag before integer conversion', async () => {
            const tag = { type: 'Int32', scale: { mode: 'linear', rawLow: 0, rawHigh: 10000, scaledLow: 0, scaledHigh: 10 } };
            assert.equal(await written(tag, '2.5'), 2500);
        });

        it('rounds scaled integer writes instead of truncating floating-point error', async () => {
            assert.equal(await written({ type: 'Int16', scale: expression('this * 100') }, '0.29'), 29);
            assert.equal(await written({ type: 'Int16', scale: expression('this * 100') }, '4.35'), 435);
            const linear = { type: 'Int32', scale: { mode: 'linear', rawLow: 0, rawHigh: 10000, scaledLow: 0, scaledHigh: 10 } };
            assert.equal(await written(linear, '0.57'), 570);
            // tiny results must not be parsed from exponent notation ('1e-7' -> 1)
            assert.equal(await written({ type: 'Int32', scale: expression('this / 1e7') }, '1'), 0);        });

        it('refuses the write when the write expression fails', async () => {
            for (const type of ['Int32', 'Double']) {
                const device = await createDevice(true, { tag1: { name: 'Tag 1', address: 'ns=1;s=Value', type, scale: expression('this *') } });
                session.write.resetHistory();
                assert.equal(await device.setValue('tag1', '1'), false);
                sinon.assert.notCalled(session.write);
            }
        });

        it('refuses the write when the write scale script fails', async () => {
            const runtime = {
                logger: { error: sandbox.spy() },
                scriptsMgr: { runScript: sandbox.stub().rejects(new Error('boom')) }
            };
            const device = await createDevice(true, { tag1: { name: 'Tag 1', address: 'ns=1;s=Value', type: 'Int32', scaleWriteFunction: 'script1' } }, runtime);
            session.write.resetHistory();
            assert.equal(await device.setValue('tag1', '61.85'), false);
            sinon.assert.notCalled(session.write);
            sinon.assert.calledOnce(runtime.logger.error);
        });

        it('refuses the write when scaling divides by zero', async () => {
            const linear = { mode: 'linear', rawLow: 0, rawHigh: 100, scaledLow: 10, scaledHigh: 10 };
            for (const tag of [{ type: 'Int32', scale: linear }, { type: 'Double', scale: expression('this / 0') }]) {
                const device = await createDevice(true, { tag1: Object.assign({ name: 'Tag 1', address: 'ns=1;s=Value' }, tag) });
                session.write.resetHistory();
                assert.equal(await device.setValue('tag1', '5'), false);
                sinon.assert.notCalled(session.write);
            }
        });

        it('still truncates unscaled integer writes', async () => {
            assert.equal(await written({ type: 'Int32' }, '61.7'), 61);
        });

        it('keeps decimals for scaled Float and Double tags', async () => {
            assert.equal(await written({ type: 'Double', scale: expression('this * 10') }, '1.25'), 12.5);
            assert.equal(await written({ type: 'Float', scale: expression('this / 4') }, '1.5'), 0.375);
        });

        it('sends String and ByteString tags as strings', async () => {
            assert.equal(await written({ type: 'String' }, 'abc'), 'abc');
            assert.equal(await written({ type: 'String' }, 42), '42');
            assert.equal(await written({ type: 'String', scale: expression('this * 2') }, '21'), '21');
            assert.equal(await written({ type: 'String' }, '007'), '007');
            assert.equal(await written({ type: 'ByteString' }, 'xyz'), 'xyz');
        });

        it('converts Boolean tags as before', async () => {
            const tag = { type: 'Boolean' };
            assert.equal(await written(tag, 'true'), true);
            assert.equal(await written(tag, 'false'), false);
            assert.equal(await written(tag, '1'), true);
            assert.equal(await written(tag, '0'), false);
            assert.equal(await written(tag, 1), true);
            assert.equal(await written(tag, true), true);
            assert.equal(await written(tag, false), false);
        });
    });
});
