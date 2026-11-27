const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

const root = path.join(__dirname, '../src/app/gauges/controls/html-input/input-property');

function loadComponent() {
    const filename = path.join(root, 'input-property.component.ts');
    const { outputText, diagnostics } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        fileName: filename,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
        reportDiagnostics: true
    });
    assert.equal(diagnostics.length, 0);
    const decorator = () => () => {};
    const exports = {};
    const imports = {
        '@angular/core': { Component: decorator, Inject: decorator, ViewChild: decorator },
        '@angular/material/dialog': { MAT_DIALOG_DATA: {}, MatDialog: class {}, MatDialogRef: class {} },
        '@angular/material/select': { MatSelectChange: class {} },
        '../../../gauge-property/flex-input/flex-input.component': {
            FlexInputComponent: class {}, PropertyType: { output: 1, input: 6 }
        },
        '../../../../_models/hmi': {
            GaugeProperty: class {}, InputActionEscType: {}, InputConvertionType: {}, InputOptionsProperty: class {},
            InputOptionType: {}, InputTimeFormatType: {}
        },
        '../html-input.component': { HtmlInputComponent: { getDialogType: () => 16 } }
    };
    vm.runInNewContext(outputText, { exports, require: name => imports[name] || {} }, { filename });
    return exports.InputPropertyComponent;
}

test('input properties expose the existing unit and fraction-digit editor', () => {
    const template = fs.readFileSync(path.join(root, 'input-property.component.html'), 'utf8');
    assert.match(template, /<flex-input[^>]*#flexinput/);
    assert.match(template, /\[ranges\]="property\.ranges"/);
    assert.match(template, /\[propertyType\]="unitPropertyType"/);
});

test('saving input properties retains normalized unit and fraction-digit settings', () => {
    const InputPropertyComponent = loadComponent();
    const component = Object.create(InputPropertyComponent.prototype);
    const normalized = [{ type: 1, text: 'bar', fractionDigits: 2 }];
    component.data = { settings: { property: null } };
    component.property = { ranges: [{ text: 'old' }] };
    component.flexInput = { getRanges: () => normalized };

    component.onOkClick();

    assert.deepEqual(component.data.settings.property.ranges, normalized);
});
