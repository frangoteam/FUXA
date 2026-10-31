const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const rxjs = require('rxjs');

// Run the actual service and Run TEST handler. Angular, tag transport and the
// browser console are controlled; no scripts are sent to a server.
function runtime() {
    const browserLogs = [];
    const browserConsole = Object.fromEntries(['log', 'info', 'warn', 'error'].map(level =>
        [level, (...args) => browserLogs.push({ level, args })]));
    const decorator = () => () => {};
    const angular = { Injectable: decorator, Pipe: decorator, Component: decorator, ViewChild: decorator, Inject: decorator };
    function load(relative, imports = {}) {
        const filename = path.join(__dirname, '../src/app', relative);
        const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
            fileName: filename,
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
                experimentalDecorators: true }, reportDiagnostics: true
        });
        assert.equal(result.diagnostics.length, 0);
        const exports = {};
        vm.runInNewContext(result.outputText, { exports, console: browserConsole,
            require: name => imports[name] || {} }, { filename });
        return exports;
    }
    const models = load('_models/script.ts');
    const imports = {
        '@angular/core': angular, '@angular/common/http': { HttpHeaders: class {} }, rxjs,
        '../_models/script': models, '../../_models/script': models,
        '../../environments/environment': { environment: { serverEnabled: true } },
        '../_helpers/endpointapi': { EndPointApi: { getURL: () => '' } },
        '../_helpers/utils': load('_helpers/utils.ts', { '@angular/core': angular }),
        '../_models/device': { DeviceType: { internal: 'Internal' } }
    };
    const { ScriptService } = load('_services/script.service.ts', imports);
    const { ScriptEditorComponent } = load('scripts/script-editor/script-editor.component.ts', imports);
    const requests = [];
    let allowed = true;
    const project = { onLoadClientAccess: new rxjs.Subject(), onLoadHmi: new rxjs.Subject(),
        getTagFromId: () => null, getTagsValues: async () => [{ value: 42 }] };
    const service = new ScriptService({ post: (...args) => {
        requests.push(args); return rxjs.of('server-result');
    } }, project, {}, { checkPermission: () => ({ enabled: allowed }) }, {}, { notifyError() {} });
    function editor(code, mode = 'CLIENT') {
        const component = Object.create(ScriptEditorComponent.prototype);
        component.script = { id: 'test-script', name: 'script_test', mode, code };
        component.testParameters = [];
        component.console = [];
        let settle;
        const done = new Promise(resolve => { settle = resolve; });
        component.scriptService = { runScript: (...args) => service.runScript(...args).pipe(rxjs.finalize(settle)) };
        return { component, done, run() { component.onRunTest(); return done; } };
    }
    return { service, project, browserConsole, browserLogs, requests, editor,
        deny: () => { allowed = false; } };
}

for (const level of ['log', 'info', 'warn', 'error']) {
    test(`Run TEST shows client console.${level} after an asynchronous system function`, async () => {
        const r = runtime();
        const e = r.editor(`const value = $getTag('tag'); console.${level}('value', value); return value;`);
        await e.run();
        assert.deepEqual(e.component.console, ['value 42', '42']);
        assert.equal(r.browserLogs[0].level, level);
        assert.deepEqual(r.browserLogs[0].args, ['value', 42]);
        assert.equal(r.requests.length, 0);
    });
}

test('the client script from issue #2012 appears in Run TEST output', async () => {
    const r = runtime();
    // Original attachment's script_2; tag transport supplies the synthetic 42.
    const e = r.editor("var a = $getTag('t_c4bce5c1-c15a4b87' /* plc - var */);\nconsole.log(a);");
    await e.run();
    assert.equal(e.component.console[0], '42');
    assert.deepEqual(r.browserLogs[0].args, [42]);
    assert.equal(r.requests.length, 0);
});

test('Run TEST preserves zero, false, structured values and an undefined return', async () => {
    const r = runtime();
    const e = r.editor('console.log(0, false, {value: 0}, null, undefined);');
    await e.run();
    assert.equal(e.component.console[0], '0 false {"value":0} null undefined');
});

test('cyclic console arguments do not turn a successful test into an error', async () => {
    const r = runtime();
    const e = r.editor('const value = {}; value.self = value; console.log(value); return 7;');
    await e.run();
    assert.deepEqual(e.component.console, ['[object Object]', '7']);
});

test('concurrent tests retain their own console output and preserve the browser console', async () => {
    const r = runtime();
    const pending = [];
    r.project.getTagsValues = () => new Promise(resolve => pending.push(resolve));
    const originals = { ...r.browserConsole };
    const a = r.editor("console.log('first', $getTag('a')); return 1;");
    const b = r.editor("console.log('second', $getTag('b')); return 2;");
    a.component.onRunTest(); b.component.onRunTest();
    pending[1]([{ value: 20 }]); await b.done;
    pending[0]([{ value: 10 }]); await a.done;
    assert.deepEqual(a.component.console, ['first 10', '1']);
    assert.deepEqual(b.component.console, ['second 20', '2']);
    assert.deepEqual(r.browserConsole, originals);
});

test('ordinary client runs still log to the browser and preserve return values', async () => {
    const r = runtime();
    const value = await rxjs.lastValueFrom(r.service.runScript({ name: 'normal', mode: 'CLIENT',
        code: "console.log('ordinary'); return 3;", sync: true }));
    assert.equal(value, 3);
    assert.deepEqual(r.browserLogs, [{ level: 'log', args: ['ordinary'] }]);
});

test('server tests retain their existing response and request behavior', async () => {
    const r = runtime();
    const e = r.editor("console.log('server');", 'SERVER');
    await e.run();
    assert.deepEqual(e.component.console, ['"server-result"']);
    assert.equal(r.requests.length, 1);
    assert.equal(r.browserLogs.length, 0);
});

test('denied scripts never execute or produce client console output', async () => {
    const r = runtime(); r.deny();
    const e = r.editor("console.log('denied'); return 3;");
    await e.run();
    assert.deepEqual(e.component.console, ['null']);
    assert.equal(r.browserLogs.length, 0);
    assert.equal(r.requests.length, 0);
});

test('client execution errors still reach the test panel', async () => {
    const r = runtime();
    const e = r.editor("console.log('before error'); throw new Error('expected failure');");
    await e.run();
    assert.deepEqual(e.component.console, ['before error', 'expected failure']);
});
