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
});
