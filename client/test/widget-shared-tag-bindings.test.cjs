const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

// Execute the shipped widget compiler and signal handler. Only Angular,
// unrelated gauge colors and the transport/DOM boundary are controlled.
function runtime(bindings) {
    const seen = [], errors = [], window = {};
    const decorator = () => () => {};
    const angular = { Component: decorator, Injectable: decorator, Pipe: decorator };
    function load(relative, imports) {
        const filename = path.join(__dirname, '../src/app', relative);
        const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
            fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2022, experimentalDecorators: true }, reportDiagnostics: true
        });
        assert.equal(result.diagnostics.length, 0);
        const exports = {};
        vm.runInNewContext(result.outputText, { exports, window,
            console: { error: (...args) => errors.push(args) },
            require: id => imports[id] || {} }, { filename });
        return exports;
    }
    const utils = load('_helpers/utils.ts', { '@angular/core': angular });
    const svg = load('_helpers/svg-utils.ts', { '@angular/core': angular, './utils': utils });
    const { HtmlImageComponent } = load('gauges/controls/html-image/html-image.component.ts', {
        '@angular/core': angular,
        '../../gauge-base/gauge-base.component': { GaugeBaseComponent: class {
            static checkBitmask(mask, value) { return value; }
        } },
        '../../../_models/hmi': { GaugeActionsType: {}, GaugePropertyColor: class {} },
        '../../../_models/device': { DeviceType: { WebCam: 'WebCam' } },
        '../../../_helpers/endpointapi': { EndPointApi: { getURL: () => '' } },
        '../../../_helpers/utils': utils, '../../../_helpers/svg-utils': svg
    });
    const compiled = svg.SvgUtils.processWidget(`//!export-start
var _pn_first = 0;
var _pn_second = 0;
//!export-end
function putValue(name, value) { seen.push([name, value]); }`, 'widget_test', {}, []);
    vm.runInNewContext(svg.SvgUtils.initWidget(compiled.content, compiled.vars), { window, seen });
    const ga = { property: { type: 'widget', scriptContent: { moduleId: 'widget_test' },
        varsToBind: Object.freeze(bindings.map(b => Object.freeze(b))) } };
    const before = JSON.stringify(ga);
    function signal(id, value) {
        HtmlImageComponent.processValue(ga, { node: {} }, { id, value }, {});
        assert.equal(errors.length, 0);
        assert.equal(JSON.stringify(ga), before);
    }
    return { signal, seen, signals: HtmlImageComponent.getSignals(ga.property) };
}

for (const value of [15, 0, false, 'running']) {
    test(`one tag updates both widget variables with ${JSON.stringify(value)}`, () => {
        const r = runtime([{ name: '_pn_first', variableId: 'shared' },
            { name: '_pn_second', variableId: 'shared' }, { name: '_pn_other', variableId: 'other' }]);
        r.signal('shared', value);
        assert.deepEqual(r.seen.map(a => Array.from(a)), [['_pn_first', value], ['_pn_second', value]]);
        assert.deepEqual(Array.from(r.signals), ['shared', 'shared', 'other']);
    });
}

test('different tag bindings retain their individual values across updates', () => {
    const r = runtime([{ name: '_pn_first', variableId: 'first' }, { name: '_pn_second', variableId: 'second' }]);
    r.signal('second', 20); r.signal('first', 10); r.signal('second', 21);
    assert.deepEqual(r.seen.map(a => Array.from(a)), [['_pn_second', 20], ['_pn_first', 10], ['_pn_second', 21]]);
});

test('unknown signals do not update widget variables', () => {
    const r = runtime([{ name: '_pn_first', variableId: 'first' }]);
    r.signal('missing', 20);
    assert.equal(r.seen.length, 0);
});

test('empty widget bindings remain inert', () => {
    const r = runtime([]); r.signal('missing', 20);
    assert.equal(r.seen.length, 0);
});
