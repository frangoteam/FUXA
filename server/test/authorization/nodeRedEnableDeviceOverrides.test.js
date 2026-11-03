'use strict';

const assert = require('node:assert/strict');
const registerNode = require('../../integrations/node-red/node-red-contrib-fuxa/nodes/fuxa-enable-device');
const { createNodeRedRuntimeHelpers } = require('../../integrations/node-red');

function createNode(config, enableDevice = async () => true) {
    const calls = [];
    const sent = [];
    const errors = [];
    let Constructor;
    const RED = {
        settings: {
            functionGlobalContext: {
                fuxa: {
                    async enableDevice(...args) {
                        calls.push(args);
                        return enableDevice(...args);
                    },
                },
            },
        },
        nodes: {
            createNode(node) {
                node.on = (event, handler) => {
                    if (event === 'input') node.input = handler;
                };
                node.send = msg => sent.push(msg);
                node.error = (error, msg) => errors.push({ error, msg });
            },
            registerType(name, ctor) {
                assert.equal(name, 'enable-device');
                Constructor = ctor;
            },
        },
    };
    registerNode(RED);
    return { node: new Constructor(config), calls, sent, errors };
}

describe('Node-RED enable-device message overrides', () => {
    it('honors a false message override of the configured enabled checkbox', async () => {
        const { node, calls } = createNode({ deviceName: 'Configured PLC', enabled: true });
        await node.input({ enabled: false });
        assert.deepEqual(calls, [['Configured PLC', false]]);
    });

    it('honors a true message override of a disabled configuration', async () => {
        const { node, calls } = createNode({ deviceName: 'Configured PLC', enabled: false });
        await node.input({ enabled: true });
        assert.deepEqual(calls, [['Configured PLC', true]]);
    });

    it('targets the message device instead of the configured device', async () => {
        const { node, calls } = createNode({ deviceName: 'Configured PLC', enabled: false });
        await node.input({ deviceName: 'Message PLC' });
        assert.deepEqual(calls, [['Message PLC', false]]);
    });

    it('applies both documented overrides in the same message', async () => {
        const { node, calls } = createNode({ deviceName: 'Configured PLC', enabled: true });
        await node.input({ deviceName: 'Message PLC', enabled: false });
        assert.deepEqual(calls, [['Message PLC', false]]);
    });

    it('retains both configured boolean values when no override is supplied', async () => {
        for (const enabled of [false, true]) {
            const { node, calls } = createNode({ deviceName: 'Configured PLC', enabled });
            await node.input({});
            assert.deepEqual(calls, [['Configured PLC', enabled]]);
        }
    });

    it('continues to support message-only flows including false', async () => {
        for (const enabled of [false, true]) {
            const { node, calls } = createNode({});
            await node.input({ deviceName: 'Message PLC', enabled });
            assert.deepEqual(calls, [['Message PLC', enabled]]);
        }
    });

    it('keeps the existing enabled default when neither source supplies a value', async () => {
        const { node, calls } = createNode({ deviceName: 'Configured PLC' });
        await node.input({});
        assert.deepEqual(calls, [['Configured PLC', true]]);
    });

    it('falls back to the configured device for an empty message device name', async () => {
        const { node, calls } = createNode({ deviceName: 'Configured PLC', enabled: false });
        await node.input({ deviceName: '' });
        assert.deepEqual(calls, [['Configured PLC', false]]);
    });

    it('forwards message values unchanged for the device manager to normalize', async () => {
        for (const enabled of ['false', 'true']) {
            const { node, calls } = createNode({});
            await node.input({ deviceName: 'Message PLC', enabled });
            assert.deepEqual(calls, [['Message PLC', enabled]]);
        }
    });

    it('reports a missing device without issuing a command or emitting output', async () => {
        const { node, calls, sent, errors } = createNode({ enabled: true });
        const msg = { enabled: false };
        await node.input(msg);
        assert.deepEqual(calls, []);
        assert.deepEqual(sent, []);
        assert.deepEqual(errors, [{ error: 'Device name not specified', msg }]);
    });

    it('awaits the helper result and preserves the original message', async () => {
        const result = { accepted: true };
        const { node, sent, errors } = createNode({ deviceName: 'Configured PLC' }, async () => result);
        const msg = { _msgid: 'enable-device-regression', topic: 'maintenance', payload: 'old' };
        await node.input(msg);
        assert.equal(sent[0], msg);
        assert.equal(msg.payload, result);
        assert.equal(msg.topic, 'maintenance');
        assert.deepEqual(errors, []);
    });

    it('reports a rejected helper against the original message without output', async () => {
        const failure = new Error('synthetic device command failure');
        const { node, sent, errors } = createNode({ deviceName: 'Configured PLC' }, async () => {
            throw failure;
        });
        const msg = { enabled: false };
        await node.input(msg);
        assert.deepEqual(sent, []);
        assert.deepEqual(errors, [{ error: failure, msg }]);
    });

    it('forwards successive overrides through the runtime helper without changing configuration', async () => {
        const commands = [];
        const helpers = createNodeRedRuntimeHelpers({}, {
            enableDevice(deviceName, enabled) {
                commands.push({ deviceName, enabled });
            },
        });
        const config = { deviceName: 'Configured PLC', enabled: true };
        const { node, sent, errors } = createNode(config, helpers.enableDevice);
        await node.input({ deviceName: 'Message PLC', enabled: false });
        await node.input({});
        assert.deepEqual(commands, [
            { deviceName: 'Message PLC', enabled: false },
            { deviceName: 'Configured PLC', enabled: true },
        ]);
        assert.deepEqual(config, { deviceName: 'Configured PLC', enabled: true });
        assert.deepEqual(sent.map(msg => msg.payload), [true, true]);
        assert.deepEqual(errors, []);
    });
});
