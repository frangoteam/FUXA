'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const storage = require('../../runtime/storage/influxdb');

describe('InfluxDB write timestamps', function () {
    this.timeout(10000);
    for (const type of ['influxDB18', 'influxDB']) {
        for (const timestamp of [0, 1700000000123, null, undefined]) {
            it(`${type} preserves ${timestamp == null ? `the ${timestamp} current-time default` : timestamp} on the wire`, async function () {
                let resolveRequest;
                const received = new Promise(resolve => { resolveRequest = resolve; });
                const server = http.createServer((req, res) => {
                    let body = '';
                    req.setEncoding('utf8');
                    req.on('data', chunk => { body += chunk; });
                    req.on('end', () => {
                        res.writeHead(204).end();
                        resolveRequest({ url: req.url, body });
                    });
                });
                await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
                let timer;
                const errors = [];
                try {
                    const adapter = storage.create({ daqstore: {
                        type, url: `http://127.0.0.1:${server.address().port}`,
                        database: 'synthetic', organization: 'synthetic', bucket: 'synthetic',
                        credentials: { username: 'synthetic', password: '', token: 'synthetic' }
                    } }, { error: message => errors.push(message), info() {} });
                    const before = Date.now();
                    adapter.addDaqValues({ sample: {
                        id: 'sample', value: 12, timestamp, daq: { enabled: true }
                    } }, 'device', 'device-id');
                    const result = await Promise.race([received, new Promise((_, reject) => {
                        timer = setTimeout(() => reject(new Error(`No write received: ${errors.join('; ')}`)), 5000);
                    })]);
                    const after = Date.now();
                    assert.match(result.url, /^\/(?:api\/v2\/)?write\?/);
                    // Influx 1.x sends nanoseconds; the 2.x adapter declares millisecond precision.
                    const wireTimestamp = BigInt(result.body.trim().split(/\s+/).at(-1));
                    const milliseconds = type === 'influxDB18' ? wireTimestamp / 1000000n : wireTimestamp;
                    if (timestamp == null) {
                        assert.ok(milliseconds >= BigInt(before) && milliseconds <= BigInt(after));
                    } else {
                        assert.equal(milliseconds, BigInt(timestamp));
                    }
                    assert.deepEqual(errors, []);
                } finally {
                    clearTimeout(timer);
                    server.closeAllConnections();
                    await new Promise(resolve => server.close(resolve));
                }
            });
        }
    }
});
