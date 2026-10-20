const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

// Run production classes, stubbing Angular decorators and unrelated controls only.
const app = path.join(__dirname, '../src/app');
const cache = new Map();
const decorator = () => () => {};
class EventEmitter {
    listeners = [];
    emit(value) { this.listeners.forEach(listener => listener(value)); }
    subscribe(listener) { this.listeners.push(listener); }
}
const angular = new Proxy({ EventEmitter }, { get: (target, key) => target[key] || decorator });
const unrelated = new Proxy({}, { get: (_target, key) => class { static TypeTag = String(key); } });
const production = new Set([
    '_models/device.ts', '_models/hmi.ts', '_helpers/utils.ts',
    'gauges/gauge-base/gauge-base.component.ts', 'gauges/gauges.component.ts',
    'gauges/controls/html-switch/html-switch.component.ts',
    'gauges/controls/html-button/html-button.component.ts',
    'gui-helpers/ngx-switch/ngx-switch.component.ts',
    '_services/hmi.service.ts', 'fuxa-view/fuxa-view.component.ts'
]);
let timers;
function load(relative) {
    if (cache.has(relative)) return cache.get(relative);
    const filename = path.join(app, relative);
    const { outputText, diagnostics } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        fileName: filename,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
        reportDiagnostics: true
    });
    assert.equal(diagnostics.length, 0);
    const exports = {};
    cache.set(relative, exports);
    vm.runInNewContext(outputText, {
        exports, console,
        setTimeout: callback => { timers.push(callback); return callback; },
        clearTimeout: callback => { timers = timers.filter(timer => timer !== callback); },
        require(name) {
            if (name === '@angular/core') return angular;
            if (name.endsWith('/environment')) return { environment: { serverEnabled: true } };
            const resolved = path.relative(app, path.resolve(path.dirname(filename), name + '.ts')).replaceAll('\\', '/');
            return production.has(resolved) ? load(resolved) : unrelated;
        }
    }, { filename });
    return exports;
}
const { NgxSwitchComponent } = load('gui-helpers/ngx-switch/ngx-switch.component.ts');
const { HtmlSwitchComponent } = load('gauges/controls/html-switch/html-switch.component.ts');
const { GaugesManager } = load('gauges/gauges.component.ts');
const { HmiService } = load('_services/hmi.service.ts');
const { FuxaViewComponent } = load('fuxa-view/fuxa-view.component.ts');
const { DeviceType } = load('_models/device.ts');
const { Variable } = load('_models/hmi.ts');

function runtime({ initial = '0', events = [{ type: 'click', action: 'onToggleValue' }], external = false, bitmask } = {}) {
    timers = [];
    const hmi = Object.create(HmiService.prototype);
    const writes = [], commands = [], controls = [], svg = {};
    const device = { id: 'simulation', type: external ? DeviceType.SiemensS7 : DeviceType.internal, tags: {} };
    hmi.variables = { tag: { id: 'tag', value: initial }, other: { id: 'other', value: '0' } };
    for (const id of Object.keys(hmi.variables)) device.tags[id] = { id, value: hmi.variables[id].value };
    if (!external) {
        device.tags.tag = { id: 'tag', type: bitmask ? 'number' : 'boolean', init: initial };
        hmi.variables.tag = new Variable('tag', 'Tag', device);
    }
    hmi.deviceAdapaterService = { resolveAdapterTagsId: ids => ids };
    hmi.projectService = { getDeviceFromTagId: () => device };
    hmi.socket = { emit: (type, payload) => commands.push({ type, payload: JSON.parse(JSON.stringify(payload)) }) };
    hmi.onVariableChanged = new EventEmitter();
    const put = hmi.putSignalValue.bind(hmi);
    hmi.putSignalValue = (id, value, fnc) => { writes.push([id, value]); put(id, value, fnc); };
    const manager = Object.create(GaugesManager.prototype);
    manager.hmiService = hmi;
    manager.mapGauges = {};
    manager.onevent = new EventEmitter();
    const view = Object.create(FuxaViewComponent.prototype);
    view.gaugesManager = manager;
    const scripts = [];
    view.eventRunScript = 'onRunScript';
    view.onRunScript = event => scripts.push(event.actparam);
    FuxaViewComponent.getSvgElement = id => svg[id];

    function addControl(controlEvents = events, type = HtmlSwitchComponent.TypeTag) {
        const id = 'control-' + controls.length;
        const ga = { id, type, property: { variableId: 'tag', bitmask, events: controlEvents, options: { offValue: 0, onValue: bitmask || 1 } } };
        const control = new NgxSwitchComponent();
        const element = () => ({ style: {}, classList: { toggle() {} } });
        control.switcher = { nativeElement: { checked: false } };
        control.toggler = { nativeElement: element() };
        control.slider = { nativeElement: element() };
        control.options = { ...control.options, ...ga.property.options, height: 28 };
        manager.mapGauges[id] = control;
        const handlers = {};
        svg[id] = Object.fromEntries(['click', 'dblclick', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'mouseover', 'mouseout']
            .map(name => [name, handler => { handlers[name] = handler; }]));
        // Real event binding, direct-write path, click dispatch, toggle and service write.
        view.onBindMouseEvents(ga);
        manager.bindGaugeEventToSignal(ga);
        function sync(signal) {
            if (signal.id === ga.property.variableId) HtmlSwitchComponent.processValue(ga, null, signal, {}, control);
        }
        hmi.onVariableChanged.subscribe(sync);
        sync(hmi.variables.tag);
        const result = { ga, control, handlers,
            click() {
                // Native checkbox pre-activation -> bubbling click -> change -> click timer.
                control.switcher.nativeElement.checked = !control.switcher.nativeElement.checked;
                handlers.click?.({ preventDefault() {} });
                if (type === HtmlSwitchComponent.TypeTag) control.onClick();
                while (timers.length) timers.shift()();
            }
        };
        controls.push(result);
        return result;
    }
    return { hmi, manager, view, writes, commands, scripts, addControl, first: addControl(),
        echo(value) { hmi.onDeviceValues([{ id: 'tag', value }]); }
    };
}

