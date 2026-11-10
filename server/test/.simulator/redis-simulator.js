#!/usr/bin/env node
'use strict';

// Small, dependency-free Redis RESP2/RESP3 subset for testing FUXA's Redis scan.
// It implements HELLO, CLIENT SETINFO, PING, AUTH, SCAN, TYPE and TYPE transactions.
const net = require('node:net');

const args = process.argv.slice(2);
function option(name, fallback) {
    const index = args.indexOf(name);
    return index < 0 ? fallback : args[index + 1];
}

const host = option('--host', '127.0.0.1');
const port = Number(option('--port', '6380'));
const password = process.env.REDIS_PASSWORD || '';
const values = new Map([
    ['plant:boiler:temperature', { type: 'string', value: '82.4' }],
    ['plant:boiler:pressure', { type: 'string', value: '4.8' }],
    ['plant:pump:running', { type: 'string', value: '1' }],
    ['plant:boiler:status', { type: 'hash', value: { Value: 'RUNNING', Quality: 'good', UtcTimeMs: String(Date.now()) } }],
    ['plant:meter:measurements', { type: 'hash', value: { Value: '127.6', Quality: 'good', UtcTimeMs: String(Date.now()) } }],
]);

function bulk(value) {
    const text = String(value);
    return `$${Buffer.byteLength(text)}\r\n${text}\r\n`;
}
function simple(value) { return `+${value}\r\n`; }
function error(value) { return `-ERR ${value}\r\n`; }
function array(items) { return `*${items.length}\r\n${items.map(bulk).join('')}`; }

// Parse the RESP array-of-bulk-strings requests sent by node-redis.
function parseRequest(buffer, offset = 0) {
    if (offset >= buffer.length) return null;
    if (buffer[offset] !== 42) return null; // '*'
    const end = buffer.indexOf('\r\n', offset);
    if (end < 0) return null;
    const count = Number(buffer.toString('ascii', offset + 1, end));
    if (!Number.isInteger(count) || count < 0) return null;
    let cursor = end + 2;
    const parts = [];
    for (let i = 0; i < count; i++) {
        if (buffer[cursor] !== 36) return null; // '$'
        const lengthEnd = buffer.indexOf('\r\n', cursor);
        if (lengthEnd < 0) return null;
        const length = Number(buffer.toString('ascii', cursor + 1, lengthEnd));
        if (!Number.isInteger(length) || length < 0) return null;
        const dataStart = lengthEnd + 2;
        const dataEnd = dataStart + length;
        if (buffer.length < dataEnd + 2) return null;
        parts.push(buffer.toString('utf8', dataStart, dataEnd));
        cursor = dataEnd + 2;
    }
    return { command: parts, offset: cursor };
}

function globRegex(glob) {
    const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`);
}

const server = net.createServer(socket => {
    let input = Buffer.alloc(0);
    let transaction = null;
    let authenticated = !password;

    function run(command) {
        const [rawName, ...params] = command;
        const name = (rawName || '').toUpperCase();
        if (password && !authenticated && name !== 'AUTH' && name !== 'HELLO') {
            return error('authentication required');
        }
        switch (name) {
            case 'HELLO': {
                const protoIndex = params.findIndex(p => /^\d+$/.test(p));
                const proto = protoIndex < 0 ? '2' : params[protoIndex];
                const fields = ['server', 'redis', '7.2.0-simulator', 'proto', proto, 'id', '1', 'mode', 'standalone', 'role', 'master', 'modules', []];
                let reply = `%${fields.length / 2}\r\n`;
                for (let i = 0; i < fields.length; i += 2) {
                    reply += bulk(fields[i]);
                    reply += Array.isArray(fields[i + 1]) ? '*0\r\n' : (typeof fields[i + 1] === 'number' ? `:${fields[i + 1]}\r\n` : bulk(fields[i + 1]));
                }
                return reply;
            }
            case 'AUTH':
                if (!password || params.at(-1) === password) {
                    authenticated = true;
                    return simple('OK');
                }
                return error('invalid username-password pair');
            case 'CLIENT': return simple('OK'); // SETINFO and other client metadata commands
            case 'PING': return params.length ? bulk(params[0]) : simple('PONG');
            case 'SCAN': {
                const cursor = Number(params[0] || 0);
                let match = '*';
                let count = 10;
                for (let i = 1; i < params.length; i++) {
                    if (params[i].toUpperCase() === 'MATCH') match = params[++i] || '*';
                    else if (params[i].toUpperCase() === 'COUNT') count = Number(params[++i]) || 10;
                }
                const regex = globRegex(match);
                const keys = [...values.keys()].filter(key => regex.test(key));
                const page = keys.slice(cursor, cursor + Math.max(1, count));
                const next = cursor + page.length >= keys.length ? '0' : String(cursor + page.length);
                return `*2\r\n${bulk(next)}${array(page)}`;
            }
            case 'TYPE': return simple(values.get(params[0])?.type || 'none');
            case 'MULTI': transaction = []; return simple('OK');
            case 'EXEC': {
                if (!transaction) return error('EXEC without MULTI');
                const queued = transaction;
                transaction = null;
                return `*${queued.length}\r\n${queued.map(([cmd, key]) => simple(cmd === 'TYPE' ? (values.get(key)?.type || 'none') : 'OK')).join('')}`;
            }
            case 'DISCARD': transaction = null; return simple('OK');
            case 'QUIT': socket.end(simple('OK')); return null;
            default: return error(`unknown command '${name}'`);
        }
    }

    socket.on('data', chunk => {
        input = Buffer.concat([input, chunk]);
        while (true) {
            const parsed = parseRequest(input);
            if (!parsed) break;
            input = input.subarray(parsed.offset);
            const command = parsed.command;
            if (transaction && !['EXEC', 'DISCARD', 'MULTI'].includes((command[0] || '').toUpperCase())) {
                transaction.push(command);
                socket.write(simple('QUEUED'));
                continue;
            }
            const response = run(command);
            if (response !== null) socket.write(response);
        }
    });
    socket.on('error', err => console.error(`[client] ${err.message}`));
});

server.listen(port, host, () => {
    console.log(`Redis test simulator listening on ${host}:${port}`);
    console.log(`Seeded keys: ${[...values.keys()].join(', ')}`);
    console.log('Configure a FUXA Redis device with this host and port, then use Scan.');
});
server.on('error', err => {
    console.error(`Cannot start simulator: ${err.message}`);
    process.exitCode = 1;
});
