const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const storage = require('../../runtime/storage/influxdb');

describe('InfluxDB 1.8 HTTP endpoint selection', function () {
    for (const [title, address, hostname] of [
        ['compact IPv6', '::1', '[::1]'],
        ['expanded IPv6', '::1', '[0:0:0:0:0:0:0:1]'],
        ['IPv4 compatibility', '127.0.0.1', '127.0.0.1'],
    ]) {
        it('queries the configured ' + title + ' endpoint', async function () {
            const requests = [];
            const errors = [];
            const server = http.createServer((request, response) => {
                requests.push({url: request.url, host: request.headers.host});
                response.setHeader('Content-Type', 'application/json');
                response.end(JSON.stringify({results: [{series: [{name: 'tag', columns: ['time', 'value'], values: [['2026-01-01T00:00:00Z', 12]]}]}]}));
            });
            server.listen(0, address);
            await once(server, 'listening');
            try {
                const port = server.address().port;
                const node = storage.create({daqstore: {
                    type: 'influxDB18', url: 'http://' + hostname + ':' + port,
                    database: 'synthetic', credentials: {username: '', password: ''}
                }}, {info() {}, error(message) { errors.push(message); }}, {setValues() {}});
                assert.deepEqual(await node.getDaqValue('tag', 0, 1), [{dt: Date.UTC(2026, 0, 1), value: 12}]);
                assert.deepEqual(errors, []);
                assert.equal(requests.length, 1);
                const request = new URL(requests[0].url, 'http://localhost');
                assert.equal(request.pathname, '/query');
                assert.equal(request.searchParams.get('db'), 'synthetic');
                assert.match(request.searchParams.get('q'), /^SELECT \* FROM "tag" WHERE time >= 0 AND time <= 1000000$/);
                assert.equal(requests[0].host, (address === '::1' ? '[::1]' : address) + ':' + port);
            } finally {
                await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
            }
        });
    }
});
