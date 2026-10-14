'use strict';

const assert = require('assert').strict;
const EventEmitter = require('events');
const Module = require('module');
const sinon = require('sinon');
const deviceUtils = require('../../runtime/devices/device-utils');

describe('OPC UA subscription arrays', () => {
    let sandbox;
    let device;
    let monitoredItem;
    let events;
    let daq;
    const arrayType = { Scalar: 0, Array: 1, Matrix: 2 };
    const dataType = { Int64: 8, UInt64: 9, Double: 11, String: 12, ByteString: 15, ExtensionObject: 22 };

    beforeEach(async () => {
        sandbox = sinon.createSandbox();
        monitoredItem = new EventEmitter();
        const subscription = { monitor: sandbox.stub().resolves(monitoredItem) };
        const session = new EventEmitter();
        session.createSubscription2 = sandbox.stub().callsArgWith(1, null, subscription);
        const client = new EventEmitter();
        client.connect = sandbox.stub().callsArgWith(1, null);
        client.createSession = sandbox.stub().callsArgWith(1, null, session);
        const originalLoad = Module._load;
        sandbox.stub(Module, '_load').callsFake(function (request, parent, isMain) {
            if (request === 'node-opcua' && parent.filename === require.resolve('../../runtime/devices/opcua')) {
                return {
                    OPCUAClient: { create: () => client }, AttributeIds: { Value: 13 },
                    DataType: dataType, VariantArrayType: arrayType, TimestampsToReturn: { Both: 2 }
                };
            }
            return originalLoad.apply(this, arguments);
        });
        delete require.cache[require.resolve('../../runtime/devices/opcua')];
        events = new EventEmitter();
        daq = sandbox.spy();
        device = require('../../runtime/devices/opcua').create({
            id: 'test', name: 'Array test', property: { address: 'opc.tcp://test:4840' },
            tags: { recipe: { name: 'Recipe', type: 'Double', address: 'ns=1;s=Recipe', daq: { enabled: true, changed: true } } }
        }, { info() {}, warn() {}, error() {} }, events, null, {});
        device.bindAddDaq(daq);
        await device.connect();
        await device.polling();
        await new Promise(resolve => setImmediate(resolve));
    });

    afterEach(() => {
        sandbox.restore();
        delete require.cache[require.resolve('../../runtime/devices/opcua')];
    });

    async function receive(value, type = dataType.Double, rank = arrayType.Array) {
        const emitted = sandbox.spy();
        events.on('device-value:changed', emitted);
        monitoredItem.emit('changed', {
            value: { value, dataType: type, arrayType: rank },
            serverTimestamp: new Date('2026-10-08T00:00:00Z')
        });
        await device.polling();
        assert.equal(emitted.callCount, 1);
        assert.equal(daq.callCount, 1);
        assert.deepEqual(emitted.firstCall.args[0].values.recipe.value, device.getValue('recipe').value);
        assert.deepEqual(daq.firstCall.args[0].recipe.value, device.getValue('recipe').value);
        return device.getValue('recipe').value;
    }

    it('preserves every structured recipe item through polling, events and DAQ', async () => {
        const value = [{ id: 1, name: 'First' }, { id: 83, name: 'Last' }];
        assert.deepEqual(await receive(value, dataType.ExtensionObject), value);
    });

    it('preserves multi-element numeric arrays instead of taking the final value', async () => {
        assert.deepEqual(await receive([10, 20, 30]), [10, 20, 30]);
    });

    it('keeps a one-element numeric array as an array', async () => {
        assert.deepEqual(await receive([42]), [42]);
    });

    it('preserves an empty array', async () => {
        assert.deepEqual(await receive([]), []);
    });

    it('preserves typed numeric arrays, including one element', async () => {
        const value = new Float64Array([42]);
        assert.deepEqual(await receive(value), value);
    });

    it('preserves the flattened values of matrix variants', async () => {
        assert.deepEqual(await receive([1, 2, 3, 4], dataType.Double, arrayType.Matrix), [1, 2, 3, 4]);
    });

    it('does not mistake UInt64 arrays of word pairs for scalar word pairs', async () => {
        const value = [[0, 10], [1, 20]];
        assert.deepEqual(await receive(value, dataType.UInt64), value);
    });

    it('preserves scalar numbers', async () => {
        assert.equal(await receive(42, dataType.Double, arrayType.Scalar), 42);
    });

    it('preserves existing scalar UInt64 word-pair handling', async () => {
        assert.equal(await receive([0, 42], dataType.UInt64, arrayType.Scalar), 42);
    });
});

describe('Collection value composition', () => {
    it('does not apply scalar scale, format or deadband to arrays', async () => {
        const tag = { type: 'Double', format: 1, deadband: { value: 100 }, scale: {
            mode: 'linear', rawLow: 0, rawHigh: 100, scaledLow: 0, scaledHigh: 10
        } };
        assert.deepEqual(await deviceUtils.tagValueCompose([42], 41, tag), [42]);
        assert.deepEqual(await deviceUtils.tagValueCompose(new Float64Array([42]), 41, tag), new Float64Array([42]));
    });

    it('still passes collections to configured read scripts', async () => {
        const input = [{ id: 1 }, { id: 2 }];
        const runtime = { scriptsMgr: { runScript: async script => {
            assert.deepEqual(script.parameters[0].value, input);
            return [42];
        } } };
        assert.deepEqual(await deviceUtils.tagValueCompose(input, null, {
            type: 'Double', scaleReadFunction: 'transform'
        }, runtime), [42]);
    });

    it('keeps scalar numeric conversion and scaling', async () => {
        assert.equal(await deviceUtils.tagValueCompose('42', null, { type: 'Double' }), 42);
        assert.equal(await deviceUtils.tagValueCompose(42, null, { type: 'Double', scale: {
            mode: 'linear', rawLow: 0, rawHigh: 100, scaledLow: 0, scaledHigh: 10
        } }), 4.2);
        assert.equal(await deviceUtils.tagValueCompose('42', null, { type: 'String' }), '42');
    });
});
