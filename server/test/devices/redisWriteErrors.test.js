'use strict';
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');
const Module = require('node:module');
const sinon = require('sinon');

describe('Redis write error handling', function () {
    let sandbox, client, driver, logger, device;
    beforeEach(function () {
        sandbox = sinon.createSandbox();
        client = new EventEmitter();
        client.connect = sandbox.stub().resolves();
        client.quit = sandbox.stub().resolves();
        client.sendCommand = sandbox.stub().resolves('OK');
        logger = { info() {}, warn: sandbox.spy(), error: sandbox.spy() };
        const filename = require.resolve('../../runtime/devices/redis');
        delete require.cache[filename];
        const originalLoad = Module._load;
        sandbox.stub(Module, '_load').callsFake(function (request, parent) {
            if (request === 'redis' && parent.filename === filename) return { createClient: () => client };
            return originalLoad.apply(this, arguments);
        });
        driver = require(filename);
    });
    afterEach(async function () {
        try { if (device) await device.disconnect(); }
        finally {
            sandbox.restore();
            delete require.cache[require.resolve('../../runtime/devices/redis')];
        }
    });
    async function connected(mode = 'simple', extra = {}, type = 'number') {
        const data = { id: 'controlled', name: 'Redis write errors', property: {
            address: 'redis://127.0.0.1:1', connectionOption: mode, ...extra
        }, tags: { target: { name: 'Target', type, address: 'test:key', options: 'Value' } } };
        device = driver.create(data, logger, new EventEmitter());
        device.load(data);
        await device.connect();
        return device;
    }
    for (const [name, mode, extra, failureIndex] of [
        ['SET', 'simple', {}, 0],
        ['HSET', 'hash', {}, 0],
        ['custom command', 'hash', { options: { customCommand: { write: { name: 'CONTROLLED.HSET' } } } }, 0],
        ['EXPIRE after HSET', 'hash', { ttlSeconds: 60 }, 1]
    ]) {
        it(`returns false and logs the original ${name} error, then permits a later write`, async function () {
            await connected(mode, extra);
            client.sendCommand.onCall(failureIndex).rejects(new Error('controlled command failure'));
            assert.equal(await device.setValue('target', 12), false);
            sinon.assert.calledWithMatch(logger.error, "'Target' setValue error: controlled command failure");
            client.sendCommand.resetBehavior();
            client.sendCommand.resolves('OK');
            assert.equal(await device.setValue('target', 13), true);
        });
    }
    it('logs an unknown tag by id and performs no command', async function () {
        await connected();
        assert.equal(await device.setValue('missing', 1), false);
        sinon.assert.calledWithMatch(logger.error, "'missing' setValue error: unknown-tag missing");
        sinon.assert.notCalled(client.sendCommand);
    });
    it('returns false after a command timeout and clears its timer', async function () {
        await connected('simple', { redisTimeoutMs: 25 });
        const clock = sandbox.useFakeTimers();
        client.sendCommand.returns(new Promise(() => {}));
        const pending = device.setValue('target', 1);
        // Observe rejection immediately so the original defect does not create an orphan promise.
        const observed = pending.then(value => ({ value }), error => ({ error }));
        await clock.tickAsync(25);
        const result = await observed;
        assert.equal(result.error, undefined);
        assert.equal(result.value, false);
        sinon.assert.calledWithMatch(logger.error, 'Timeout SET test:key');
        assert.equal(clock.countTimers(), 0);
    });
    for (const [mode, expected] of [
        ['simple', ['SET', 'test:key', '0']],
        ['hash', ['HSET', 'test:key', 'Value', '0']]
    ]) {
        it(`preserves successful ${mode} zero writes`, async function () {
            await connected(mode);
            assert.equal(await device.setValue('target', 0), true);
            sinon.assert.calledOnceWithExactly(client.sendCommand, expected);
            sinon.assert.notCalled(logger.error);
        });
    }
    it('rejects non-finite numbers without a command', async function () {
        await connected();
        assert.equal(await device.setValue('target', 'not-a-number'), false);
        sinon.assert.notCalled(client.sendCommand);
        sinon.assert.calledOnce(logger.warn);
    });
    for (const mode of ['simple', 'hash', 'custom']) {
        for (const [label, input, expected] of [
            ['false string', 'false', '0'], ['nested false string', { value: 'false' }, '0'],
            ['case and spaces', ' FALSE ', '0'], ['JSON payload', '{"value":"false"}', '0'],
            ['native false', false, '0'], ['native true', true, '1']
        ]) {
            it(`writes ${label} as ${expected} in ${mode} mode`, async function () {
                const extra = mode === 'custom' ? { options: { customCommand: { write: { name: 'CONTROLLED.HSET' } } } } : {};
                await connected(mode === 'custom' ? 'hash' : mode, extra, 'boolean');
                assert.equal(await device.setValue('target', input), true);
                const command = mode === 'simple' ? ['SET', 'test:key', expected]
                    : mode === 'hash' ? ['HSET', 'test:key', 'Value', expected]
                    : ['CONTROLLED.HSET', 'test:key', '100', 'Value', expected];
                sinon.assert.calledOnceWithExactly(client.sendCommand, command);
                sinon.assert.notCalled(logger.error);
            });
        }
    }
    it('returns false while disconnected without a command', async function () {
        await connected();
        await device.disconnect();
        assert.equal(await device.setValue('target', 1), false);
        sinon.assert.notCalled(client.sendCommand);
    });
});
