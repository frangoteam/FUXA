'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const { EventEmitter } = require('node:events');
const driver = require('../../runtime/devices/httprequest');

describe('WebAPI mode after configuration reload', function () {
    for (const modes of [
        ['external', 'own'], ['own', 'external', 'own'],
        ['own'], ['external'], ['own', 'external'], ['external', 'external']
    ]) {
        it(modes.join(' → '), async function () {
            const errors = [];
            const requests = [];
            const server = http.createServer((req, res) => {
                requests.push(req.url);
                res.setHeader('Content-Type', 'application/json');
                res.end(req.url === '/own' ? '[{"id":"tag","value":17}]' : '{"reading":4}');
            });
            await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
            const origin = `http://127.0.0.1:${server.address().port}`;
            let client;
            try {
                for (const mode of modes) {
                    if (client) await client.disconnect();
                    const data = { id: 'device', name: 'Device', polling: 1000,
                        property: mode === 'own' ? { getTags: origin + '/own' } : { address: origin + '/external' },
                        tags: { tag: { id: 'tag', name: 'Tag', type: 'number',
                            ...(mode === 'external' ? { address: 'reading' } : {}) } } };
                    if (!client) client = driver.create(data, {
                        info() {}, warn() {}, error(message) { errors.push(message); }
                    }, new EventEmitter());
                    // The manager reuses the driver through stop/load/start when settings change.
                    client.load(data);
                    await client.connect();
                    await client.polling();
                    assert.deepEqual(errors, []);
                    assert.equal(client.getValue('tag')?.value, mode === 'own' ? 17 : 4, mode);
                }
                assert.deepEqual(requests, modes.map(mode => '/' + (mode === 'own' ? 'own' : 'external')));
            } finally {
                if (client) await client.disconnect();
                server.closeAllConnections();
                await new Promise(resolve => server.close(resolve));
            }
        });
    }
});
