'use strict';

const assert = require('assert').strict;
const Module = require('module');

const DRIVER = '../../runtime/devices/iothttp';

function loadDriver(axiosMock) {
    const originalLoad = Module._load;
    const target = require.resolve(DRIVER);
    Module._load = function (request, parent, isMain) {
        if (request === 'axios' && parent && parent.filename === target) {
            return axiosMock;
        }
        return originalLoad.apply(this, arguments);
    };
    try {
        delete require.cache[target];
        return require(DRIVER);
    } finally {
        Module._load = originalLoad;
    }
}

function makeDevice(tagOptions) {
    return {
        name: 'http-device',
        property: { address: 'http://127.0.0.1:9', method: 'GET', timeout: 500 },
        tags: {
            'tag-1': { id: 'tag-1', name: 'relay', address: '/api/relay', options: tagOptions }
        }
    };
}

function makeLogger() {
    return { info: () => { }, warn: () => { }, error: () => { }, debug: () => { } };
}

describe('IoTHTTP driver write method', () => {
    let requests;

    beforeEach(() => {
        requests = [];
    });

    it('sends no request when the write method is none', async () => {
        const axiosMock = {
            request: async (config) => {
                requests.push(config);
                return { status: 200, data: {} };
            }
        };
        const driver = loadDriver(axiosMock);
        const data = makeDevice(JSON.stringify({ write: { method: 'none' } }));
        const comm = driver.create(data, makeLogger(), { emit: () => { } }, {});

        const result = await comm.setValue('tag-1', 1);

        assert.equal(result, false);
        assert.equal(requests.length, 0);
    });

    it('treats a tag without write options as read-only', async () => {
        const axiosMock = {
            request: async (config) => {
                requests.push(config);
                return { status: 200, data: {} };
            }
        };
        const driver = loadDriver(axiosMock);
        const comm = driver.create(makeDevice(undefined), makeLogger(), { emit: () => { } }, {});

        const result = await comm.setValue('tag-1', 1);

        assert.equal(result, false);
        assert.equal(requests.length, 0);
    });

    it('sends the request when a write method is configured', async () => {
        const axiosMock = {
            request: async (config) => {
                requests.push(config);
                return { status: 200, data: {} };
            }
        };
        const driver = loadDriver(axiosMock);
        const options = JSON.stringify({ write: { method: 'POST', path: '/api/relay', key: 'relay', mode: 'json-key' } });
        const comm = driver.create(makeDevice(options), makeLogger(), { emit: () => { } }, {});

        const result = await comm.setValue('tag-1', 1);

        assert.equal(result, true);
        assert.equal(requests.length, 1);
        assert.equal(requests[0].method, 'POST');
        assert.deepEqual(requests[0].data, { relay: 1 });
    });

    it('uses the device Content-Type when the tag does not override it', async () => {
        const axiosMock = {
            request: async (config) => {
                requests.push(config);
                return { status: 200, data: {} };
            }
        };
        const driver = loadDriver(axiosMock);
        const options = JSON.stringify({ write: { method: 'POST', path: '/api/relay', key: 'relay' } });
        const data = makeDevice(options);
        data.property.headers = JSON.stringify({ 'Content-Type': 'text/plain' });
        const comm = driver.create(data, makeLogger(), { emit: () => { } }, {});

        const result = await comm.setValue('tag-1', 1);

        assert.equal(result, true);
        assert.equal(requests[0].headers['Content-Type'], 'text/plain');
    });

    it('applies the tag write scale script before building the payload', async () => {
        const axiosMock = {
            request: async (config) => {
                requests.push(config);
                return { status: 200, data: {} };
            }
        };
        const driver = loadDriver(axiosMock);
        const options = JSON.stringify({ write: { method: 'POST', key: 'relay', mode: 'json-key' } });
        const data = makeDevice(options);
        data.tags['tag-1'].scaleWriteFunction = 'write-transform';
        const runtime = {
            scriptsMgr: {
                runScript: async (script) => {
                    assert.equal(script.id, 'write-transform');
                    assert.equal(script.parameters[0].value, 2);
                    return 20;
                }
            }
        };
        const comm = driver.create(data, makeLogger(), { emit: () => { } }, runtime);

        const result = await comm.setValue('tag-1', 2);

        assert.equal(result, true);
        assert.deepEqual(requests[0].data, { relay: 20 });
    });

    it('includes the tag UNS path in DAQ samples', async () => {
        const axiosMock = {
            request: async () => ({ status: 200, data: { tags: { pressure: 2.4 } } })
        };
        const driver = loadDriver(axiosMock);
        const data = makeDevice(undefined);
        data.id = 'device-1';
        data.tags['tag-1'].memaddress = 'tags.pressure';
        data.tags['tag-1'].unsPath = 'Area1/Pressure';
        data.tags['tag-1'].daq = { enabled: true, changed: true, restored: false, interval: 60 };
        const comm = driver.create(data, makeLogger(), { emit: () => { } }, {});
        let daqSamples;
        comm.bindAddDaq((samples) => { daqSamples = samples; });
        comm.load(data);

        await comm.polling();

        assert.equal(daqSamples['tag-1'].unsPath, 'Area1/Pressure');
        assert.equal(daqSamples['tag-1'].value, 2.4);
    });

    it('applies the tag read scale mode to values received from the endpoint', async () => {
        const axiosMock = {
            request: async () => ({ status: 200, data: { tags: { pressure: 50 } } })
        };
        const driver = loadDriver(axiosMock);
        const data = makeDevice(undefined);
        data.tags['tag-1'].memaddress = 'tags.pressure';
        data.tags['tag-1'].type = 'number';
        data.tags['tag-1'].scale = {
            mode: 'linear', rawLow: 0, rawHigh: 100,
            scaledLow: 0, scaledHigh: 10,
        };
        const comm = driver.create(data, makeLogger(), { emit: () => { } }, {});
        comm.load(data);

        await comm.polling();

        assert.equal(comm.getValue('tag-1').value, 5);
    });

    it('runs the tag read scale script on values received from the endpoint', async () => {
        const axiosMock = {
            request: async () => ({ status: 200, data: { tags: { pressure: 2 } } })
        };
        const driver = loadDriver(axiosMock);
        const data = makeDevice(undefined);
        data.tags['tag-1'].memaddress = 'tags.pressure';
        data.tags['tag-1'].type = 'number';
        data.tags['tag-1'].scaleReadFunction = 'read-transform';
        const runtime = {
            scriptsMgr: {
                runScript: async (script) => {
                    assert.equal(script.id, 'read-transform');
                    assert.equal(script.parameters[0].value, 2);
                    return 20;
                }
            }
        };
        const comm = driver.create(data, makeLogger(), { emit: () => { } }, runtime);
        comm.load(data);

        await comm.polling();

        assert.equal(comm.getValue('tag-1').value, 20);
    });

    it('formats numeric values read from the endpoint to the configured precision', async () => {
        const axiosMock = {
            request: async () => ({ status: 200, data: { tags: { pressure: 12.3456 } } })
        };
        const driver = loadDriver(axiosMock);
        const data = makeDevice(undefined);
        data.tags['tag-1'].memaddress = 'tags.pressure';
        data.tags['tag-1'].type = 'number';
        data.tags['tag-1'].format = 2;
        const comm = driver.create(data, makeLogger(), { emit: () => { } }, {});
        comm.load(data);

        await comm.polling();

        assert.equal(comm.getValue('tag-1').value, 12.35);
    });

    it('supports zero decimal places for numeric read formatting', async () => {
        const axiosMock = {
            request: async () => ({ status: 200, data: { tags: { pressure: 12.6 } } })
        };
        const driver = loadDriver(axiosMock);
        const data = makeDevice(undefined);
        data.tags['tag-1'].memaddress = 'tags.pressure';
        data.tags['tag-1'].type = 'number';
        data.tags['tag-1'].format = 0;
        const comm = driver.create(data, makeLogger(), { emit: () => { } }, {});
        comm.load(data);

        await comm.polling();

        assert.equal(comm.getValue('tag-1').value, 13);
    });
});
