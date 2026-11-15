'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const daqApi = require('../../api/daq');

const SIX_HOURS = 6 * 60 * 60 * 1000;
const MAX_RANGE = SIX_HOURS * 744;

function request(server, query) {
    const encodedQuery = encodeURIComponent(JSON.stringify(query));
    return new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${server.address().port}/api/daq?query=${encodedQuery}`, response => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', chunk => { body += chunk; });
            response.on('end', () => resolve({
                statusCode: response.statusCode,
                body: body ? JSON.parse(body) : null
            }));
        }).on('error', reject);
    });
}

describe('DAQ REST API history limits', () => {
    let server;
    let calls;
    let currentValueCalls;

    beforeEach(async () => {
        calls = [];
        currentValueCalls = [];
        const app = express();
        const runtime = {
            project: {},
            daqStorage: {
                async getNodeValues(sid, from, to) {
                    calls.push([sid, from, to]);
                    return [{ sid, from, to }];
                }
            },
            devices: {
                getTagValue(sid, history) {
                    currentValueCalls.push([sid, history]);
                    return 42;
                }
            },
            logger: { error() {} }
        };
        daqApi.init(runtime, (req, res, next) => next(), () => {});
        app.use(daqApi.app());
        server = http.createServer(app);
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    });

    afterEach(async () => {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    });

    it('rejects invalid and over-limit history ranges before querying storage', async () => {
        for (const query of [
            { sids: ['tag-a'], from: 1000, to: 1000 + MAX_RANGE + 1 },
            { sids: ['tag-a'], from: 2000, to: 1000 },
            { sids: ['tag-a'], from: '1000', to: 2000 }
        ]) {
            const response = await request(server, query);
            assert.equal(response.statusCode, 400);
            assert.equal(response.body.error, 'invalid_query');
        }
        assert.deepEqual(calls, []);
    });

    it('rejects history ranges whose large timestamps cannot advance by one chunk', async () => {
        const from = 2 ** 78;
        const response = await request(server, {
            sids: ['tag-a'], from, to: from + 2 ** 26
        });

        assert.equal(response.statusCode, 400);
        assert.equal(response.body.error, 'invalid_query');
        assert.match(response.body.message, /cannot be safely chunked/);
        assert.deepEqual(calls, []);
    });

    it('rejects history queries with more than 100 tag IDs', async () => {
        const response = await request(server, {
            sids: Array.from({ length: 101 }, (_, index) => `tag-${index}`),
            from: 1000, to: 2000
        });

        assert.equal(response.statusCode, 400);
        assert.equal(response.body.error, 'invalid_query');
        assert.deepEqual(calls, []);
    });

    it('reads bounded chunks sequentially and combines them in the response', async () => {
        const query = { sids: ['tag-a'], from: 1000, to: 1000 + SIX_HOURS + 100 };
        const response = await request(server, query);

        assert.equal(response.statusCode, 200);
        assert.deepEqual(calls, [
            ['tag-a', 1000, 1000 + SIX_HOURS],
            ['tag-a', 1001 + SIX_HOURS, 1000 + SIX_HOURS + 100]
        ]);
        assert.deepEqual(response.body, [[
            { sid: 'tag-a', from: 1000, to: 1000 + SIX_HOURS },
            { sid: 'tag-a', from: 1001 + SIX_HOURS, to: 1000 + SIX_HOURS + 100 }
        ]]);
    });

    it('preserves current-value queries without reading history', async () => {
        const response = await request(server, { sids: ['tag-a'], from: 1000, to: 1000 });

        assert.equal(response.statusCode, 200);
        assert.deepEqual(response.body, [[42]]);
        assert.deepEqual(currentValueCalls, [['tag-a', true]]);
        assert.deepEqual(calls, []);
    });
});
