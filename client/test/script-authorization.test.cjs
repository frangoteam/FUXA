const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const rxjs = require('rxjs');

// Run the production services and permission helpers. Only Angular decorators,
// browser storage and HTTP transport are replaced; permission checks are real.
function createRuntime(groups, roles, userRole = true) {
    const storage = new Map();
    const sessionStorage = {
        getItem: key => storage.get(key) || null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: key => storage.delete(key)
    };
    const window = {};
    const decorator = () => () => {};
    const angular = { Injectable: decorator, Pipe: decorator };
    function load(relative, imports = {}) {
        const filename = path.join(__dirname, '../src/app', relative);
        const { outputText, diagnostics } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
            fileName: filename,
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2022,
                experimentalDecorators: true
            },
            reportDiagnostics: true
        });
        assert.equal(diagnostics.length, 0);
        const exports = {};
        vm.runInNewContext(outputText, {
            exports, console, window, sessionStorage,
            atob: value => Buffer.from(value, 'base64').toString('binary'),
            require: name => imports[name] || {}
        }, { filename });
        return exports;
    }
    const settingsValue = { secureEnabled: true, userRole };
    const settings = {
        getSettings: () => settingsValue,
        settings$: new rxjs.BehaviorSubject(settingsValue),
        refreshSettings: () => rxjs.of(settingsValue)
    };
    const token = 'test.' + Buffer.from(JSON.stringify({ exp: 4102444800 })).toString('base64') + '.test';
    let profile = { username: 'operator', groups, info: JSON.stringify({ roles }), token };
    const requests = [];
    const http = {
        post(url, body) {
            if (url.endsWith('/api/signin')) return rxjs.of({ data: { ...profile } });
            requests.push({ url, body });
            return rxjs.of('server-result');
        }
    };
    const common = {
        '@angular/core': angular,
        '@angular/common/http': { HttpHeaders: class {} },
        rxjs,
        'rxjs/operators': require('rxjs/operators'),
        '../../environments/environment': { environment: { serverEnabled: true } },
        '../_helpers/endpointapi': { EndPointApi: { getURL: () => '' } },
        '../_helpers/utils': load('_helpers/utils.ts', { '@angular/core': angular }),
        '../_models/user': load('_models/user.ts'),
        '../_models/script': load('_models/script.ts')
    };
    const { AuthService } = load('_services/auth.service.ts', common);
    const { ScriptService } = load('_services/script.service.ts', common);
    let auth;
    const errors = [];
    function restoreAuth() {
        auth = new AuthService(http, settings);
        return auth;
    }
    restoreAuth();
    const scripts = new ScriptService(http, {
        onLoadClientAccess: new rxjs.Subject(), onLoadHmi: new rxjs.Subject()
    }, {}, auth, {}, { notifyError: (...args) => errors.push(args) });
    scripts.clientRuns = 0;
    return {
        scripts, requests, errors,
        get auth() { return auth; },
        signIn: () => rxjs.lastValueFrom(auth.signIn('operator', 'test-password')),
        setRoles: value => { profile = { ...profile, info: JSON.stringify({ roles: value }) }; },
        restoreAuth
    };
}

function script(mode, extra = {}) {
    return {
        id: 'script-id', name: 'authorized_script', mode, parameters: [], sync: true,
        code: 'this.clientRuns += 1; return this.clientRuns;', ...extra
    };
}

for (const groups of [undefined, null, 0, 2]) {
    for (const mode of ['SERVER', 'CLIENT']) {
        test(`Roles user with groups=${groups} executes filtered ${mode} script metadata`, async () => {
            const runtime = createRuntime(groups, ['role-operator']);
            await runtime.signIn();
            // Project filtering removes permission and permissionRoles only after
            // the server authorises the saved script for this user.
            const result = await rxjs.lastValueFrom(runtime.scripts.runScript(script(mode)));
            assert.equal(result, mode === 'SERVER' ? 'server-result' : 1);
            assert.equal(runtime.requests.length, mode === 'SERVER' ? 1 : 0);
            assert.equal(runtime.errors.length, 0);
            assert.equal(runtime.auth.isAdmin(), false);
        });
    }
}

for (const mode of ['SERVER', 'CLIENT']) {
    test(`${mode} execution still checks explicitly configured script roles`, async () => {
        const runtime = createRuntime(0, ['role-viewer']);
        await runtime.signIn();
        const restricted = script(mode, { permissionRoles: { enabled: ['role-operator'] } });
        assert.equal(await rxjs.lastValueFrom(runtime.scripts.runScript(restricted)), null);
        assert.equal(runtime.requests.length, 0);
        assert.equal(runtime.scripts.clientRuns, 0);
        assert.equal(runtime.errors.length, 1);
        assert.equal(runtime.auth.checkPermission({ permissionRoles: {
            show: ['role-viewer'], enabled: ['role-operator']
        } }).enabled, false);
        runtime.setRoles(['role-operator']);
        await runtime.signIn();
        assert.equal(runtime.auth.checkPermission(restricted).enabled, true);
        assert.equal(await rxjs.lastValueFrom(runtime.scripts.runScript(restricted)),
            mode === 'SERVER' ? 'server-result' : 1);
    });

    test(`administrator executes ${mode} scripts`, async () => {
        const runtime = createRuntime(-1, []);
        await runtime.signIn();
        assert.equal(await rxjs.lastValueFrom(runtime.scripts.runScript(script(mode, {
            permissionRoles: { enabled: ['role-operator'] }
        }))), mode === 'SERVER' ? 'server-result' : 1);
    });

    test(`Groups authorization is preserved for ${mode} scripts`, async () => {
        const runtime = createRuntime(2, [], false);
        await runtime.signIn();
        assert.equal(await rxjs.lastValueFrom(runtime.scripts.runScript(script(mode, { permission: 4 }))), null);
        assert.equal(runtime.requests.length, 0);
        assert.equal(runtime.scripts.clientRuns, 0);
        assert.equal(await rxjs.lastValueFrom(runtime.scripts.runScript(script(mode, { permission: 2 }))),
            mode === 'SERVER' ? 'server-result' : 1);
    });
}

test('missing Roles permissions respect the caller default without requiring Groups membership', async () => {
    const runtime = createRuntime(0, ['role-operator']);
    await runtime.signIn();
    for (const permissionRoles of [undefined, null]) {
        assert.equal(runtime.auth.checkPermission({ permissionRoles }).enabled, false);
        assert.equal(runtime.auth.checkPermission({ permissionRoles }, true).enabled, true);
    }
});

test('sign-in, session restoration and subsequent sign-in use current role IDs', async () => {
    const runtime = createRuntime(null, ['role-operator']);
    const restricted = { permissionRoles: { enabled: ['role-operator'] } };
    await runtime.signIn();
    assert.equal(runtime.auth.checkPermission(restricted).enabled, true);
    runtime.restoreAuth();
    assert.equal(runtime.auth.checkPermission(restricted).enabled, true);
    runtime.setRoles(['role-viewer']);
    await runtime.signIn();
    assert.equal(runtime.auth.checkPermission(restricted).enabled, false);
    runtime.restoreAuth();
    assert.equal(runtime.auth.checkPermission(restricted).enabled, false);
});
