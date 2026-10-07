const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

// Execute the real models without loading the Angular UI.
function load(relative, imports = {}) {
    const filename = path.join(__dirname, '../src/app/_models', relative);
    const { outputText, diagnostics } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        fileName: filename,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
        reportDiagnostics: true
    });
    assert.equal(diagnostics.length, 0);
    const exports = {};
    vm.runInNewContext(outputText, { exports, require: name => imports[name] || {} }, { filename });
    return exports;
}

const deviceModels = load('device.ts');
const { Variable } = load('hmi.ts', { './device': deviceModels });
const { DeviceType } = deviceModels;

function variable(type, init) {
    return new Variable('tag', 'Tag', {
        type: DeviceType.internal,
        tags: { tag: { id: 'tag', type, init } }
    });
}

test('internal numeric tags use configured initial values, including zero', () => {
    for (const [init, expected] of [['5', '5'], ['-2.5', '-2.5'], ['0', '0'], [0, '0']]) {
        assert.equal(variable('number', init).value, expected);
    }
});

test('internal boolean tags normalize initial values to the client 0/1 representation', () => {
    for (const init of ['1', 'true', ' TRUE ', true, 1]) {
        assert.equal(variable('boolean', init).value, '1');
    }
    for (const init of ['0', 'false', false, 0]) {
        assert.equal(variable('boolean', init).value, '0');
    }
});

test('internal string tags preserve text, numeric-looking strings and whitespace', () => {
    for (const init of ['abc', '0012', 'false', '  text  ', ' ']) {
        assert.equal(variable('string', init).value, init);
    }
});

test('missing, null and empty initial values use type defaults', () => {
    for (const init of [undefined, null, '']) {
        assert.equal(variable('number', init).value, '0');
        assert.equal(variable('boolean', init).value, '0');
        assert.equal(variable('string', init).value, '');
    }
});

test('incomplete internal device metadata does not throw', () => {
    assert.equal(new Variable('missing', '', { type: DeviceType.internal }).value, '0');
    assert.equal(new Variable('missing', '', { type: DeviceType.internal, tags: {} }).value, '0');
});

test('server-backed and placeholder variables wait for their runtime value', () => {
    assert.equal(new Variable('tag', '', { type: DeviceType.FuxaServer, tags: { tag: { init: '5' } } }).value, undefined);
    assert.equal(new Variable('tag', '').value, undefined);
});

test('initialization does not mutate project configuration or share runtime writes', () => {
    const tag = Object.freeze({ id: 'tag', type: 'number', init: '5', value: '99' });
    const device = Object.freeze({ type: DeviceType.internal, tags: Object.freeze({ tag }) });
    const first = new Variable('tag', '', device);
    first.value = '10';
    assert.equal(new Variable('tag', '', device).value, '5');
    assert.equal(tag.init, '5');
    assert.equal(tag.value, '99');
});

test('HMI registration uses init once and preserves later writes across gauge registrations', () => {
    const decorator = () => () => {};
    const { HmiService } = load('../_services/hmi.service.ts', {
        '@angular/core': { Injectable: decorator, Output: decorator },
        '../_models/device': deviceModels,
        '../_models/hmi': { Variable }
    });
    const device = { type: DeviceType.internal, tags: { tag: { type: 'number', init: '5' } } };
    const service = Object.create(HmiService.prototype);
    service.variables = {};
    service.projectService = { getDeviceFromTagId: () => device };
    const mappings = [];
    service.viewSignalGaugeMap = { add: (...args) => mappings.push(args) };
    service.addSignal('tag');
    assert.equal(service.variables.tag.value, '5');
    service.socket = { emit: () => assert.fail('internal writes must remain client-side') };
    service.deviceAdapaterService = { resolveAdapterTagsId: ids => ids };
    service.addFunctionType = 'add';
    service.removeFunctionType = 'remove';
    service.onVariableChanged = { emit: () => {} };
    service.putSignalValue('tag', '10');
    service.addSignalGaugeToMap('view', 'tag', {});
    service.addSignal('tag');
    assert.equal(service.variables.tag.value, '10');
    assert.equal(device.tags.tag.init, '5');
    assert.equal(mappings.length, 1);
    delete service.variables.tag;
    service.addSignalGaugeToMap('new-view', 'tag', {});
    assert.equal(service.variables.tag.value, '5');
});
