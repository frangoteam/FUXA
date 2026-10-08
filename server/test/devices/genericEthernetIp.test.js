'use strict';

const assert = require('assert');
const EventEmitter = require('events');
const driver = require('../../runtime/devices/genericethernetip');

describe('Generic EtherNet/IP device', function () {
    it('reads symbolic tag values as enumerable device values', async function () {
        class FakeController extends EventEmitter {
            async connect() { this.established_conn = true; }
            async disconnect() { this.established_conn = false; }
            newTag(name, program, dataType) { return { name, program, dataType, value: null }; }
            async readTagGroup(group) { group.tags.forEach(tag => { tag.value = 42; }); }
        }
        class FakeTagGroup {
            constructor() { this.tags = []; }
            add(tag) { this.tags.push(tag); }
            forEach(callback) { this.tags.forEach(callback); }
        }
        class FakeTag {
            constructor(name, program, dataType) {
                this.name = name;
                this.program = program;
                this.dataType = dataType;
                this.value = null;
            }
        }
        const events = new EventEmitter();
        const received = [];
        events.on('device-value:changed', event => received.push(event));
        const device = driver.create({
            id: 'device-1', name: 'PLC', property: { address: '127.0.0.1' },
            tags: {
                'tag-1': {
                    id: 'tag-1', name: 'Counter', address: 'Counter', type: 'number',
                    enipOptions: { tagType: 0, symbolicOpt: {} }
                }
            }
        }, { error() {}, debug() {}, info() {}, warn() {} }, events,
        { require: () => ({ Controller: FakeController, Tag: FakeTag, TagGroup: FakeTagGroup }) }, {});

        device.load({
            id: 'device-1', name: 'PLC', property: { address: '127.0.0.1' },
            tags: {
                'tag-1': {
                    id: 'tag-1', name: 'Counter', address: 'Counter', type: 'number',
                    enipOptions: { tagType: 0, symbolicOpt: {} }
                }
            }
        });
        await device.connect();
        await device.polling();

        assert.strictEqual(device.getValues()['tag-1'].value, 42);
        assert.strictEqual(received.length, 1);
        assert.strictEqual(Object.values(received[0].values).length, 1);
        assert.strictEqual(typeof device.lastReadTimestamp(), 'number');
        await device.disconnect();
    });
});
