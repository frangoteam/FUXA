'use strict';

const assert = require('assert');
const EventEmitter = require('events');
const Module = require('module');

describe('melsec frame option', function () {
    let melsec;
    let calls;
    let originalLoad;

    before(function () {
        calls = [];
        function FakeMcProtocol() { }
        FakeMcProtocol.prototype.initiateConnection = function (params, callback) {
            calls.push(params);
            setImmediate(() => callback());
        };
        FakeMcProtocol.prototype.setTranslationCB = function () { };
        FakeMcProtocol.prototype.addItems = function () { };
        FakeMcProtocol.prototype.dropConnection = function () { };
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

    function connectWith(property) {
        const logger = { info() { }, warn() { }, error() { } };
        const client = melsec.create({ id: 'plc', name: 'PLC', property, tags: {} }, logger, new EventEmitter(), null, {});
        return client.connect().then(() => calls[calls.length - 1]);
    }

    it('passes frame 3E to mcprotocol when selected', async function () {
        const params = await connectWith({ address: '192.168.0.2:5000', frame: '3E' });
        assert.strictEqual(params.frame, '3E');
        assert.strictEqual(params.host, '192.168.0.2');
        assert.strictEqual(params.port, 5000);
    });

    it('keeps frame 1E by default (existing projects)', async function () {
        const params = await connectWith({ address: '192.168.0.2:1281' });
        assert.strictEqual(params.frame, '1E');
    });

    it('falls back to 1E for an unknown frame value', async function () {
        const params = await connectWith({ address: '192.168.0.2', frame: '4E' });
        assert.strictEqual(params.frame, '1E');
    });
});
