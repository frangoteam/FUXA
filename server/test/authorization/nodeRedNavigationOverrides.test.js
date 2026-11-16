'use strict';

const assert = require('node:assert/strict');
const { createNodeRedRuntimeHelpers } = require('../../integrations/node-red');

for (const [type, property, helper, command, missing] of [
    ['set-view', 'viewName', 'setView', 'SETVIEW', 'View name not specified'],
    ['open-card', 'cardName', 'openCard', 'OPENCARD', 'Card name not specified'],
]) {
    describe(`Node-RED ${type} message overrides`, () => {
        function create(config = {}, options = {}) {
            const calls = [];
            const sent = [];
            const errors = [];
            const handlers = {};
            const helpers = createNodeRedRuntimeHelpers({
                scriptSendCommand(value) {
                    if (options.error) throw options.error;
                    calls.push(value);
                },
            }, {});
            if (options.replaceHelper) helpers[helper] = options.replaceHelper;
            let Constructor;
            require(`../../integrations/node-red/node-red-contrib-fuxa/nodes/fuxa-${type}`)({
                settings: { functionGlobalContext: { fuxa: helpers } },
                nodes: {
                    createNode(node) {
                        node.on = (event, callback) => { handlers[event] = callback; };
                        node.send = msg => sent.push(msg);
                        node.error = (error, msg) => errors.push({ error, msg });
                    },
                    registerType(name, ctor) {
                        assert.equal(name, type);
                        Constructor = ctor;
                    },
                },
            });
            new Constructor(config);
            return { input: msg => handlers.input(msg), calls, sent, errors };
        }

        function expected(name) {
            return { command, params: [name, type === 'open-card' ? {} : undefined] };
        }

        it('uses the message name instead of the configured name', async () => {
            const config = Object.freeze({ [property]: 'Configured overview' });
            const node = create(config);
            const msg = { [property]: 'Requested detail', payload: 'before', topic: 'navigation', extra: { retained: true } };
            await node.input(msg);
            assert.deepEqual(node.calls, [expected('Requested detail')]);
            assert.deepEqual(node.errors, []);
            assert.equal(node.sent.length, 1);
            assert.equal(node.sent[0], msg);
            assert.deepEqual(msg, { [property]: 'Requested detail', payload: true, topic: 'navigation', extra: { retained: true } });
            assert.deepEqual(config, { [property]: 'Configured overview' });
        });

        it('selects each incoming message without changing the saved fallback', async () => {
            const config = Object.freeze({ [property]: 'Configured overview' });
            const node = create(config);
            for (const name of ['First detail', 'Second detail', undefined]) {
                await node.input(name === undefined ? {} : { [property]: name });
            }
            assert.deepEqual(node.calls, [expected('First detail'), expected('Second detail'), expected('Configured overview')]);
            assert.equal(node.sent.length, 3);
            assert.deepEqual(node.errors, []);
            assert.deepEqual(config, { [property]: 'Configured overview' });
        });

        for (const [label, value] of [['absent', undefined], ['empty', ''], ['null', null]]) {
            it(`keeps the configured fallback for an ${label} message name`, async () => {
                const node = create(Object.freeze({ [property]: 'Configured overview' }));
                const msg = value === undefined ? {} : { [property]: value };
                await node.input(msg);
                assert.deepEqual(node.calls, [expected('Configured overview')]);
                assert.deepEqual(node.errors, []);
                assert.equal(node.sent[0], msg);
                assert.equal(msg.payload, true);
            });
        }

        it('supports a message-only name', async () => {
            const node = create();
            const msg = { [property]: 'Requested detail' };
            await node.input(msg);
            assert.deepEqual(node.calls, [expected('Requested detail')]);
            assert.deepEqual(node.errors, []);
            assert.equal(node.sent[0], msg);
            assert.equal(msg.payload, true);
        });

        it('reports a missing name without sending a runtime command', async () => {
            const node = create();
            const msg = { payload: 'retained' };
            await node.input(msg);
            assert.deepEqual(node.calls, []);
            assert.deepEqual(node.sent, []);
            assert.deepEqual(node.errors, [{ error: missing, msg }]);
            assert.equal(msg.payload, 'retained');
        });

        it('reports a command-channel exception with the original message', async () => {
            const error = new Error('controlled command failure');
            const node = create({ [property]: 'Configured overview' }, { error });
            const msg = { payload: 'retained' };
            await node.input(msg);
            assert.deepEqual(node.calls, []);
            assert.deepEqual(node.sent, []);
            assert.equal(node.errors.length, 1);
            assert.equal(node.errors[0].error, error);
            assert.equal(node.errors[0].msg, msg);
            assert.equal(msg.payload, 'retained');
        });

        it('handles an asynchronous helper rejection without sending the message', async () => {
            const error = new Error('controlled async failure');
            const node = create({ [property]: 'Configured overview' }, { replaceHelper: async () => { throw error; } });
            const msg = { payload: 'retained' };
            await node.input(msg);
            assert.deepEqual(node.sent, []);
            assert.equal(node.errors.length, 1);
            assert.equal(node.errors[0].error, error);
            assert.equal(node.errors[0].msg, msg);
            assert.equal(msg.payload, 'retained');
        });

        it('preserves a false helper result in the outgoing payload', async () => {
            const node = create({ [property]: 'Configured overview' }, { replaceHelper: async () => false });
            const msg = { payload: 'before' };
            await node.input(msg);
            assert.deepEqual(node.errors, []);
            assert.equal(node.sent[0], msg);
            assert.equal(msg.payload, false);
        });
    });
}
