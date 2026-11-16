'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const storage = require('../../runtime/storage/influxdb');

function settings(type = 'influxDB', url = 'http://127.0.0.1:1') {
    return { daqstore: { type, url, database: 'synthetic', organization: 'synthetic',
        bucket: 'synthetic', credentials: { username: 'synthetic', password: '', token: 'synthetic' } } };
}

describe('InfluxDB storage close', function () {
    this.timeout(10000);

    for (const type of ['influxDB', 'influxDB18']) {
        it(`closes an idle ${type} adapter without calling an unsupported client method`, async function () {
            const errors = [];
            const info = [];
            const adapter = storage.create(settings(type), {
                error: message => errors.push(message), info: message => info.push(message)
            });
            await adapter.close();
            assert.deepEqual(errors, []);
            assert.deepEqual(info, ['influxdb-close FINISHED']);
        });
    }

    it('can close after the v2 client fails initialization', async function () {
        const errors = [];
        const adapter = storage.create(settings('influxDB', 'not a URL'), {
            error: message => errors.push(message), info() {}
        });
        assert.equal(errors.length, 1);
        assert.match(errors[0], /influxdb-init failed/);
        await adapter.close();
        assert.equal(errors.length, 1);
    });

    it('releases the real v2 writer after an HTTP 503 response', function () {
        // A failed write schedules a 60-second retry in the real SDK. Closing the
        // adapter must release that timer so this child exits naturally.
        const child = spawnSync(process.execPath, ['--unhandled-rejections=strict', '-e', `
            const assert = require('node:assert/strict');
            const http = require('node:http');
            const storage = require(${JSON.stringify(require.resolve('../../runtime/storage/influxdb'))});
            (async () => {
                let finishWrite;
                const written = new Promise(resolve => { finishWrite = resolve; });
                const errors = [];
                const info = [];
                const requests = [];
                const server = http.createServer((req, res) => {
                    let body = '';
                    req.setEncoding('utf8');
                    req.on('data', chunk => { body += chunk; });
                    req.on('end', () => {
                        requests.push({ url: req.url, body });
                        res.writeHead(503, { 'Retry-After': '60' }).end();
                    });
                });
                await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
                const writer = storage.create({ daqstore: {
                    type: 'influxDB', url: 'http://127.0.0.1:' + server.address().port,
                    organization: 'synthetic', bucket: 'synthetic', credentials: { token: 'synthetic' }
                } }, { error(message) { errors.push(message); finishWrite(); }, info(message) { info.push(message); } });
                writer.addDaqValues({ sample: { id: 'sample', value: 12, timestamp: 1234,
                    daq: { enabled: true } } }, 'device', 'device-id');
                await written;
                await writer.close();
                server.closeAllConnections();
                await new Promise(resolve => server.close(resolve));
                assert.equal(requests.length, 1);
                assert.ok(requests[0].url.startsWith('/api/v2/write?'));
                assert.match(requests[0].body, /value=12/);
                assert.ok(info.includes('influxdb-close FINISHED'));
                assert.equal(errors.length, 1, errors.join('; '));
                assert.match(errors[0], /influxdb-writePoints error/);
                console.log('writer closed');
            })().catch(error => { console.error(error); process.exitCode = 1; });
        `], { encoding: 'utf8', timeout: 5000 });
        assert.ifError(child.error);
        assert.equal(child.status, 0, child.stderr);
        assert.match(child.stdout, /writer closed/);
        assert.match(child.stderr, /Retry buffer closed with 1 items that were not written/);
    });
});
