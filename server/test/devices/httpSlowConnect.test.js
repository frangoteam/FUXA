'use strict';
const assert = require('node:assert/strict');
const dns = require('node:dns');
const net = require('node:net');
const { spawn } = require('node:child_process');
const driver = require('../../runtime/devices/httprequest');

// The server stops accepting for 700 ms, so its backlog fills up and the next
// connection to it takes at least that long.
const SLOW_SERVER = `
const server = require('node:http').createServer((req, res) => res.end('{"reading":4}'));
server.listen({ host: '127.0.0.1', port: 0, backlog: 1 }, () => process.send(server.address().port));
process.on('message', () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 700));
`;

describe('WebAPI host that is slow to connect', function () {
    // Relies on the kernel dropping SYNs while the accept queue is full, as Linux and macOS do.
    before(function () { if (process.platform === 'win32') this.skip(); });

    it('reads a host that is slow to connect over IPv4 while IPv6 is refused', async function () {
        this.timeout(10000);
        const server = spawn(process.execPath, ['-e', SLOW_SERVER], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
        const lookup = dns.lookup;
        const sockets = [];
        try {
            const port = await new Promise(resolve => server.once('message', resolve));
            dns.lookup = (hostname, options, callback) => {
                if (hostname !== 'slow-webapi.test') return lookup(hostname, options, callback);
                const addresses = [{ address: '127.0.0.1', family: 4 }, { address: '::1', family: 6 }];
                return options.all ? callback(null, addresses) : callback(null, '127.0.0.1', 4);
            };
            server.send('block');
            await new Promise(resolve => setTimeout(resolve, 50));
            for (let i = 0; i < 8; i++) sockets.push(net.connect(port, '127.0.0.1').on('error', () => {}));
            await new Promise(resolve => setTimeout(resolve, 50));
            const result = await driver.getRequestResult({ method: 'GET', address: `http://slow-webapi.test:${port}/` });
            assert.deepEqual(result, { reading: 4 });
        } finally {
            dns.lookup = lookup;
            sockets.forEach(socket => socket.destroy());
            server.kill();
        }
    });
});
