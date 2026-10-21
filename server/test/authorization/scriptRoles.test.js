'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { EventEmitter } = require('events');
const sinon = require('sinon');
const api = require('../../api');
const users = require('../../runtime/users');
const usrstorage = require('../../runtime/users/usrstorage');
const scripts = require('../../runtime/scripts');

// Exercise the real HTTP middleware, JWT identity, user cache, script permission
// check and saved-script execution. Device I/O is confined to an in-memory tag.
describe('HMI script Roles and Groups authorization', () => {
    let runtime;
    let server;
    let workDir;
    let tags;
    let systemGlobals;

    function request(url, body, token, headers = {}) {
        return new Promise((resolve, reject) => {
            const data = body === undefined ? '' : JSON.stringify(body);
            const req = http.request({
                host: '127.0.0.1', port: server.address().port, path: url,
                method: body === undefined ? 'GET' : 'POST',
                headers: {
                    'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data),
                    ...(token ? { 'x-access-token': token } : {}), ...headers
                }
            }, res => {
                let text = '';
                res.setEncoding('utf8');
                res.on('data', chunk => { text += chunk; });
                res.on('end', () => resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }));
            });
            req.on('error', reject);
            req.end(data);
        });
    }

    async function login(username) {
        const result = await request('/api/signin', { username, password: 'isolated-test-password' });
        assert.equal(result.status, 200);
        return result.body.data;
    }

    function run(token, overrides = {}) {
        return request('/api/runscript', { params: {
            script: { id: 'allowed-id', parameters: [], ...overrides }
        } }, token);
    }

    beforeEach(async () => {
        workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fuxa-script-roles-'));
        tags = {};
        systemGlobals = new Map(Object.keys(global).filter(key => key.startsWith('$')).map(key => [key, global[key]]));
        const logger = { info() {}, warn() {}, error() {} };
        await users.init({ workDir }, logger);
        for (const [username, groups, roles] of [
            ['admin', -1, []], ['operator', null, ['role-operator']], ['viewer', null, ['role-viewer']]
        ]) {
            await users.setUsers({ username, groups, fullname: username,
                password: 'isolated-test-password', info: JSON.stringify({ roles }) });
        }
        const savedScripts = [{
            id: 'allowed-id', name: 'allowed_script', mode: 'SERVER', sync: true,
            parameters: [], permission: 2, permissionRoles: { enabled: ['role-operator'] },
            code: '$setTag("result", 42); return 42;'
        }, {
            id: 'restricted-id', name: 'restricted_script', mode: 'SERVER', sync: true,
            parameters: [], permission: 4, permissionRoles: { enabled: ['role-engineer'] },
            code: '$setTag("restricted", 99); return 99;'
        }];
        runtime = {
            settings: { secureEnabled: true, userRole: true, secretCode: 'isolated-script-test-secret', logApiLevel: 'none' },
            logger, users, events: new EventEmitter(),
            project: { getScripts: async () => savedScripts },
            devices: { setTagValue: (id, value) => { tags[id] = value; return true; } }
        };
        runtime.scriptsMgr = scripts.create(runtime);
        const clock = sinon.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
        try {
            runtime.scriptsMgr.start();
            await clock.tickAsync(2000);
            await runtime.scriptsMgr.stop();
        } finally {
            clock.restore();
        }
        server = http.createServer();
        await api.init(server, runtime);
        server.on('request', api.apiApp);
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    });

    afterEach(async () => {
        if (server?.listening) await new Promise(resolve => server.close(resolve));
        usrstorage.close();
        for (const key of Object.keys(global).filter(key => key.startsWith('$'))) {
            if (!systemGlobals.has(key)) delete global[key];
        }
        for (const [key, value] of systemGlobals) global[key] = value;
        // SQLite closes asynchronously, so remove after its pending callbacks.
        await new Promise(resolve => setImmediate(resolve));
        fs.rmSync(workDir, { recursive: true, force: true });
    });

    it('allows administrators and the required role without a Groups bitmask', async () => {
        for (const username of ['admin', 'operator']) {
            const user = await login(username);
            const result = await run(user.token);
            assert.equal(result.status, 200);
            assert.equal(result.body, 42);
            assert.equal(tags.result, 42);
        }
    });

    it('rejects a view-only role and unauthenticated direct API calls', async () => {
        const viewer = await login('viewer');
        for (const token of [viewer.token, undefined, 'invalid-token']) {
            const result = await run(token);
            assert.equal(result.status, 400);
            assert.equal(result.body.error, 'unauthorized_error');
        }
        assert.deepEqual(tags, {});
    });

    it('does not trust supplied roles, permission fields, name or code', async () => {
        const viewer = await login('viewer');
        const forged = await request('/api/runscript', { groups: -1, info: { roles: ['role-operator'] }, params: {
            script: { id: 'allowed-id', name: 'allowed_script', parameters: [], permission: 0,
                permissionRoles: { enabled: ['role-viewer'] }, code: '$setTag("forged", 1);' }
        } }, viewer.token, { 'x-auth-user': JSON.stringify({ groups: -1, info: { roles: ['role-operator'] } }) });
        assert.equal(forged.status, 400);
        const operator = await login('operator');
        const allowed = await run(operator.token, {
            name: 'restricted_script', code: '$setTag("forged", 1);', permissionRoles: { enabled: [] }
        });
        assert.equal(allowed.status, 200);
        assert.equal(allowed.body, 42);
        const restricted = await run(operator.token, { id: 'restricted-id', name: 'allowed_script' });
        assert.equal(restricted.status, 400);
        assert.equal((await run(operator.token, { id: 'unknown-id' })).status, 400);
        assert.deepEqual(tags, { result: 42 });
    });

    it('keeps arbitrary script tests and system functions restricted to administrators', async () => {
        const operator = await login('operator');
        const result = await run(operator.token, { test: true, name: 'injected', code: '$setTag("forged", 1);' });
        assert.equal(result.status, 401);
        assert.equal((await request('/api/runSysFunction', { params: { functionName: '$setTag', parameters: ['forged', 1] } }, operator.token)).status, 400);
        assert.equal((await request('/api/setTagValue', { tags: [{ id: 'forged', value: 1 }] }, operator.token)).status, 401);
        assert.deepEqual(tags, {});
    });

    it('applies role changes from storage and cache on subsequent sign-in', async () => {
        const previous = await login('operator');
        assert.equal((await run(previous.token)).status, 200);
        await users.setUsers({ username: 'operator', groups: null, info: JSON.stringify({ roles: ['role-viewer'] }) });
        const current = await login('operator');
        assert.deepEqual(JSON.parse(current.info).roles, ['role-viewer']);
        assert.equal((await run(current.token)).status, 400);
        assert.equal((await run(previous.token)).status, 400);
    });

    it('preserves Groups allow and deny decisions', async () => {
        runtime.settings.userRole = false;
        await users.setUsers({ username: 'operator', groups: 2, info: '{}' });
        const operator = await login('operator');
        assert.equal((await run(operator.token)).status, 200);
        assert.equal((await run(operator.token, { id: 'restricted-id' })).status, 400);
        await users.setUsers({ username: 'viewer', groups: 1, info: '{}' });
        const viewer = await login('viewer');
        assert.equal((await run(viewer.token)).status, 400);
        assert.deepEqual(tags, { result: 42 });
    });
});
