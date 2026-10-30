'use strict';
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');
const Module = require('node:module');
const sinon = require('sinon');
const utils = require('../../runtime/utils');

// Controlled BACnet transport; the actual driver performs scaling, addressing and encoding.
describe('BACnet write completion', function () {
    let sandbox, client, driver, logger, device;
    beforeEach(async function () {
        sandbox = sinon.createSandbox();
        client = new EventEmitter();
        client.writeProperty = sandbox.stub();
        client.close = sandbox.spy();
        client.whoIs = () => client.emit('iAm', {
            payload: { deviceId: 123 }, header: { sender: { address: '127.0.0.2' } }
        });
        function ControlledBacnet() { return client; }
        ControlledBacnet.enum = {
            ApplicationTag: { NULL: 0, REAL: 4, ENUMERATED: 9 },
            ObjectType: { ANALOG_INPUT: 0, ANALOG_OUTPUT: 1, ANALOG_VALUE: 2,
                BINARY_INPUT: 3, BINARY_OUTPUT: 4, BINARY_VALUE: 5 },
            PropertyIdentifier: { PRESENT_VALUE: 85 }
        };
        const filename = require.resolve('../../runtime/devices/bacnet');
        delete require.cache[filename];
        const originalLoad = Module._load;
        sandbox.stub(Module, '_load').callsFake(function (request, parent) {
            if (request === 'node-bacnet' && parent.filename === filename) return ControlledBacnet;
            return originalLoad.apply(this, arguments);
        });
        sandbox.stub(utils, 'getNetworkInterfaces').returns(['127.0.0.1']);
        sandbox.stub(console, 'log');
        sandbox.stub(console, 'error');
        logger = { info: sandbox.spy(), warn: sandbox.spy(), error: sandbox.spy() };
        driver = require(filename);
        device = driver.create({ name: 'BACnet completion', property: { address: '127.0.0.1' }, tags: {
            analog: { name: 'Analog', address: '2-7', memaddress: '123',
                scale: { mode: 'linear', rawLow: 0, rawHigh: 100, scaledLow: 0, scaledHigh: 10 } },
            binary: { name: 'Binary', address: '5-9', memaddress: '123' }
        } }, logger, new EventEmitter());
        await device.connect();
        logger.info.resetHistory();
    });
    afterEach(async function () {
        try { if (device) await device.disconnect(); }
        finally {
            sandbox.restore();
            delete require.cache[require.resolve('../../runtime/devices/bacnet')];
        }
    });
    for (const failure of [false, true]) {
        it(`waits for a delayed ${failure ? 'failed' : 'successful'} write callback`, async function () {
            const pending = device.setValue('analog', 4.2);
            let settled = false;
            pending.then(() => { settled = true; }, () => { settled = true; });
            await new Promise(setImmediate);
            sinon.assert.calledOnce(client.writeProperty);
            const callback = client.writeProperty.firstCall.args[5];
            try {
                assert.equal(settled, false, 'setValue must remain pending until the transport callback');
                sinon.assert.notCalled(logger.info);
                sinon.assert.notCalled(logger.error);
            } finally {
                callback(failure ? new Error('controlled write rejected') : null);
            }
            assert.equal(await pending, !failure);
            if (failure) sinon.assert.calledWithMatch(logger.error, 'controlled write rejected');
            else sinon.assert.calledWithMatch(logger.info, 'setValue(analog,');
        });
    }
    it('returns false when the transport immediately rejects the write', async function () {
        client.writeProperty.callsFake((a, o, p, v, opt, cb) => cb(new Error('controlled denial')));
        assert.equal(await device.setValue('analog', 1), false);
        sinon.assert.calledWithMatch(logger.error, 'controlled denial');
        sinon.assert.notCalled(logger.info);
    });
    it('returns false when the transport throws while starting the write', async function () {
        client.writeProperty.throws(new Error('controlled transport throw'));
        assert.equal(await device.setValue('analog', 1), false);
        sinon.assert.calledWithMatch(logger.error, 'controlled transport throw');
    });
    for (const [tagId, input, object, encoded] of [
        ['analog', 4.2, { type: 2, instance: 7 }, { type: 4, value: 42 }],
        ['binary', 0, { type: 5, instance: 9 }, { type: 9, value: 0 }]
    ]) {
        it(`preserves ${tagId} addressing, encoding and priority`, async function () {
            client.writeProperty.callsFake((a, o, p, v, opt, cb) => cb(null));
            assert.equal(await device.setValue(tagId, input), true);
            sinon.assert.calledOnce(client.writeProperty);
            assert.deepEqual(client.writeProperty.firstCall.args.slice(0, 5), [
                '127.0.0.2', object, 85, [encoded], { priority: 16 }
            ]);
            sinon.assert.notCalled(logger.error);
        });
    }
    it('rejects an unknown tag without a transport write', async function () {
        assert.equal(await device.setValue('missing', 1), false);
        sinon.assert.notCalled(client.writeProperty);
    });
});
