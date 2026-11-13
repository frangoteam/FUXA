const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function loadHtmlInput() {
    const filename = path.join(__dirname, '../src/app/gauges/controls/html-input/html-input.component.ts');
    const { outputText, diagnostics } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        fileName: filename,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
        reportDiagnostics: true
    });
    assert.equal(diagnostics.length, 0);

    class FakeInput {
        constructor() {
            this.id = 'I-HXI_time';
            this.value = '';
            this.style = { setProperty() {} };
            this.parentElement = null;
            this.dispatchedValues = [];
        }
        setAttribute(name, value) { this[name] = value; }
        dispatchEvent(event) {
            this.dispatchedValues.push({ type: event.type, key: event.key, value: this.value });
            return true;
        }
    }
    class FakeTextArea extends FakeInput {}
    class FakeButton {
        constructor() {
            this.style = {};
            this.listeners = {};
        }
        appendChild() {}
        addEventListener(type, listener) { this.listeners[type] = listener; }
        fire(type) { this.listeners[type]?.({ type }); }
    }

    const input = new FakeInput();
    const button = new FakeButton();
    const parent = { insertBefore(node) { if (node === button) input.parentElement = parent; } };
    input.parentElement = parent;
    const ele = {
        setAttribute() {},
        getElementsByTagName(name) {
            if (name === 'foreignObject') return [{ style: {} }];
            if (name === 'rect') return [{ setAttribute() {} }];
            return [];
        }
    };
    const document = {
        activeElement: input,
        getElementById: () => ele,
        createElement: tag => tag === 'button' ? button : { style: {}, className: '', innerText: '' },
        hasFocus: () => true
    };
    const imports = {
        '@angular/core': { Component: () => () => {} },
        '../../gauge-base/gauge-base.component': { GaugeBaseComponent: class {
            static getUnit() { return null; }
            static getDigits() { return null; }
        } },
        '../../../_models/hmi': {
            GaugeStatus: class {},
            GaugeActionsType: { hide: 'hide', show: 'show' },
            InputOptionType: { number: 'number', text: 'text', date: 'date', time: 'time', datetime: 'datetime', textarea: 'textarea' },
            InputTimeFormatType: { normal: 'normal', seconds: 'seconds', milliseconds: 'milliseconds' },
            InputConvertionType: { milliseconds: 'milliseconds', string: 'string' }
        },
        '../../../_helpers/utils': { Utils: {
            searchTreeStartWith: () => input,
            toNumber: value => Number(value),
            millisecondsToTimeString: value => String(value),
            millisecondsToDateString: value => String(value),
            isNullOrUndefined: value => value == null
        } },
        '../../gauge-property/gauge-property.component': { GaugeDialogType: { Input: 'input' } }
    };
    const exports = {};
    class KeyboardEvent {
        constructor(type, properties) { this.type = type; Object.assign(this, properties); }
    }
    vm.runInNewContext(outputText, {
        exports,
        require: name => imports[name] || {},
        document,
        window: { getComputedStyle: () => ({ getPropertyValue: () => '16px' }) },
        HTMLInputElement: FakeInput,
        HTMLTextAreaElement: FakeTextArea,
        KeyboardEvent,
        console,
        setTimeout,
        SVG: { adopt: () => ({}) }
    }, { filename });
    return { HtmlInputComponent: exports.HtmlInputComponent, input, button, document };
}

function prepareTimeControl() {
    const { HtmlInputComponent, input, button, document } = loadHtmlInput();
    const gauge = {
        id: 'time-gauge',
        property: {
            variableId: 'clock',
            options: { type: 'time', convertion: 'string', updated: true }
        }
    };
    HtmlInputComponent.initElement(gauge, true);
    return { HtmlInputComponent, input, button, document, gauge };
}

test('time confirmation submits the value present when a touch begins', () => {
    const { HtmlInputComponent, input, button, document, gauge } = prepareTimeControl();

    input.value = '12:34';
    button.fire('touchstart');

    document.activeElement = button;
    HtmlInputComponent.processValue(gauge, { node: { children: [{}] } }, { id: 'clock', value: '09:00' }, {});
    assert.equal(input.value, '09:00', 'the live refresh demonstrates the focus-transition race');

    button.fire('click');
    assert.deepEqual(input.dispatchedValues, [{ type: 'keydown', key: 'Enter', value: '12:34' }]);
});

test('mouse confirmation preserves an edit across the same live-refresh race', () => {
    const { HtmlInputComponent, input, button, document, gauge } = prepareTimeControl();

    input.value = '16:45';
    button.fire('mousedown');
    document.activeElement = button;
    HtmlInputComponent.processValue(gauge, { node: { children: [{}] } }, { id: 'clock', value: '09:00' }, {});
    button.fire('click');

    assert.deepEqual(input.dispatchedValues, [{ type: 'keydown', key: 'Enter', value: '16:45' }]);
});

test('a new press replaces the snapshot left by an interrupted press', () => {
    const { HtmlInputComponent, input, button, document, gauge } = prepareTimeControl();

    input.value = '07:15';
    button.fire('mousedown');
    // The first press is interrupted (released outside the button), so no click clears it.
    input.value = '09:00';
    button.fire('mousedown');

    document.activeElement = button;
    HtmlInputComponent.processValue(gauge, { node: { children: [{}] } }, { id: 'clock', value: '08:00' }, {});
    button.fire('click');

    assert.deepEqual(input.dispatchedValues, [{ type: 'keydown', key: 'Enter', value: '09:00' }]);
});

test('keyboard activation submits the current input value', () => {
    const { input, button } = prepareTimeControl();
    input.value = '18:20';

    button.fire('click');

    assert.deepEqual(input.dispatchedValues, [{ type: 'keydown', key: 'Enter', value: '18:20' }]);
});
