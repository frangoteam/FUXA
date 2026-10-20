'use strict';

const assert = require('node:assert/strict');
const registerNode = require('../../integrations/node-red/node-red-contrib-fuxa/nodes/fuxa-ack-alarm');

function createNode(config, ackAlarm = async (alarmName, types) => ({ alarmName, types })) {
    const calls = [];
    const sent = [];
    const errors = [];
    const fuxa = {
        async ackAlarm(...args) {
            calls.push(args);
            return ackAlarm(...args);
        },
    };
    let Constructor;
    const RED = {
        settings: { functionGlobalContext: { fuxa } },
        nodes: {
            createNode(node) {
                node.on = (event, handler) => {
                    if (event === 'input') node.input = handler;
                };
                node.send = msg => sent.push(msg);
                node.error = (error, msg) => errors.push({ error, msg });
            },
            registerType(name, ctor) {
                assert.equal(name, 'ack-alarm');
                Constructor = ctor;
            },
        },
    };
    registerNode(RED);
    return { node: new Constructor(config), calls, sent, errors };
}

describe('Node-RED ack-alarm message overrides', () => {
    it('uses the message alarm name instead of the configured alarm', async () => {
        const fixture = createNode({ alarmName: 'Configured Alarm', types: ['configured'] });
        await fixture.node.input({ alarmName: 'Message Alarm' });
        assert.deepEqual(fixture.calls, [['Message Alarm', ['configured']]]);
    });

    it('uses a message payload alarm name instead of the configured alarm', async () => {
        const fixture = createNode({ alarmName: 'Configured Alarm' });
        await fixture.node.input({ payload: 'Payload Alarm' });
        assert.deepEqual(fixture.calls, [['Payload Alarm', undefined]]);
    });

    it('prefers the explicit message alarm name over the payload fallback', async () => {
        const fixture = createNode({ alarmName: 'Configured Alarm' });
        await fixture.node.input({ alarmName: 'Message Alarm', payload: 'Payload Alarm' });
        assert.deepEqual(fixture.calls, [['Message Alarm', undefined]]);
    });

    it('uses message alarm types instead of the configured types', async () => {
        const fixture = createNode({ alarmName: 'Configured Alarm', types: ['configured'] });
        await fixture.node.input({ types: ['active', 'pending'] });
        assert.deepEqual(fixture.calls, [['Configured Alarm', ['active', 'pending']]]);
    });

    it('preserves an empty message type list as an explicit override', async () => {
        const fixture = createNode({ alarmName: 'Configured Alarm', types: ['configured'] });
        await fixture.node.input({ types: [] });
        assert.deepEqual(fixture.calls, [['Configured Alarm', []]]);
    });

    it('splits and trims a comma-separated message type override', async () => {
        const fixture = createNode({ alarmName: 'Configured Alarm', types: ['configured'] });
        await fixture.node.input({ types: 'active, pending' });
        assert.deepEqual(fixture.calls, [['Configured Alarm', ['active', 'pending']]]);
    });

    it('retains configured values when the message supplies no overrides', async () => {
        const fixture = createNode({ alarmName: 'Configured Alarm', types: 'active, pending' });
        await fixture.node.input({});
        assert.deepEqual(fixture.calls, [['Configured Alarm', ['active', 'pending']]]);
    });

    it('continues to support message-only alarm names', async () => {
        for (const msg of [{ alarmName: 'Message Alarm' }, { payload: 'Payload Alarm' }]) {
            const expected = msg.alarmName || msg.payload;
            const fixture = createNode({});
            await fixture.node.input(msg);
            assert.equal(fixture.calls.length, 1);
            assert.equal(fixture.calls[0][0], expected);
        }
    });

    it('handles successive overrides without changing the configured fallback', async () => {
        const config = { alarmName: 'Configured Alarm', types: ['configured'] };
        const fixture = createNode(config);
        await fixture.node.input({ alarmName: 'Message Alarm', types: ['message'] });
        await fixture.node.input({});
        assert.deepEqual(fixture.calls, [
            ['Message Alarm', ['message']],
            ['Configured Alarm', ['configured']],
        ]);
        assert.deepEqual(config, { alarmName: 'Configured Alarm', types: ['configured'] });
    });

    it('reports a missing alarm name without acknowledging or emitting output', async () => {
        const fixture = createNode({});
        const msg = { types: ['active'] };
        await fixture.node.input(msg);
        assert.deepEqual(fixture.calls, []);
        assert.deepEqual(fixture.sent, []);
        assert.deepEqual(fixture.errors, [{ error: 'Missing alarm name', msg }]);
    });

    it('awaits the acknowledgement and preserves the original message', async () => {
        let resolve;
        const fixture = createNode({ alarmName: 'Configured Alarm' }, () => new Promise(done => { resolve = done; }));
        const msg = { _msgid: 'ack-alarm-regression', topic: 'maintenance', payload: undefined };
        const pending = fixture.node.input(msg);
        assert.deepEqual(fixture.sent, []);
        resolve(false);
        await pending;
        assert.equal(fixture.sent[0], msg);
        assert.equal(msg.payload, false);
        assert.equal(msg.topic, 'maintenance');
        assert.deepEqual(fixture.errors, []);
    });

    it('reports a rejected acknowledgement against the original message without output', async () => {
        const failure = new Error('synthetic acknowledgement failure');
        const fixture = createNode({ alarmName: 'Configured Alarm' }, async () => { throw failure; });
        const msg = {};
        await fixture.node.input(msg);
        assert.deepEqual(fixture.sent, []);
        assert.deepEqual(fixture.errors, [{ error: failure, msg }]);
    });
});
