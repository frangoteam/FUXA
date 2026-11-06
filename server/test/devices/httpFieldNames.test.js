'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const { EventEmitter } = require('node:events');
const driver = require('../../runtime/devices/httprequest');

describe('WebAPI JSON field names', function () {
    async function read(body, addresses, expected) {
        const errors = [];
        const server = http.createServer((req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(body);
        });
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        let client;
        try {
            const tags = Object.fromEntries(addresses.map((address, i) => [
                'tag' + i, { id: 'tag' + i, name: 'Tag ' + i, address, type: 'number' }
            ]));
            const data = { id: 'device', name: 'Device', polling: 1000,
                property: { address: `http://127.0.0.1:${server.address().port}/values` }, tags };
            client = driver.create(data, { info() {}, warn() {}, error(message) { errors.push(message); } }, new EventEmitter());
            client.load(data);
            await client.connect();
            await client.polling();
            assert.deepEqual(errors, [], 'loading and polling must not fail');
            for (let i = 0; i < expected.length; i++) {
                assert.equal(client.getValue('tag' + i)?.value, expected[i]);
            }
        } finally {
            if (client) await client.disconnect();
            server.closeAllConnections();
            await new Promise(resolve => server.close(resolve));
        }
    }
    for (const field of ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__', 'isPrototypeOf', 'propertyIsEnumerable']) {
        it(`reads the root field ${field}`, async function () {
            await read(JSON.stringify({ [field]: 42, ordinary: 9 }), [field, 'ordinary'], [42, 9]);
        });
    }
    it('preserves ordinary root fields', async function () {
        await read('{"temperature":12}', ['temperature'], [12]);
    });
    it('preserves nested and array field paths', async function () {
        await read('{"nested":{"constructor":7},"list":[{"value":8}]}', ['nested:constructor', 'list:[0]:value'], [7, 8]);
    });
    it('maps one prototype-named field to multiple configured tags', async function () {
        await read('{"constructor":17}', ['constructor', 'constructor'], [17, 17]);
    });
});
