'use strict';
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');
const Module = require('node:module');
const sinon = require('sinon');

describe('GPIO interrupt tag ownership', function () {
    let sandbox, pins, driver, device, logger, events, updates, save;
    beforeEach(function () {
        sandbox = sinon.createSandbox();
        sandbox.useFakeTimers({ now: 1700000000000, toFake: ['Date'] });
        pins = new Map();
        class ControlledGpio {
            constructor(address) { this.address = address; pins.set(address, this); }
            watch(callback) { this.callback = callback; }
            readSync() { return 0; }
            unexport() {}
        }
        const filename = require.resolve('../../runtime/devices/gpio');
        delete require.cache[filename];
        const originalLoad = Module._load;
        sandbox.stub(Module, '_load').callsFake(function (request, parent) {
            if (request === 'onoff' && parent.filename === filename) return { Gpio: ControlledGpio };
            return originalLoad.apply(this, arguments);
        });
        driver = require(filename);
        logger = { info() {}, error: sandbox.spy() };
        events = new EventEmitter();
        updates = [];
        events.on('device-value:changed', update => {
            updates.push({ id: update.id, values: Object.values(update.values).map(value => ({ ...value })) });
        });
        save = sandbox.spy();
    });
    afterEach(async function () {
        try { if (device) await device.disconnect(); }
        finally {
            sandbox.restore();
            delete require.cache[require.resolve('../../runtime/devices/gpio')];
        }
    });
    function load(lastEdge = 'both') {
        const data = { id: 'gpio-device', name: 'Controlled GPIO', tags: {} };
        for (const [index, id] of ['first', 'second', 'last'].entries()) {
            data.tags[id] = { id, name: id, address: 10 + index, direction: 'in',
                edge: id === 'last' ? lastEdge : 'both', daq: { enabled: true, changed: true } };
        }
        const original = JSON.stringify(data);
        device = driver.create(data, logger, events);
        device.bindAddDaq(save);
        device.load(data);
        assert.equal(JSON.stringify(data), original, 'caller configuration must stay unchanged');
    }
    for (const [address, id] of [[10, 'first'], [11, 'second'], [12, 'last']]) {
        it(`routes the ${id} pin interrupt to its own cache, event and DAQ entry`, function () {
            load();
            pins.get(address).callback(null, 1);
            assert.deepEqual(Object.keys(device.getValues()), [id]);
            assert.deepEqual(device.getValue(id), { id, value: 1, ts: 1700000000000 });
            assert.equal(updates.length, 1);
            assert.equal(updates[0].id, 'gpio-device');
            assert.equal(updates[0].values[0].id, id);
            sinon.assert.calledOnce(save);
            assert.deepEqual(Object.keys(save.firstCall.args[0]), [id]);
            assert.equal(save.firstCall.args[0][id].value, 1);
            assert.deepEqual(save.firstCall.args.slice(1), ['Controlled GPIO', 'gpio-device']);
        });
    }
    for (const [address, id] of [[10, 'first'], [12, 'last']]) {
        it(`attributes the ${id} pin watch error without updating values`, function () {
            load();
            const error = new Error('controlled GPIO read failure');
            pins.get(address).callback(error);
            sinon.assert.calledOnceWithExactly(logger.error, `read gpio[${id}] err`, error);
            assert.deepEqual(Object.keys(device.getValues()), []);
            sinon.assert.notCalled(save);
            assert.equal(updates.length, 0);
        });
    }
    it('retains the interrupt owner when the final tag is polling-only', function () {
        load('none');
        assert.equal(pins.get(12).callback, undefined);
        pins.get(10).callback(null, 0);
        assert.deepEqual(Object.keys(device.getValues()), ['first']);
        assert.equal(device.getValue('first').value, 0);
    });
    it('keeps repeated transitions on the originating tag, including zero', function () {
        load();
        pins.get(10).callback(null, 1);
        pins.get(10).callback(null, 0);
        assert.equal(device.getValue('first')?.value, 0);
        assert.equal(device.getValue('last'), null);
        assert.deepEqual(updates.map(x => x.values[0].value), [1, 0]);
        assert.equal(save.callCount, 2);
    });
    it('preserves polling-only reads for all configured pins', async function () {
        load('none');
        await device.polling();
        assert.deepEqual(Object.keys(device.getValues()).sort(), ['first', 'last', 'second']);
        for (const id of ['first', 'second', 'last']) assert.equal(device.getValue(id).value, 0);
    });
});
