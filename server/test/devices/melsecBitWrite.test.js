'use strict';

const assert = require('assert');
const EventEmitter = require('events');
const Module = require('module');

describe('melsec write of a bit inside a word device', function () {
    let melsec;
    let writes;
    let originalLoad;

    before(function () {
        // mcprotocol 0.1.2 cannot write a single bit of D/R/TN/CN: it sends the whole word with value 0
        writes = [];
        function FakeMcProtocol() { }
        FakeMcProtocol.prototype.initiateConnection = function (params, callback) {
            setImmediate(() => callback());
        };
        FakeMcProtocol.prototype.setTranslationCB = function (cb) { this.translate = cb; };
        FakeMcProtocol.prototype.addItems = function () { };
        FakeMcProtocol.prototype.dropConnection = function () { };
        FakeMcProtocol.prototype.writeItems = function (tagId, value, callback) {
            writes.push({ address: this.translate(tagId), value });
            setImmediate(() => callback(false));
        };
        originalLoad = Module._load;
        Module._load = function (request) {
            if (request === 'mcprotocol') {
                return FakeMcProtocol;
            }
            return originalLoad.apply(this, arguments);
        };
        delete require.cache[require.resolve('../../runtime/devices/melsec')];
        melsec = require('../../runtime/devices/melsec');
    });

    after(function () {
        Module._load = originalLoad;
        delete require.cache[require.resolve('../../runtime/devices/melsec')];
    });

    beforeEach(function () {
        writes.length = 0;
    });

    async function connectedClient(address) {
        const logger = { info() { }, warn() { }, error() { } };
        const tags = { t1: { id: 't1', name: 'tag', address, type: 'number' } };
        const client = melsec.create({ id: 'plc', name: 'PLC', property: { address: '192.168.0.1:1025' }, tags }, logger, new EventEmitter(), null, {});
        client.load({ id: 'plc', name: 'PLC', property: { address: '192.168.0.1:1025' }, tags });
        await client.connect();
        return client;
    }

    for (const address of ['D111.1', 'D111/1', 'R20.15', 'TN5.0', 'CN10.3']) {
        it(`refuses to write ${address} instead of overwriting the whole word`, async function () {
            const client = await connectedClient(address);
            const result = await client.setValue('t1', 1);
            assert.strictEqual(result, false);
            assert.deepStrictEqual(writes, []);
        });
    }

    for (const address of ['D110', 'D110,2', 'M100', 'Y20', 'DFLOAT200']) {
        it(`writes ${address}`, async function () {
            const client = await connectedClient(address);
            const result = await client.setValue('t1', 1);
            assert.strictEqual(result, true);
            assert.deepStrictEqual(writes, [{ address, value: 1 }]);
        });
    }
});
