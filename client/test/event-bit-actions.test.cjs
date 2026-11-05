const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

// Load the real sources with Angular and unrelated imports replaced by stubs.
const decorator = () => undefined;
const stub = new Proxy(function () {}, { get: (_, name) => name === '__esModule' ? false : (name === 'prototype' ? {} : stub), apply: () => decorator });
function load(relative, imports = {}) {
    const filename = path.join(__dirname, '../src/app', relative);
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        fileName: filename,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true }
    });
    const exports = {};
    vm.runInNewContext(outputText, { exports, console, require: name => imports[name] || stub }, { filename });
    return exports;
}

const { Utils } = load('_helpers/utils.ts');
const { GaugeEventActionType } = load('_models/hmi.ts');
const { GaugeBaseComponent } = load('gauges/gauge-base/gauge-base.component.ts');
const { GaugesManager } = load('gauges/gauges.component.ts', {
    '../_helpers/utils': { Utils },
    './gauge-base/gauge-base.component': { GaugeBaseComponent }
});

function manager(values) {
    const writes = [];
    const variables = {};
    Object.keys(values).forEach(id => { variables[id] = { value: values[id] }; });
    const self = { hmiService: { variables }, putSignalValue: (id, value) => writes.push([id, value]) };
    return { writes, setBits: (...args) => GaugesManager.prototype.setSignalBits.apply(self, args) };
}

test('set and reset bit actions are available as event actions', () => {
    assert.equal(GaugeEventActionType.onSetBit, 'shapes.event-onsetbit');
    assert.equal(GaugeEventActionType.onResetBit, 'shapes.event-onresetbit');
    for (const lang of fs.readdirSync(path.join(__dirname, '../src/assets/i18n'))) {
        const text = fs.readFileSync(path.join(__dirname, '../src/assets/i18n', lang), 'utf8').replace(/^\uFEFF/, '');
        const json = JSON.parse(text);
        assert.ok(json['shapes.event-onsetbit'], lang);
        assert.ok(json['shapes.event-onresetbit'], lang);
    }
});

test('bitmask helpers only change the selected bits', () => {
    assert.equal(GaugeBaseComponent.setBitmask(0b1000, 0b0011), 0b1011);
    assert.equal(GaugeBaseComponent.setBitmask(0b1011, 0b0001), 0b1011);
    assert.equal(GaugeBaseComponent.resetBitmask(0b1011, 0b0011), 0b1000);
    assert.equal(GaugeBaseComponent.resetBitmask(0b1000, 0b0001), 0b1000);
});

test('setSignalBits writes the masked value of the current tag value', () => {
    const m = manager({ t1: 8, t2: '11' });
    m.setBits('t1', true, 4);
    m.setBits('t2', false, 3);
    m.setBits('t2', true, 16);
    assert.deepEqual(m.writes, [['t1', '12'], ['t2', '8'], ['t2', '27']]);
});

test('setSignalBits without bitmask writes 1 or 0', () => {
    const m = manager({ t1: 5 });
    m.setBits('t1', true);
    m.setBits('t1', false, 0);
    m.setBits('unknown', true);
    assert.deepEqual(m.writes, [['t1', '1'], ['t1', '0'], ['unknown', '1']]);
});

test('setSignalBits with bitmask skips unknown or empty tag values', () => {
    const m = manager({ t1: null });
    m.setBits('t1', true, 1);
    m.setBits('missing', false, 1);
    assert.deepEqual(m.writes, []);
});
