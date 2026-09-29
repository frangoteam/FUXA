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
            DataType: { Double: 11, String: 12, ByteString: 15 }
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

    async function createDevice(connect = true) {
        const device = driver.create({
            id: 'opcua-test', name: 'OPC UA test', property: { address: 'opc.tcp://test:4840' },
            tags: { tag1: { name: 'Tag 1', type: 'Double', address: 'ns=1;s=ReadOnlyValue' } }
        }, logger, new EventEmitter(), null, {});
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
});
