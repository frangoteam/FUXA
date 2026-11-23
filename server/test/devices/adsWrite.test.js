'use strict';

const assert = require('assert');
const EventEmitter = require('events');
const Module = require('module');

let writes = [];

function FakeAdsClient() {
    this.connection = { connected: false };
}
FakeAdsClient.prototype.connect = async function () {
    this.connection.connected = true;
    return { targetAmsNetId: '127.0.0.1' };
};
FakeAdsClient.prototype.on = function () { };
FakeAdsClient.prototype.getSymbols = async function () {
    return {};
};
FakeAdsClient.prototype.subscribeValue = async function () { };
FakeAdsClient.prototype.unsubscribeAll = async function () { };
FakeAdsClient.prototype.disconnect = function () { };
FakeAdsClient.prototype.writeValue = async function (address, value) {
    writes.push({ address, value });
};

describe('ADS write scaling', function () {
    let originalLoad;

    before(function () {
        originalLoad = Module._load;
        Module._load = function (request) {
            if (request === 'ads-client') {
                return { Client: FakeAdsClient };
            }
            return originalLoad.apply(this, arguments);
        };
        delete require.cache[require.resolve('../../runtime/devices/adsclient')];
    });

    after(function () {
        Module._load = originalLoad;
        delete require.cache[require.resolve('../../runtime/devices/adsclient')];
    });

    async function write(tag, value, runtime = {}) {
        const driver = require('../../runtime/devices/adsclient');
        const client = driver.create({
            id: 'ads-device-1',
            name: 'ADS test',
            enabled: true,
            property: { address: '192.168.0.1:851' },
            tags: { tag1: Object.assign({ id: 'tag1', name: 'Tag 1', address: 'MAIN.value' }, tag) }
        }, { info() { }, warn() { }, error() { } }, new EventEmitter(), null, runtime);
        await client.connect();
        writes = [];
        return client.setValue('tag1', value);
    }

    async function written(tag, value, runtime) {
        assert.strictEqual(await write(tag, value, runtime), true);
        assert.strictEqual(writes.length, 1);
        assert.strictEqual(writes[0].address, 'MAIN.value');
        return writes[0].value;
    }

    it('applies the write expression to number tags without losing decimals', async function () {
        const tag = { type: 'number', scale: { mode: 'expression', readExpression: 'x', writeExpression: 'this * 1000' } };
        assert.strictEqual(await written(tag, '61.850'), 61850);
        assert.strictEqual(await written(tag, 61.7), 61700);
    });

    it('applies linear scaling to number tags', async function () {
        const tag = { type: 'number', scale: { mode: 'linear', rawLow: 0, rawHigh: 10000, scaledLow: 0, scaledHigh: 10 } };
        assert.strictEqual(await written(tag, '2.5'), 2500);
    });

    it('writes unscaled number tags as floats', async function () {
        assert.strictEqual(await written({ type: 'number' }, '61.7'), 61.7);
    });

    it('converts boolean string values', async function () {
        assert.strictEqual(await written({ type: 'boolean' }, 'true'), 1);
        assert.strictEqual(await written({ type: 'boolean' }, 'false'), 0);
        assert.strictEqual(await written({ type: 'boolean' }, '1'), 1);
        assert.strictEqual(await written({ type: 'boolean' }, '0'), 0);
    });

    it('converts non-string boolean values', async function () {
        assert.strictEqual(await written({ type: 'boolean' }, true), 1);
        assert.strictEqual(await written({ type: 'boolean' }, false), 0);
        assert.strictEqual(await written({ type: 'boolean' }, 1), 1);
        assert.strictEqual(await written({ type: 'boolean' }, 0), 0);
    });

    it('runs the write scale script', async function () {
        const runtime = {
            logger: { error() { } },
            scriptsMgr: { runScript: async (script) => script.parameters[0].value * 2 }
        };
        assert.strictEqual(await written({ type: 'number', scaleWriteFunction: 'script1' }, '21', runtime), 42);
    });

    it('refuses the write when the write scale script fails', async function () {
        const runtime = {
            logger: { error() { } },
            scriptsMgr: { runScript: async () => { throw new Error('boom'); } }
        };
        assert.strictEqual(await write({ type: 'number', scaleWriteFunction: 'script1' }, '21', runtime), false);
        assert.strictEqual(writes.length, 0);
    });

    it('returns false when the write fails', async function () {
        const original = FakeAdsClient.prototype.writeValue;
        FakeAdsClient.prototype.writeValue = async function () { throw new Error('write error'); };
        try {
            assert.strictEqual(await write({ type: 'number' }, '1'), false);
        } finally {
            FakeAdsClient.prototype.writeValue = original;
        }
    });

    it('writes string tags unchanged', async function () {
        assert.strictEqual(await written({ type: 'string' }, 'abc'), 'abc');
    });
});
