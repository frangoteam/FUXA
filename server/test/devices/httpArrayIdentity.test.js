'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const { EventEmitter } = require('node:events');
const driver = require('../../runtime/devices/httprequest');

describe('WebAPI JSON array identity', function () {
    it('keeps selected objects mapped by identifier when response order changes', async function () {
        const responses = [
            [
                { name: 'AI-Humi', value: 61.8 },
                { name: 'AI-Flow', value: 190 }
            ],
            [
                { name: 'AI-Flow', value: 190 },
                { name: 'AI-Humi', value: 61.8 }
            ]
        ];
        let request = 0;
        const server = http.createServer((req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(responses[Math.min(request++, responses.length - 1)]));
        });
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

        const data = {
            id: 'device',
            name: 'Device',
            polling: 1000,
            property: { address: `http://127.0.0.1:${server.address().port}/values` },
            tags: {
                humidity: {
                    id: 'humidity', name: 'Humidity sensor', address: '[0]:name', memaddress: '[0]:value',
                    options: { selid: 'name', selval: 'value', selkey: 'AI-Humi' }, type: 'number'
                },
                flow: {
                    id: 'flow', name: 'AI-Flow', address: '[1]:name', memaddress: '[1]:value',
                    options: { selid: 'name', selval: 'value' }, type: 'number'
                }
            }
        };
        const errors = [];
        const client = driver.create(data, {
            info() {}, warn() {}, error(message) { errors.push(message); }
        }, new EventEmitter());

        try {
            client.load(data);
            await client.connect();
            await client.polling();
            assert.equal(client.getValue('humidity')?.value, 61.8);
            assert.equal(client.getValue('flow')?.value, 190);

            await client.polling();
            assert.equal(client.getValue('humidity')?.value, 61.8);
            assert.equal(client.getValue('flow')?.value, 190);
            assert.deepEqual(errors, []);
        } finally {
            await client.disconnect();
            server.closeAllConnections();
            await new Promise(resolve => server.close(resolve));
        }
    });

    it('finds a numeric identifier after nested arrays shrink and reorder', async function () {
        const responses = [
            { groups: [{ items: [
                { code: 4, reading: 40 },
                { code: 8, reading: 80 },
                { code: 0, reading: 5 }
            ] }] },
            { groups: [{ items: [
                { code: 0, reading: 7 },
                { code: 4, reading: 40 }
            ] }] }
        ];
        let request = 0;
        const server = http.createServer((req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(responses[Math.min(request++, responses.length - 1)]));
        });
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

        const data = {
            id: 'device',
            name: 'Device',
            polling: 1000,
            property: { address: `http://127.0.0.1:${server.address().port}/values` },
            tags: {
                zero: {
                    id: 'zero', name: 'Renamed zero sensor',
                    address: 'groups:[0]:items:[2]:code',
                    memaddress: 'groups:[0]:items:[2]:reading',
                    options: { selid: 'code', selval: 'reading', selkey: 0 },
                    type: 'number'
                }
            }
        };
        const client = driver.create(data, { info() {}, warn() {}, error() {} }, new EventEmitter());

        try {
            client.load(data);
            await client.connect();
            await client.polling();
            assert.equal(client.getValue('zero')?.value, 5);

            await client.polling();
            assert.equal(client.getValue('zero')?.value, 7);
        } finally {
            await client.disconnect();
            server.closeAllConnections();
            await new Promise(resolve => server.close(resolve));
        }
    });
});
