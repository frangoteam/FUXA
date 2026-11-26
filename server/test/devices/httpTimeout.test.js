'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const { EventEmitter } = require('node:events');
const driver = require('../../runtime/devices/httprequest');

describe('WebAPI request timeouts and cancellation', function () {
    let server, origin, client;

    beforeEach(async function () {
        server = http.createServer();
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        origin = `http://127.0.0.1:${server.address().port}`;
    });

    afterEach(async function () {
        if (client) await client.disconnect();
        client = null;
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    });

    it('applies the configured timeout to standalone GET requests', async function () {
        server.on('request', () => {});

        await assert.rejects(
            driver.getRequestResult({
                method: 'GET',
                address: origin,
                timeout: 40
            })
        );
    });

    it('aborts an overloaded read and can read again after reconnecting', async function () {
        this.timeout(5000);
        let requests = 0;
        let firstResponseClosed;
        const closed = new Promise(resolve => { firstResponseClosed = resolve; });
        let firstResponse = true;

        server.removeAllListeners('request');
        server.on('request', (req, res) => {
            requests++;
            if (firstResponse) {
                res.once('close', firstResponseClosed);
                return;
            }
            res.setHeader('Content-Type', 'application/json');
            res.end('[{"id":"tag","value":23}]');
        });

        const data = {
            id: 'device',
            name: 'Device',
            polling: 1000,
            property: { getTags: origin },
            tags: { tag: { id: 'tag', name: 'Tag', type: 'number' } }
        };
        client = driver.create(data, {
            info() {},
            warn() {},
            error() {}
        }, new EventEmitter());
        client.load(data);
        await client.connect();

        const pendingRead = client.polling();
        while (requests === 0) await new Promise(resolve => setImmediate(resolve));

        // The fourth polling attempt encounters three consecutive overlaps;
        // the driver should cancel the pending request instead of opening more.
        await client.polling();
        await client.polling();
        await client.polling();
        await pendingRead;
        await closed;

        assert.equal(requests, 1);
        assert.equal(client.isConnected(), false);

        firstResponse = false;
        await client.connect();
        await client.polling();
        assert.equal(requests, 2);
        assert.equal(client.getValue('tag').value, 23);
    });

    it('cancels an in-flight read when disconnected', async function () {
        this.timeout(5000);
        let responseClosed;
        const closed = new Promise(resolve => { responseClosed = resolve; });
        server.removeAllListeners('request');
        server.on('request', (req, res) => {
            res.once('close', responseClosed);
        });

        const data = {
            id: 'device',
            name: 'Device',
            polling: 1000,
            property: { getTags: origin },
            tags: { tag: { id: 'tag', name: 'Tag', type: 'number' } }
        };
        client = driver.create(data, {
            info() {},
            warn() {},
            error() {}
        }, new EventEmitter());
        client.load(data);
        await client.connect();

        const pendingRead = client.polling();
        await new Promise(resolve => server.once('request', resolve));
        await client.disconnect();
        await pendingRead;
        await closed;

        assert.equal(client.isConnected(), false);
    });
});
