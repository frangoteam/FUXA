'use strict';

const assert = require('assert').strict;
const EventEmitter = require('events');
const { cloneMessage } = require('@node-red/util').util;
const register = require('../../integrations/node-red/node-red-contrib-fuxa/nodes/fuxa-get-tag-change');

describe('Node-RED tag change values', () => {
    let events;
    let node;
    let value;

    function create(initialValue, config = { tagId: 'tag-1', tag: 'Recipe' }, cloneSent = true) {
        value = initialValue;
        events = new EventEmitter();
        const fuxa = {
            runtime: { events },
            getTag: id => {
                assert.equal(id, 'tag-1');
                return value;
            },
            getTagId: name => {
                assert.equal(name, 'Recipe');
                return 'tag-1';
            },
        };
        let Constructor;
        register({
            settings: { functionGlobalContext: { fuxa } },
            util: { cloneMessage },
            nodes: {
                registerType(type, ctor) { Constructor = ctor; },
                createNode(target) {
                    const emitter = new EventEmitter();
                    target.on = emitter.on.bind(emitter);
                    target.emit = emitter.emit.bind(emitter);
                    target.messages = [];
                    target.send = msg => target.messages.push(cloneSent ? cloneMessage(msg) : msg);
                },
            },
        });
        node = new Constructor(config);
    }

    function update(nextValue, tagId = 'tag-1') {
        value = nextValue;
        events.emit('device-value:changed', {
            id: 'device-1', values: { [tagId]: { value: nextValue, timestamp: '2026-10-15T00:00:00Z' } },
        });
    }

    afterEach(() => {
        if (node) node.emit('close', () => {});
    });

    it('does not emit again when a poll supplies an equal array instance', () => {
        create([10, 20]);
        update([10, 20]);
        assert.equal(node.messages.length, 0);
    });

    it('detects in-place array changes and retains the previous contents', () => {
        const values = [10, 20];
        create(values);
        values[1] = 30;
        update(values);
        assert.equal(node.messages.length, 1);
        assert.deepEqual(node.messages[0].payload, [10, 30]);
        assert.deepEqual(node.messages[0].previousValue, [10, 20]);
        assert.equal(node.messages[0].tagId, 'tag-1');
        assert.equal(node.messages[0].topic, 'Recipe');
        assert.equal(node.messages[0].timestamp, '2026-10-15T00:00:00Z');
        update([10, 30]);
        assert.equal(node.messages.length, 1);
    });

    it('compares nested recipe values and snapshots each emitted value', () => {
        create([{ id: 1, setpoints: [20, 30] }]);
        update([{ id: 1, setpoints: [20, 30] }]);
        assert.equal(node.messages.length, 0);
        const next = [{ id: 1, setpoints: [20, 40] }];
        update(next);
        next[0].setpoints[0] = 25;
        update(next);
        assert.equal(node.messages.length, 2);
        assert.deepEqual(node.messages[1].previousValue, [{ id: 1, setpoints: [20, 40] }]);
    });

    for (const [name, make] of [
        ['typed numeric arrays', values => new Float64Array(values)],
        ['ByteString buffers', values => Buffer.from(values)],
    ]) {
        it(`compares and snapshots ${name} without converting their type`, () => {
            const values = make([10, 20]);
            create(values);
            update(make([10, 20]));
            assert.equal(node.messages.length, 0);
            values[0] = 30;
            update(values);
            assert.equal(node.messages.length, 1);
            assert.deepEqual(node.messages[0].payload, make([30, 20]));
            assert.deepEqual(node.messages[0].previousValue, make([10, 20]));
        });
    }

    it('preserves scalar changes including zero, false and null', () => {
        create(0);
        for (const next of [0, false, false, null, null, 0]) update(next);
        assert.deepEqual(node.messages.map(msg => msg.payload), [false, null, 0]);
        assert.deepEqual(node.messages.map(msg => msg.previousValue), [0, false, null]);
    });

    it('detaches ByteStrings nested inside structured arrays', () => {
        const values = [{ bytes: Buffer.from([10, 20]) }];
        create(values);
        values[0].bytes[0] = 30;
        update(values);
        assert.equal(node.messages.length, 1);
        assert.deepEqual(node.messages[0].previousValue, [{ bytes: Buffer.from([10, 20]) }]);
    });

    it('keeps legacy tag-name lookup and the first defined value', () => {
        create(undefined, { tag: 'Recipe' });
        update([1]);
        assert.equal(node.messages.length, 1);
        assert.deepEqual(node.messages[0].payload, [1]);
        assert.equal(node.messages[0].previousValue, undefined);
    });


    for (const [name, make, mutate] of [
        ['arrays', n => [n], (v, n) => { v[0] = n; }],
        ['typed arrays', n => new Float64Array([n]), (v, n) => { v[0] = n; }],
        ['ByteStrings', n => Buffer.from([n]), (v, n) => { v[0] = n; }],
        ['nested ByteStrings', n => [{ bytes: Buffer.from([n]) }], (v, n) => { v[0].bytes[0] = n; }],
    ]) {
        it(`isolates ${name} sent to the first wire from live tag mutations`, () => {
            // Node-RED passes the first wired message without cloning it.
            create(make(10), undefined, false);
            const live = make(20);
            update(live);
            mutate(live, 30);
            assert.deepEqual(node.messages[0].payload, make(20));
            update(live);
            assert.equal(node.messages.length, 2);
            assert.deepEqual(node.messages[1].previousValue, make(20));
            mutate(node.messages[1].payload, 99);
            assert.deepEqual(live, make(30));
            update(live);
            assert.equal(node.messages.length, 2);
        });
    }

    it('does not emit repeated scalar NaN reads', () => {
        create(NaN);
        update(NaN); update(Number('invalid'));
        assert.equal(node.messages.length, 0);
    });

    it('emits once when a finite value becomes NaN', () => {
        create(12);
        update(NaN); update(NaN);
        assert.equal(node.messages.length, 1);
        assert.ok(Number.isNaN(node.messages[0].payload));
        assert.equal(node.messages[0].previousValue, 12);
    });

    it('emits once when NaN recovers to a finite value', () => {
        create(NaN);
        update(NaN); update(12); update(12);
        assert.equal(node.messages.length, 1);
        assert.equal(node.messages[0].payload, 12);
        assert.ok(Number.isNaN(node.messages[0].previousValue));
    });

    it('retains equal signed-zero behavior', () => {
        create(0);
        update(-0); update(0);
        assert.equal(node.messages.length, 0);
    });

    it('retains infinite-value transitions', () => {
        create(Infinity);
        update(Infinity); update(-Infinity); update(-Infinity); update(0);
        assert.deepEqual(node.messages.map(msg => msg.payload), [-Infinity, 0]);
    });

    it('ignores other tags and removes the listener on close', () => {
        create([1]);
        update([2], 'other-tag');
        assert.equal(node.messages.length, 0);
        assert.equal(events.listenerCount('device-value:changed'), 1);
        let closed = false;
        node.emit('close', () => { closed = true; });
        assert.equal(closed, true);
        assert.equal(events.listenerCount('device-value:changed'), 0);
        update([2]);
        assert.equal(node.messages.length, 0);
    });
});
