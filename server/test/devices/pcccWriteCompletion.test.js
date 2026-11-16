'use strict';
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');
const Module = require('node:module');
const sinon = require('sinon');

describe('PCCC write completion', () => {
    let sandbox, client, device, logger, filename;
    beforeEach(() => {
        sandbox = sinon.createSandbox();
        client = { writeItems: sandbox.stub() };
        logger = { info: sandbox.spy(), warn: sandbox.spy(), error: sandbox.spy() };
        filename = require.resolve('../../runtime/devices/ethernetip');
        delete require.cache[filename];
        const originalLoad = Module._load;
        sandbox.stub(Module, '_load').callsFake(function (request, parent) {
            if (request === 'nodepccc' && parent.filename === filename) {
                return function ControlledPccc() { return client; };
            }
            return originalLoad.apply(this, arguments);
        });
        device = require(filename).create({ name: 'PCCC fixture', tags: {
            plain: { name: 'Plain', address: 'N7:0' },
            scaled: { name: 'Scaled', address: 'F8:1',
                scale: { mode: 'linear', rawLow: 0, rawHigh: 100, scaledLow: 0, scaledHigh: 10 } }
        } }, logger, new EventEmitter());
    });
    afterEach(() => {
        sandbox.restore();
        delete require.cache[filename];
    });
    for (const failure of [false, true]) {
        it(`waits for a delayed ${failure ? 'failed' : 'successful'} write`, async () => {
            const pending = device.setValue('plain', 42);
            let settled = false;
            pending.then(() => { settled = true; }, () => { settled = true; });
            await new Promise(setImmediate);
            sinon.assert.calledOnce(client.writeItems);
            const callback = client.writeItems.firstCall.args[2];
            try {
                assert.equal(settled, false, 'setValue must await the write callback');
                sinon.assert.notCalled(logger.info);
                sinon.assert.notCalled(logger.error);
            } finally {
                callback(failure ? new Error('controlled write denial') : null);
            }
            assert.equal(await pending, !failure);
            if (failure) sinon.assert.calledWithMatch(logger.error, 'controlled write denial');
            else sinon.assert.calledWithMatch(logger.info, 'setValue(plain, 42)');
        });
    }
    for (const thrown of [false, true]) {
        it(`returns false after an ${thrown ? 'exception' : 'immediate callback error'} and permits recovery`, async () => {
            if (thrown) client.writeItems.throws(new Error('controlled write error'));
            else client.writeItems.callsFake((a, v, cb) => cb(new Error('controlled write error')));
            assert.equal(await device.setValue('plain', 1), false);
            sinon.assert.calledWithMatch(logger.error, 'controlled write error');
            sinon.assert.notCalled(logger.info);
            client.writeItems.callsFake((a, v, cb) => cb(null));
            assert.equal(await device.setValue('plain', 2), true);
        });
    }
    for (const [tag, input, address, output] of [['plain', 0, 'N7:0', 0], ['scaled', '4.2', 'F8:1', 42]]) {
        it(`preserves ${tag} address and numeric conversion`, async () => {
            client.writeItems.callsFake((a, v, cb) => cb(null));
            assert.equal(await device.setValue(tag, input), true);
            assert.deepEqual(client.writeItems.firstCall.args.slice(0, 2), [[address], [output]]);
        });
    }
    it('returns false for an unknown tag without writing', async () => {
        assert.equal(await device.setValue('missing', 1), false);
        sinon.assert.notCalled(client.writeItems);
    });
});
