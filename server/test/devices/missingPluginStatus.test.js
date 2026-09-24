const EventEmitter = require('events');
const Module = require('module');

describe('Device manager missing plugins', () => {
    let devices;
    let originalLoad;
    let warnings;
    let events;

    before(async () => {
        const chai = await import('chai');
        global.expect = chai.expect;
    });

    beforeEach(() => {
        const managerPath = require.resolve('../../runtime/devices');
        delete require.cache[managerPath];

        warnings = [];
        events = new EventEmitter();
        originalLoad = Module._load;

        const fakeDevice = {
            create() {
                return null;
            },
            isInternal() {
                return false;
            },
            getSupportedProperty() {
                return Promise.reject('not supported');
            },
            getRequestResult() {
                return Promise.reject('not supported');
            },
        };

        Module._load = function (request, parent, isMain) {
            if (request === './device' && parent && parent.filename === managerPath) {
                return fakeDevice;
            }
            return originalLoad.apply(this, arguments);
        };

        devices = require('../../runtime/devices');
        devices.init({
            events,
            logger: {
                info() {},
                warn(message) {
                    warnings.push(message);
                },
                error() {},
            },
            project: {
                getDevices() {
                    return {
                        s7: {
                            id: 's7',
                            name: 'PLC',
                            type: 'SiemensS7',
                            enabled: true,
                            property: {},
                            tags: {},
                        },
                    };
                },
                getServer() {
                    return null;
                },
                getDeviceProperty() {
                    return null;
                },
            },
            daqStorage: {
                reset() {},
            },
            settings: {
                daqEnabled: false,
            },
        });
    });

    afterEach(() => {
        Module._load = originalLoad;
        delete require.cache[require.resolve('../../runtime/devices')];
    });

    it('reports an enabled device as failed when its plugin cannot be loaded', () => {
        const statusEvents = [];
        events.on('device-status:changed', event => statusEvents.push(event));

        devices.load();

        expect(devices.getDevicesStatus()).to.deep.equal({ s7: 'connect-failed' });
        expect(statusEvents).to.deep.equal([{ id: 's7', status: 'connect-failed' }]);
        expect(warnings).to.have.length(1);
        expect(warnings[0]).to.contain('plugin is missing');
    });

    it('does not report disabled devices as failed', () => {
        const runtime = {
            events,
            logger: {
                info() {},
                warn(message) {
                    warnings.push(message);
                },
                error() {},
            },
            project: {
                getDevices() {
                    return {
                        s7: {
                            id: 's7',
                            name: 'PLC',
                            type: 'SiemensS7',
                            enabled: false,
                            property: {},
                            tags: {},
                        },
                    };
                },
                getServer() {
                    return null;
                },
                getDeviceProperty() {
                    return null;
                },
            },
            daqStorage: {
                reset() {},
            },
            settings: {
                daqEnabled: false,
            },
        };

        devices.init(runtime);
        devices.load();

        expect(devices.getDevicesStatus()).to.deep.equal({});
        expect(warnings).to.have.length(0);
    });
});
