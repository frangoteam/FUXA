'use strict';

const assert = require('assert').strict;
const EventEmitter = require('events');
const Module = require('module');
const sinon = require('sinon');

// Deterministic mock of the `nodes7` library. It reproduces the exact point where
// the real library breaks: stringToS7Addr does addr.split(',') and, if the
// translation callback returns undefined for a stale item, it throws
// "Cannot read properties of undefined (reading 'split')".
class FakeNodeS7 {
    constructor() {
        this.polledReadBlockList = [];
        this.addRemoveArray = [];
        this.readPacketValid = true;
        this.isoConnectionState = 0;
        this.translationCB = () => undefined;
        this.nextValues = {};
        this.anyBad = false;
        FakeNodeS7.lastInstance = this;
    }
    setTranslationCB(cb) { this.translationCB = cb; }
    addItems(arg) { this.addRemoveArray.push({ arg, action: 'add' }); }
    removeItemsNow() { this.polledReadBlockList = []; }
    isWaiting() { return false; }
    readAllItems(cb) {
        for (const element of this.addRemoveArray) {
            if (element.action !== 'add') continue;
            const names = Array.isArray(element.arg) ? element.arg : [element.arg];
            for (const name of names) {
                if (name === '_COMMERR') continue;
                const addr = this.translationCB(name);
                addr.split(','); // <-- throws when addr is undefined
                this.polledReadBlockList.push(addr);
            }
        }
        this.addRemoveArray = [];
        if (cb) cb(this.anyBad, this.nextValues);
    }
}
FakeNodeS7.lastInstance = null;

describe('S7 nodes7 driver', () => {
    let sandbox;
    let driver;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        const originalLoad = Module._load;
        sandbox.stub(Module, '_load').callsFake(function (request) {
            if (request === 'nodes7') return FakeNodeS7;
            // node-snap7 is a native addon: it is not available in unit tests.
            if (request === 'node-snap7') return undefined;
            return originalLoad.apply(this, arguments);
        });
        delete require.cache[require.resolve('../../runtime/devices/s7/index')];
        delete require.cache[require.resolve('../../runtime/devices/s7/nodes7')];
        driver = require('../../runtime/devices/s7');
    });

    afterEach(() => {
        sandbox.restore();
    });

    function makeLogger() {
        const lines = [];
        const push = (level) => (msg) => lines.push({ level, msg: String(msg) });
        return { lines, info: push('info'), warn: push('warn'), error: push('error'), debug: push('debug') };
    }

    function makeDriver(tags) {
        const logger = makeLogger();
        const data = { id: 'dev-1', name: 'TestS7', tags, property: { address: '127.0.0.1', driver: 'nodes7' } };
        const instance = driver.create(data, logger, new EventEmitter(), {}, {});
        return { instance, data, logger };
    }

    const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

    it('keeps node-snap7 as the default driver', () => {
        const data = { id: 'dev-1', name: 'TestS7', tags: {}, property: { address: '127.0.0.1' } };
        // node-snap7 is unavailable in this environment, so the default driver
        // cannot be created: the pure-JS driver must not be used implicitly.
        assert.equal(driver.create(data, makeLogger(), new EventEmitter(), {}, {}), null);
    });

    it('does not leave stale items in the nodes7 queue when reloading without tags', async () => {
        const { instance, data, logger } = makeDriver({ A: { address: 'DB1.DBW0', type: 'Int' } });
        instance.load(data);

        data.tags = { B: { address: 'DB1.DBW2', type: 'Int' } };
        instance.load(data);

        assert.deepEqual(Object.keys(instance.addressMap), ['B']);

        await instance.polling();

        const splitErrors = logger.lines.filter((l) => l.level === 'warn' && l.msg.includes("reading 'split'"));
        assert.deepEqual(splitErrors, []);
    });

    it('skips unsupported addresses without breaking the polling', async () => {
        const { instance, data, logger } = makeDriver({
            X: { address: 'DB1.INT0', type: 'Int' },
            Y: { address: 'DB1.DBW0', type: 'Int' },
        });
        instance.load(data);

        assert.deepEqual(Object.keys(instance.addressMap), ['Y']);

        await instance.polling();

        const splitErrors = logger.lines.filter((l) => l.level === 'warn' && l.msg.includes("reading 'split'"));
        assert.deepEqual(splitErrors, []);
    });

    it('keeps the last good value when nodes7 reports bad quality (BAD)', async () => {
        const { instance, data } = makeDriver({ A: { address: 'DB1.DBW0', type: 'Int' } });
        instance.load(data);
        const fake = FakeNodeS7.lastInstance;
        fake.isoConnectionState = 4;

        fake.nextValues = { A: 1 };
        await instance.polling();
        await tick();
        assert.equal(instance.getValues().A.value, 1);

        fake.nextValues = { A: 'BAD 255' };
        await instance.polling();
        await tick();
        assert.equal(instance.getValues().A.value, 1);
        assert.equal(instance.getValues().A.rawValue, 1);
    });

    it('keeps the last good value when the connection drops (no null values)', async () => {
        const { instance, data } = makeDriver({ A: { address: 'DB1.DBW0', type: 'Int' } });
        instance.load(data);
        const fake = FakeNodeS7.lastInstance;
        fake.isoConnectionState = 4;

        fake.nextValues = { A: 7 };
        await instance.polling();
        await tick();
        assert.equal(instance.getValues().A.value, 7);

        fake.isoConnectionState = 0;
        fake.nextValues = { A: null };
        await instance.polling();
        await tick();
        assert.equal(instance.getValues().A.value, 7);
        assert.equal(instance.isConnected(), false);
    });

    it('keeps polling locked until asynchronous tag processing completes', async () => {
        const { instance, data } = makeDriver({ A: { address: 'DB1.DBW0', type: 'Int' } });
        instance.load(data);
        const fake = FakeNodeS7.lastInstance;
        fake.isoConnectionState = 4;
        fake.nextValues = { A: 3 };

        const deviceUtils = require('../../runtime/devices/device-utils');
        const originalCompose = deviceUtils.tagValueCompose;
        let finishCompose;
        deviceUtils.tagValueCompose = () => new Promise((resolve) => { finishCompose = resolve; });
        try {
            const firstPoll = instance.polling();
            await Promise.resolve();
            assert.equal(instance.working, true);
            let readCount = 0;
            const originalRead = fake.readAllItems;
            fake.readAllItems = function (...args) {
                readCount++;
                return originalRead.apply(this, args);
            };
            await instance.polling();
            assert.equal(readCount, 0);

            finishCompose(3);
            await firstPoll;
            await tick();
            assert.equal(instance.working, false);
        } finally {
            deviceUtils.tagValueCompose = originalCompose;
        }
    });

    it('updates the last read timestamp only while connected', async () => {
        const { instance, data } = makeDriver({ A: { address: 'DB1.DBW0', type: 'Int' } });
        instance.load(data);
        const fake = FakeNodeS7.lastInstance;

        fake.isoConnectionState = 0;
        await instance.polling();
        assert.equal(instance.lastReadTimestamp(), 0);

        fake.isoConnectionState = 4;
        await instance.polling();
        assert.ok(instance.lastReadTimestamp() > 0);
    });
});
