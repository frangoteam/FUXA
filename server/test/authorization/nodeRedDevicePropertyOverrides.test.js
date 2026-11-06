'use strict';

const assert = require('node:assert/strict');
const { createDevicePropertyHelpers } = require('../../integrations/node-red');

function createNode(type, config, helper = async () => true) {
    const method = type === 'get' ? 'getDeviceProperty' : 'setDeviceProperty';
    const calls = [];
    const sent = [];
    const errors = [];
    let Constructor;
    const RED = {
        settings: {
            functionGlobalContext: {
                fuxa: {
                    async [method](...args) {
                        calls.push(args);
                        return helper(...args);
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
                assert.equal(name, `${type}-device-property`);
                Constructor = ctor;
            },
        },
    };
    require(`../../integrations/node-red/node-red-contrib-fuxa/nodes/fuxa-${type}-device-property`)(RED);
    return { node: new Constructor(config), calls, sent, errors };
}

describe('Node-RED device property message overrides', () => {
    for (const type of ['get', 'set']) {
        const expectedArgs = (device, property, value = 2000) =>
            type === 'get' ? [device, property] : [device, property, value];
        const config = () => ({ deviceName: 'Configured PLC', property: 'timeout', value: 2000 });

        describe(`${type}-device-property`, () => {
            it('targets the message device instead of the configured device', async () => {
                const { node, calls } = createNode(type, config());
                await node.input({ deviceName: 'Message PLC' });
                assert.deepEqual(calls, [expectedArgs('Message PLC', 'timeout')]);
            });

            it('uses the message property instead of the configured property', async () => {
                const { node, calls } = createNode(type, config());
                await node.input({ property: 'cycle' });
                assert.deepEqual(calls, [expectedArgs('Configured PLC', 'cycle')]);
            });

            it('applies both documented selectors in one message', async () => {
                const { node, calls } = createNode(type, config());
                await node.input({ deviceName: 'Message PLC', property: 'cycle' });
                assert.deepEqual(calls, [expectedArgs('Message PLC', 'cycle')]);
            });

            it('retains configured selectors for absent or empty message selectors', async () => {
                for (const msg of [{}, { deviceName: '', property: '' }]) {
                    const { node, calls } = createNode(type, config());
                    await node.input(msg);
                    assert.deepEqual(calls, [expectedArgs('Configured PLC', 'timeout')]);
                }
            });

            it('continues to support message-only selectors', async () => {
                const { node, calls } = createNode(type, {});
                await node.input({ deviceName: 'Message PLC', property: 'cycle', value: 0 });
                assert.deepEqual(calls, [expectedArgs('Message PLC', 'cycle', 0)]);
            });

            it('reports missing selectors without calling the helper or emitting output', async () => {
                for (const msg of [{}, { property: 'timeout' }, { deviceName: 'Message PLC' }]) {
                    const { node, calls, sent, errors } = createNode(type, {});
                    await node.input(msg);
                    assert.deepEqual(calls, []);
                    assert.deepEqual(sent, []);
                    assert.deepEqual(errors, [{ error: 'Device name and property not specified', msg }]);
                }
            });

            it('awaits the helper result and preserves the original message', async () => {
                const result = { accepted: true };
                const { node, sent, errors } = createNode(type, config(), async () => result);
                const msg = { _msgid: 'device-property-regression', topic: 'maintenance' };
                await node.input(msg);
                assert.equal(sent[0], msg);
                assert.equal(msg.payload, result);
                assert.equal(msg.topic, 'maintenance');
                assert.deepEqual(errors, []);
            });

            it('reports a helper rejection against the original message without output', async () => {
                const failure = new Error('synthetic device property failure');
                const { node, sent, errors } = createNode(type, config(), async () => { throw failure; });
                const msg = {};
                await node.input(msg);
                assert.deepEqual(sent, []);
                assert.deepEqual(errors, [{ error: failure, msg }]);
            });
        });
    }

    it('preserves false, zero, empty-string and null write values', async () => {
        for (const value of [false, 0, '', null]) {
            const { node, calls } = createNode('set', { deviceName: 'PLC', property: 'polling', value: true });
            await node.input({ value });
            assert.deepEqual(calls, [['PLC', 'polling', value]]);
        }
    });

    it('reads successive selected devices and properties through the real helper without changing config', async () => {
        const properties = {
            'Configured PLC': { timeout: 1000, cycle: 500 },
            'Message PLC': { timeout: 3000, cycle: 1500 },
        };
        const helpers = createDevicePropertyHelpers({ getDeviceProperty: name => properties[name] });
        const config = { deviceName: 'Configured PLC', property: 'timeout' };
        const { node, sent, errors } = createNode('get', config, helpers.getDeviceProperty);
        await node.input({ deviceName: 'Message PLC', property: 'cycle' });
        await node.input({});
        assert.deepEqual(sent.map(msg => msg.payload), [1500, 1000]);
        assert.deepEqual(config, { deviceName: 'Configured PLC', property: 'timeout' });
        assert.deepEqual(errors, []);
    });

    it('writes only the selected device property through the real helper without changing config', async () => {
        const properties = {
            'Configured PLC': { timeout: 1000, polling: true },
            'Message PLC': { timeout: 3000, polling: true },
        };
        const saves = [];
        const helpers = createDevicePropertyHelpers({
            getDeviceProperty: name => properties[name],
            setDeviceProperty(name, property) {
                saves.push({ name, property: { ...property } });
                return true;
            },
        });
        const config = { deviceName: 'Configured PLC', property: 'timeout', value: 2000 };
        const { node, sent, errors } = createNode('set', config, helpers.setDeviceProperty);
        await node.input({ deviceName: 'Message PLC', property: 'polling', value: false });
        await node.input({});
        assert.deepEqual(saves, [
            { name: 'Message PLC', property: { timeout: 3000, polling: false } },
            { name: 'Configured PLC', property: { timeout: 2000, polling: true } },
        ]);
        assert.deepEqual(config, { deviceName: 'Configured PLC', property: 'timeout', value: 2000 });
        assert.deepEqual(sent.map(msg => msg.payload), [true, true]);
        assert.deepEqual(errors, []);
    });

    for (const type of ['get', 'set']) {
        it(`keeps ${type} message properties subject to the real helper allowlist`, async () => {
            let accessed = false;
            const helpers = createDevicePropertyHelpers({
                getDeviceProperty() { accessed = true; return { timeout: 1000 }; },
                setDeviceProperty() { accessed = true; return true; },
            });
            const method = type === 'get' ? 'getDeviceProperty' : 'setDeviceProperty';
            const blocked = type === 'get' ? ['password', '__proto__'] : ['address', 'password', '__proto__'];
            for (const property of blocked) {
                const { node, sent, errors } = createNode(type,
                    { deviceName: 'PLC', property: 'timeout', value: 2000 }, helpers[method]);
                const msg = { property, value: 0 };
                await node.input(msg);
                assert.deepEqual(sent, []);
                assert.equal(errors.length, 1);
                assert.match(errors[0].error.message, /not (readable|writable)/);
                assert.equal(errors[0].msg, msg);
                assert.equal(accessed, false);
            }
        });
    }
});
