const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

// Execute the actual component and timer helper without starting an Angular UI
// or running a user script. Only unrelated services and decorators are stubbed.
function createRuntime() {
    let now = 0;
    let nextId = 0;
    const timers = new Map();
    const setTimer = (fn, delay, repeat) => {
        const id = ++nextId;
        timers.set(id, { fn, delay, repeat, due: now + delay });
        return id;
    };
    const timerGlobals = {
        setInterval: (fn, delay) => setTimer(fn, delay, true),
        setTimeout: (fn, delay) => setTimer(fn, delay, false),
        clearInterval: id => timers.delete(id),
        clearTimeout: id => timers.delete(id)
    };
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
            exports, console, ...timerGlobals,
            require: name => imports[name] || {}
        }, { filename });
        return exports;
    }
    const models = load('_models/script.ts');
    const { Intervals } = load('_helpers/intervals.ts');
    const decorator = () => () => {};
    const { HomeComponent } = load('home/home.component.ts', {
        '@angular/core': { Component: decorator, ViewChild: decorator, Inject: decorator },
        'rxjs/operators': { takeUntil: () => {}, filter: () => {} },
        '../_models/script': models,
        '../_helpers/intervals': { Intervals }
    });
    function createHome(scripts) {
        const home = Object.create(HomeComponent.prototype);
        const calls = [];
        home.intervalsScript = new Intervals();
        home.projectService = { getScripts: () => scripts };
        home.scriptService = {
            evalScript(script) {
                assert.equal(this, home.scriptService);
                calls.push(script.id);
            }
        };
        home.destroy$ = { next() {}, complete() {} };
        return { home, calls };
    }
    function tick(duration) {
        const end = now + duration;
        while (true) {
            const next = [...timers].filter(([, timer]) => timer.due <= end)
                .sort((a, b) => a[1].due - b[1].due)[0];
            if (!next) break;
            const [id, timer] = next;
            now = timer.due;
            if (timer.repeat) timer.due += timer.delay;
            else timers.delete(id);
            timer.fn();
        }
        now = end;
    }
    return { createHome, tick, timers };
}

function script(id, mode = 'start', interval = 1, location = 'CLIENT') {
    return { id, mode: location, scheduling: { mode, interval } };
}

test('HMI load events start a fresh schedule and destruction removes the subscription', () => {
    const runtime = createRuntime();
    const { home, calls } = runtime.createHome([script('startup')]);
    const listeners = new Set();
    home.projectService.onLoadHmi = {
        subscribe(callback) {
            listeners.add(callback);
            return { unsubscribe: () => listeners.delete(callback) };
        }
    };
    home.projectService.getHmi = () => ({});
    home.loadHmi = () => {};
    home.checkDateTimeTimer = () => {};
    const idleEvent = { subscribe: () => ({ unsubscribe() {} }) };
    home.hmiService = { onAlarmsStatus: idleEvent, onGoTo: idleEvent, onOpen: idleEvent };
    home.languageService = {};
    home.authService = {};
    home.gaugesManager = { onchange: { pipe: () => idleEvent } };
    home.ngOnInit();
    assert.equal(listeners.size, 1);
    const emitLoad = () => listeners.forEach(callback => callback());
    emitLoad();
    runtime.tick(3000);
    assert.deepEqual(calls, ['startup']);
    emitLoad();
    runtime.tick(3000);
    assert.deepEqual(calls, ['startup', 'startup']);
    home.ngOnDestroy();
    assert.equal(listeners.size, 0);
    emitLoad();
    runtime.tick(3000);
    assert.equal(calls.length, 2);
});

test('Only on Start waits for its delay and executes once, while intervals repeat', () => {
    const runtime = createRuntime();
    const { home, calls } = runtime.createHome([script('startup'), script('periodic', 'interval')]);
    home.initScheduledScripts();
    runtime.tick(999);
    assert.deepEqual(calls, []);
    runtime.tick(1);
    assert.deepEqual(calls, ['startup', 'periodic']);
    runtime.tick(3000);
    assert.equal(calls.filter(id => id === 'startup').length, 1);
    assert.equal(calls.filter(id => id === 'periodic').length, 4);
    home.ngOnDestroy();
    assert.equal(runtime.timers.size, 0);
});

test('reinitialization cancels stale timers and schedules changed startup scripts once', () => {
    const runtime = createRuntime();
    const scripts = [script('old')];
    const { home, calls } = runtime.createHome(scripts);
    home.initScheduledScripts();
    runtime.tick(500);
    scripts.splice(0, 1, script('new'));
    home.initScheduledScripts();
    runtime.tick(999);
    assert.deepEqual(calls, []);
    runtime.tick(2001);
    assert.deepEqual(calls, ['new']);
    home.initScheduledScripts();
    runtime.tick(3000);
    assert.deepEqual(calls, ['new', 'new']);
});

test('destroy cancels pending work and separate clients have independent lifecycles', () => {
    const runtime = createRuntime();
    const first = runtime.createHome([script('startup')]);
    const second = runtime.createHome([script('startup')]);
    first.home.initScheduledScripts();
    second.home.initScheduledScripts();
    first.home.ngOnDestroy();
    runtime.tick(3000);
    assert.deepEqual(first.calls, []);
    assert.deepEqual(second.calls, ['startup']);
    const restarted = runtime.createHome([script('startup')]);
    restarted.home.initScheduledScripts();
    runtime.tick(3000);
    assert.deepEqual(restarted.calls, ['startup']);
});

test('server scripts and disabled/manual schedules are not automatically run', () => {
    const runtime = createRuntime();
    const { home, calls } = runtime.createHome([
        script('server', 'start', 1, 'SERVER'),
        script('manual', 'interval', 0), script('negative', 'interval', -1),
        { id: 'unscheduled', mode: 'CLIENT' },
        script('legacy', undefined)
    ]);
    // A missing scheduling mode historically means an interval.
    delete home.projectService.getScripts()[4].scheduling.mode;
    home.initScheduledScripts();
    runtime.tick(3000);
    assert.deepEqual(calls, ['legacy', 'legacy', 'legacy']);
    home.ngOnDestroy();
    runtime.tick(3000);
    assert.equal(calls.length, 3);
});
