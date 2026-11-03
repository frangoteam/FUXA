'use strict';

const assert = require('node:assert/strict');
const { cloneMessage } = require('@node-red/util').util;
const register = require('../../integrations/node-red/node-red-contrib-fuxa/nodes/fuxa-get-tag');

describe('Node-RED get-tag payload snapshots', function () {
    function read(value, config = { tagId: 'tag-1', tag: 'Recipe' }, overrides = {}) {
        let Constructor;
        let input;
        const node = { messages: [], errors: [] };
        register({
            util: { cloneMessage },
            settings: { functionGlobalContext: { fuxa: {
                getTagId(name) { assert.equal(name, 'Recipe'); return 'tag-1'; },
                getTag(id) { assert.equal(id, 'tag-1'); return value; },
                ...overrides
            } } },
            nodes: {
                registerType(type, ctor) { assert.equal(type, 'get-tag'); Constructor = ctor; },
                createNode(target) {
                    Object.assign(target, node);
                    target.on = (event, handler) => { assert.equal(event, 'input'); input = handler; };
                    // Node-RED's first wire receives the original message without cloning.
                    target.send = message => node.messages.push(message);
                    target.error = (error, message) => node.errors.push({ error, message });
                }
            }
        });
        new Constructor(Object.freeze(config));
        const message = { topic: 'Recipe', payload: 'old', extra: { trace: 1 } };
        const done = [];
        input(message, undefined, error => done.push(error));
        return { ...node, message, done };
    }

    const mutable = [
        ['array', () => [10, 20], v => { v[1] = 30; }, v => v[1], v => { v[1] = 99; }],
        ['typed array', () => new Float64Array([10, 20]), v => { v[1] = 30; }, v => v[1], v => { v[1] = 99; }],
        ['Buffer', () => Buffer.from([10, 20]), v => { v[1] = 30; }, v => v[1], v => { v[1] = 99; }],
        ['nested object', () => ({ recipe: [10, 20] }), v => { v.recipe[1] = 30; }, v => v.recipe[1], v => { v.recipe[1] = 99; }],
        ['nested Buffer', () => ({ recipe: Buffer.from([10, 20]) }), v => { v.recipe[1] = 30; }, v => v.recipe[1], v => { v.recipe[1] = 99; }]
    ];
    for (const [name, create, changeDriver, element, changeFlow] of mutable) {
        it('isolates the queued ' + name + ' from driver and downstream edits', function () {
            const live = create();
            const result = read(live);
            assert.deepEqual(result.errors, []);
            assert.deepEqual(result.done, [undefined]);
            assert.equal(result.messages[0], result.message);
            assert.equal(result.message.topic, 'Recipe');
            assert.deepEqual(result.message.extra, { trace: 1 });
            changeDriver(live);
            assert.equal(element(result.message.payload), 20);
            changeFlow(result.message.payload);
            assert.equal(element(live), 30);
            assert.equal(element(read(live).message.payload), 30);
        });
    }

    for (const value of [0, false, '', null, undefined, 'Ready']) {
        it('preserves scalar ' + String(value), function () {
            const result = read(value);
            assert.equal(result.message.payload, value);
            assert.deepEqual(result.done, [undefined]);
            assert.deepEqual(result.errors, []);
        });
    }

    it('retains configured ID precedence without a name lookup', function () {
        const result = read(12, { tagId: 'tag-1', tag: 'Recipe' }, { getTagId() { throw new Error('unexpected lookup'); } });
        assert.equal(result.message.payload, 12);
        assert.deepEqual(result.errors, []);
    });

    it('retains topic lookup when no tag is configured', function () {
        assert.equal(read(12, {}).message.payload, 12);
    });

    it('does not send when the selected tag cannot be resolved', function () {
        const result = read(12, {}, { getTagId() { return null; } });
        assert.equal(result.messages.length, 0);
        assert.equal(result.errors[0].error, 'Tag not found: Recipe');
        assert.deepEqual(result.done, [undefined]);
    });

    it('retains read exceptions and done callback errors', function () {
        const error = new Error('read failed');
        const result = read(null, undefined, { getTag() { throw error; } });
        assert.equal(result.messages.length, 0);
        assert.equal(result.errors[0].error, error);
        assert.equal(result.done[0], error);
    });
});
