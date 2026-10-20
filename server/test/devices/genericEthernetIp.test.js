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

    it('supports the npm scanner API that binds on construction', async function () {
        class FakeController extends EventEmitter {
            async connect() { this.established_conn = true; }
            async disconnect() { this.established_conn = false; }
        }
        class FakeScanner {
            constructor() {
                this.connections = [];
                this.socket = new EventEmitter();
                this.socket.listening = false;
                this.socket.close = callback => {
                    this.socket.listening = false;
                    process.nextTick(callback);
                };
                process.nextTick(() => {
                    this.socket.listening = true;
                    this.socket.emit('listening');
                });
            }
            addConnection(_config, _rpi, _address, _port) {
                const ioConnection = new EventEmitter();
                ioConnection.connected = false;
                ioConnection.run = true;
                ioConnection.id = 'module-1';
                ioConnection.tcpController = new EventEmitter();
                ioConnection.tcpController.timeout_sp = 1000;
                ioConnection.tcpController.disconnect = async () => {};
                ioConnection.addInputInt = () => {};
                ioConnection.addInputBit = () => {};
                ioConnection.addOutputInt = () => {};
                ioConnection.addOutputBit = () => {};
                ioConnection.getValue = () => 321;
                ioConnection.setValue = () => {};
                this.connections.push(ioConnection);
                setTimeout(() => {
                    ioConnection.connected = true;
                    ioConnection.emit('connected');
                }, 20);
                return ioConnection;
            }
        }

        const data = {
            id: 'device-io', name: 'PLC I/O', property: { address: '127.0.0.1', ioport: 2222 },
            modules: {
                'module-1': {
                    id: 'module-1', rpi: 10,
                    configurationInstance: 102, configurationSize: 0,
                    outputInstance: 100, outputSize: 4,
                    inputInstance: 101, inputSize: 4
                }
            },
            tags: {
                'io-input': {
                    id: 'io-input', name: 'Input', type: 'number',
                    enipOptions: {
                        tagType: 2,
                        ioOpt: { ioModuleId: 'module-1', ioType: 1, ioByteOffset: 0, ioOutput: false }
                    }
                }
            }
        };
        const driverPath = require.resolve('../../runtime/devices/genericethernetip');
        delete require.cache[driverPath];
        const npmCompatibleDriver = require(driverPath);
        const device = npmCompatibleDriver.create(data, { error() {}, debug() {}, info() {}, warn() {} },
            new EventEmitter(), {
                require: () => ({ Controller: FakeController, IO: { Scanner: FakeScanner } })
            }, {});
        device.load(data);

        await device.connect();
        assert.strictEqual(device.isConnected(), true);
        await device.polling();
        assert.strictEqual(device.getValues()['io-input'].value, 321);
        await device.disconnect();
        assert.strictEqual(!!device.isConnected(), false);
    });
});