for (const initial of ['0', '1', false, true]) {
    test(`one click toggles ${JSON.stringify(initial)} once and synchronizes both switches`, () => {
        const r = runtime({ initial });
        const second = r.addControl();
        const expected = initial === '0' || initial === false ? '1' : '0';
        r.first.click();
        assert.equal(Number(r.hmi.variables.tag.value), Number(expected));
        assert.equal(r.writes.length, 1, 'one logical write per click');
        assert.equal(r.first.control.checked, expected === '1');
        assert.equal(second.control.checked, expected === '1');
        assert.equal(r.commands.length, 0, 'internal tags do not send device commands');
    });
}

test('repeated clicks and a recreated view keep the shared tag in sync', () => {
    const r = runtime();
    const second = r.addControl();
    for (let i = 0; i < 6; i++) {
        (i % 2 ? second : r.first).click();
        assert.equal(r.hmi.variables.tag.value, i % 2 ? '0' : '1');
        assert.equal(r.writes.length, i + 1);
        assert.equal(r.first.control.checked, i % 2 === 0);
        assert.equal(second.control.checked, i % 2 === 0);
    }
    r.first.click();
    const reloaded = r.addControl();
    assert.equal(reloaded.control.checked, true);
    reloaded.click();
    assert.equal(r.hmi.variables.tag.value, '0');
    assert.equal(r.writes.length, 8);
});

test('device-backed toggle sends one command and accepts delayed server confirmation', () => {
    const r = runtime({ external: true });
    const second = r.addControl();
    r.first.click();
    assert.deepEqual(r.commands.map(command => [command.type, command.payload.cmd, command.payload.var.value]), [['device-values', 'set', '1']]);
    assert.equal(r.first.control.checked, true);
    assert.equal(second.control.checked, false, 'peer waits for server notification');
    r.echo('1');
    assert.equal(second.control.checked, true);
    assert.equal(r.commands.length, 1, 'server echo does not write again');
    r.first.click();
    r.echo('0');
    assert.equal(r.first.control.checked, false);
    assert.equal(second.control.checked, false);
    assert.equal(r.commands.length, 2);
});

test('explicit toggle of the bound variable and bitmask preserves other bits', () => {
    const r = runtime({ initial: '8', bitmask: 2, events: [{ type: 'click', action: 'onToggleValue', actoptions: { variable: { variableId: 'tag', bitmask: 2 } } }] });
    r.first.click();
    assert.deepEqual(r.writes, [['tag', '10']]);
    assert.equal(r.first.control.checked, true);
    r.first.click();
    assert.deepEqual(r.writes, [['tag', '10'], ['tag', '8']]);
    assert.equal(r.first.control.checked, false);
});

test('plain switch and unrelated script events retain their normal write', () => {
    for (const events of [[], [{ type: 'click', action: 'onRunScript', actparam: 'script' }]]) {
        const r = runtime({ events });
        r.first.click();
        assert.deepEqual(r.writes, [['tag', '1']]);
        assert.equal(r.first.control.checked, true);
        assert.equal(r.scripts.length, events.length);
    }
});

test('toggle of a different tag retains both independent writes', () => {
    const r = runtime({ events: [{ type: 'click', action: 'onToggleValue', actoptions: { variable: { variableId: 'other' } } }] });
    r.first.click();
    assert.deepEqual(r.writes, [['tag', '1'], ['other', '1']]);
});

test('toggle of a different bit retains both independent writes', () => {
    const r = runtime({ initial: '0', bitmask: 2, events: [{ type: 'click', action: 'onToggleValue', actoptions: { variable: { variableId: 'tag', bitmask: 4 } } }] });
    r.first.click();
    assert.deepEqual(r.writes, [['tag', '2'], ['tag', '6']]);
});

test('touch click action toggles once and prevents the synthetic mouse click', () => {
    const r = runtime();
    let prevented = false;
    r.first.handlers.touchstart({ preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.deepEqual(r.writes, [['tag', '1']]);
    assert.equal(r.first.control.checked, true);
});

test('server updates, option refresh and disabling the switch never issue writes', () => {
    const r = runtime({ external: true });
    r.echo('1');
    r.first.control.setOptions(r.first.control.options);
    while (timers.length) timers.shift()();
    r.first.control.setDisabled(true);
    assert.equal(r.first.control.checked, true);
    assert.equal(r.first.control.switcher.nativeElement.disabled, true);
    assert.deepEqual(r.writes, []);
    assert.deepEqual(r.commands, []);
});

test('non-click Toggle events do not suppress the ordinary checkbox write', () => {
    const r = runtime({ events: [{ type: 'mouseover', action: 'onToggleValue' }] });
    r.first.click();
    assert.deepEqual(r.writes, [['tag', '1']]);
});

test('Set Value and regular button Toggle keep existing event behavior', () => {
    const r = runtime({ events: [{ type: 'click', action: 'onSetValue', actparam: '5' }] });
    r.first.click();
    assert.deepEqual(r.writes, [['tag', '1'], ['tag', '5']]);
    const button = r.addControl([{ type: 'click', action: 'onToggleValue' }], 'svg-ext-html_button');
    r.echo('0');
    r.writes.length = 0;
    button.click();
    assert.deepEqual(r.writes, [['tag', '1']]);
});
