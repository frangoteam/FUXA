const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function runtime(nodeName = 'INPUT', valid = true) {
    const filename = path.join(__dirname, '../src/app/fuxa-view/fuxa-view.component.ts');
    const { outputText, diagnostics } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        fileName: filename,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
        reportDiagnostics: true
    });
    assert.equal(diagnostics.length, 0);
    const decorator = () => () => {};
    const imports = {
        '@angular/core': { Component: decorator, Input: decorator, Output: decorator, ViewChild: decorator, HostListener: decorator },
        '../_models/hmi': { InputActionEscType: { enter: 'enter', update: 'update' }, GaugeEventType: { enter: 'enter' }, GaugeStatus: class {} },
        '../gauges/controls/html-input/html-input.component': { HtmlInputComponent: {
            TypeTag: 'input', SkipEnterEvent: ['textarea'], InputDateTimeType: [],
            validateValue: value => ({ valid, value }), getEvents: () => []
        } }
    };
    const exports = {};
    class KeyboardEvent {
        constructor(type, properties) { this.type = type; Object.assign(this, properties); }
    }
    vm.runInNewContext(outputText, { exports, KeyboardEvent, require: name => imports[name] || {} }, { filename });
    const { FuxaViewComponent } = exports;
    FuxaViewComponent.getSvgElements = () => [];
    const view = Object.create(FuxaViewComponent.prototype);
    const writes = [], scripts = [], warnings = [];
    view.hmi = { layout: { inputdialog: 'false' } };
    view.gaugesManager = { putEvent: event => writes.push(event.value), getBindSignalsValue: () => [] };
    view.eventForScript = (_events, value) => scripts.push(value);
    view.setInputValidityMessage = value => warnings.push(value);
    const dom = {
        id: 'input-test', nodeName, value: '10', focused: true,
        setCustomValidity() {},
        dispatchEvent(event) { this.onkeydown(event); },
        blur() {
            // Browser blur is synchronous and only fires when focus actually changes.
            if (!this.focused) return;
            this.focused = false;
            this.onblur?.({ currentTarget: this });
        }
    };
    const event = { type: 'key-enter', dom, ga: { type: 'input', property: { options: { actionOnEsc: 'enter' } } } };
    view.onBindHtmlEvent(event);
    return { view, dom, writes, scripts, warnings };
}

test('Enter with Confirm on leave submits and runs enter actions exactly once', () => {
    const { dom, writes, scripts } = runtime();
    dom.dispatchEvent({ key: 'Enter' });
    assert.deepEqual(writes, ['10']);
    assert.deepEqual(scripts, ['10']);
    assert.equal(dom.focused, false);
});

test('ordinary focus loss still confirms the edited value once', () => {
    const { dom, writes, scripts } = runtime();
    dom.blur();
    assert.deepEqual(writes, ['10']);
    assert.deepEqual(scripts, ['10']);
});

test('later edits can still confirm after an Enter submission', () => {
    const { dom, writes } = runtime();
    dom.dispatchEvent({ key: 'Enter' });
    dom.focused = true;
    dom.value = '20';
    dom.blur();
    assert.deepEqual(writes, ['10', '20']);
});

test('invalid Enter does not write or force focus loss', () => {
    const { dom, writes, warnings } = runtime('INPUT', false);
    dom.dispatchEvent({ key: 'Enter' });
    assert.deepEqual(writes, []);
    assert.equal(warnings.length, 1);
    assert.equal(dom.focused, true);
});

test('textarea newline remains unsubmitted, while Ctrl+Enter commits once', () => {
    const { dom, writes } = runtime('TEXTAREA');
    dom.dispatchEvent({ key: 'Enter' });
    assert.deepEqual(writes, []);
    dom.dispatchEvent({ key: 'Enter', ctrlKey: true });
    assert.deepEqual(writes, ['10']);
});
