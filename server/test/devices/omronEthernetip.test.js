const EventEmitter = require('events');
const Module = require('module');

describe('Omron EtherNet/IP device driver', () => {
    let driver;
    let MockClient;
    let lastOptions;
    let instances;
    let originalLoad;

    before(async () => {
        const chai = await import('chai');
        global.expect = chai.expect;
    });

    beforeEach(() => {
        delete require.cache[require.resolve('../../runtime/devices/omron-ethernetip')];
        try {
            delete require.cache[require.resolve('../../runtime/utils')];
        } catch (err) {
            // The module may not have been loaded yet.
        }
        originalLoad = Module._load;
        Module._load = function (request, parent, isMain) {
            if (request === 'ip') {
                return {};
            }
            return originalLoad.apply(this, arguments);
        };
        lastOptions = null;
        instances = [];
        MockClient = class {
            constructor(options) {
                lastOptions = options;
                this.closed = false;
                instances.push(this);
            }

            connect() {
                return Promise.resolve();
            }

            readTag(address) {
                return MockClient.readTag(address);
            }

            writeTag(address, value) {
                return MockClient.writeTag(address, value);
            }

            close() {
                this.closed = true;
            }
        };
        MockClient.readTag = () => Promise.resolve({ value: 1, typeName: 'DINT' });
        MockClient.writeTag = () => Promise.resolve();
        driver = require('../../runtime/devices/omron-ethernetip');
    });

    afterEach(() => {
        Module._load = originalLoad;
    });

    function createDevice(overrides = {}) {
        const data = Object.assign({
            id: 'device-1',
            name: 'Omron',
            property: { address: '192.168.1.10' },
            tags: {
                tag1: {
                    id: 'tag1',
                    name: 'Tag 1',
                    address: 'GlobalTag',
                    type: 'number',
                    daq: { enabled: false },
                },
            },
        }, overrides);
        const logger = { info() {}, warn() {}, error() {} };
        const events = new EventEmitter();
        const manager = {
            require(name) {
                if (name === 'omron-ethernet-ip') {
                    return { OmronEipClient: MockClient };
                }
                throw new Error(`unexpected package ${name}`);
            },
        };
        const device = driver.create(data, logger, events, manager, {});
        device.load(data);
        return { device, events };
    }

    it('connects with default EtherNet/IP port when only host is configured', async () => {
        const { device } = createDevice();

        await device.connect();

        expect(lastOptions).to.deep.equal({ host: '192.168.1.10', port: 44818 });
        expect(device.isConnected()).to.equal(true);
    });

    it('updates timestamp and emitted values only after successful reads', async () => {
        const { device, events } = createDevice();
        const emitted = [];
        events.on('device-value:changed', event => emitted.push(event));
        MockClient.readTag = () => Promise.resolve({ value: '42', typeName: 'DINT' });

        await device.connect();
        await device.polling();

        expect(device.lastReadTimestamp()).to.be.a('number');
        expect(emitted).to.have.length(1);
        expect(emitted[0].values.tag1.value).to.equal(42);
        expect(emitted[0].values.tag1.type).to.equal('DINT');
    });

    it('does not refresh lastReadTimestamp or emit stale values when reads fail', async () => {
        const { device, events } = createDevice();
        let valueEvents = 0;
        events.on('device-value:changed', () => valueEvents++);
        MockClient.readTag = () => Promise.reject(new Error('bad tag'));

        await device.connect();
        await device.polling();

        expect(device.lastReadTimestamp()).to.equal(undefined);
        expect(valueEvents).to.equal(0);
        expect(device.isConnected()).to.equal(true);
    });

    it('closes the client and marks the device disconnected when reads time out', async () => {
        const { device } = createDevice({
            property: { address: '192.168.1.10:44819', readTimeout: 5 },
        });
        MockClient.readTag = () => new Promise(() => {});

        await device.connect();
        await device.polling();

        expect(lastOptions).to.deep.equal({ host: '192.168.1.10', port: 44819 });
        expect(device.getStatus()).to.equal('connect-error');
        expect(device.isConnected()).to.equal(false);
        expect(instances[0].closed).to.equal(true);
    });
});
