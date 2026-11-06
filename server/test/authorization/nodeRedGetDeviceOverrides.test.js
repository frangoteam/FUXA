'use strict';

const assert = require('node:assert/strict');
const registerNode = require('../../integrations/node-red/node-red-contrib-fuxa/nodes/fuxa-get-device');
const { createNodeRedRuntimeHelpers } = require('../../integrations/node-red');

function createNode(config, getDevice = async () => ({ name: 'fixture' })) {
    const calls = [];
    const sent = [];
    const errors = [];
    let Constructor;
    const RED = {
        settings: { functionGlobalContext: { fuxa: {
            async getDevice(...args) {
                calls.push(args);
                return getDevice(...args);
            },
        } } },
        nodes: {
            createNode(node) {
                node.on = (event, handler) => {
                    if (event === 'input') node.input = handler;
                };
                node.send = msg => sent.push(msg);
                node.error = (error, msg) => errors.push({ error, msg });
            },
            registerType(name, ctor) {
                assert.equal(name, 'get-device');
                Constructor = ctor;
            },
        },
    };
    registerNode(RED);
    return { node: new Constructor(config), calls, sent, errors };
}

describe('Node-RED get-device message overrides', () => {
    it('honors a false message override of the configured include-tags checkbox', async () => {
        const { node, calls } = createNode({ deviceName: 'Configured PLC', includeTags: true });
        await node.input({ includeTags: false });
        assert.deepEqual(calls, [['Configured PLC', false]]);
    });

    it('honors a true message override of a tag-free configuration', async () => {
        const { node, calls } = createNode({ deviceName: 'Configured PLC', includeTags: false });
        await node.input({ includeTags: true });
        assert.deepEqual(calls, [['Configured PLC', true]]);
    });

    it('targets the message device instead of the configured device', async () => {
        const { node, calls } = createNode({ deviceName: 'Configured PLC', includeTags: false });
        await node.input({ deviceName: 'Message PLC' });
        assert.deepEqual(calls, [['Message PLC', false]]);
    });

    it('applies both documented overrides in the same message', async () => {
        const { node, calls } = createNode({ deviceName: 'Configured PLC', includeTags: true });
        await node.input({ deviceName: 'Message PLC', includeTags: false });
        assert.deepEqual(calls, [['Message PLC', false]]);
    });

    it('retains configured boolean values when the message supplies no override', async () => {
        for (const includeTags of [false, true]) {
            const { node, calls } = createNode({ deviceName: 'Configured PLC', includeTags });
            await node.input({ includeTags: undefined });
            assert.deepEqual(calls, [['Configured PLC', includeTags]]);
        }
    });

    it('continues to support message-only flows including false', async () => {
        for (const includeTags of [false, true]) {
            const { node, calls } = createNode({});
            await node.input({ deviceName: 'Message PLC', includeTags });
            assert.deepEqual(calls, [['Message PLC', includeTags]]);
        }
    });

    it('keeps the default of including tags when neither source supplies a value', async () => {
        const { node, calls } = createNode({ deviceName: 'Configured PLC' });
        await node.input({});
        assert.deepEqual(calls, [['Configured PLC', true]]);
    });

    it('falls back to the configured device for an empty message device name', async () => {
        const { node, calls } = createNode({ deviceName: 'Configured PLC', includeTags: false });
        await node.input({ deviceName: '' });
        assert.deepEqual(calls, [['Configured PLC', false]]);
    });

    it('reports a missing device without a lookup or output', async () => {
        const { node, calls, sent, errors } = createNode({ includeTags: true });
        const msg = { includeTags: false };
        await node.input(msg);
        assert.deepEqual(calls, []);
        assert.deepEqual(sent, []);
        assert.deepEqual(errors, [{ error: 'Device name not specified', msg }]);
    });

    it('awaits the helper result and preserves the original message', async () => {
        let resolve;
        const result = { name: 'fixture', tags: [] };
        const { node, sent, errors } = createNode({ deviceName: 'Configured PLC' }, () => new Promise(done => { resolve = done; }));
        const msg = { _msgid: 'get-device-regression', topic: 'inspection', payload: 'old' };
        const pending = node.input(msg);
        assert.deepEqual(sent, []);
        resolve(result);
        await pending;
        assert.equal(sent[0], msg);
        assert.equal(msg.payload, result);
        assert.equal(msg.topic, 'inspection');
        assert.deepEqual(errors, []);
    });

    it('reports a rejected helper against the original message without output', async () => {
        const failure = new Error('synthetic device lookup failure');
        const { node, sent, errors } = createNode({ deviceName: 'Configured PLC' }, async () => { throw failure; });
        const msg = { includeTags: false };
        await node.input(msg);
        assert.deepEqual(sent, []);
        assert.deepEqual(errors, [{ error: failure, msg }]);
    });

    it('reads successive selected summaries through the real helper without changing configuration', async () => {
        const devices = {
            'Configured PLC': { id: 'configured', name: 'Configured PLC', type: 'S7', enabled: false,
                tags: { a: { id: 'a', name: 'Pressure', value: 123 } } },
            'Message PLC': { id: 'message', name: 'Message PLC', type: 'Modbus', enabled: true,
                tags: { b: { id: 'b', name: 'Flow', value: 456 } } },
        };
        const lookups = [];
        const helpers = createNodeRedRuntimeHelpers({ project: { getDevice(name) {
            lookups.push(name);
            return devices[name];
        } } }, { getDevicesStatus: () => ({ configured: 'OFF', message: 'ON' }) });
        const config = { deviceName: 'Configured PLC', includeTags: true };
        const { node, sent, errors } = createNode(config, helpers.getDevice);
        await node.input({ deviceName: 'Message PLC', includeTags: false });
        await node.input({});
        assert.deepEqual(lookups, ['Message PLC', 'Configured PLC']);
        assert.deepEqual(sent.map(msg => msg.payload), [
            { id: 'message', name: 'Message PLC', type: 'Modbus', enabled: true, status: 'ON' },
            { id: 'configured', name: 'Configured PLC', type: 'S7', enabled: false, status: 'OFF',
                tags: [{ id: 'a', name: 'Pressure' }] },
        ]);
        assert.deepEqual(config, { deviceName: 'Configured PLC', includeTags: true });
        assert.deepEqual(errors, []);
    });

    it('preserves a null result from the real helper for an unknown device', async () => {
        const helpers = createNodeRedRuntimeHelpers({ project: { getDevice: () => null } }, {});
        const { node, sent, errors } = createNode({}, helpers.getDevice);
        const msg = { deviceName: 'Missing PLC' };
        await node.input(msg);
        assert.equal(sent[0], msg);
        assert.equal(msg.payload, null);
        assert.deepEqual(errors, []);
    });
});
