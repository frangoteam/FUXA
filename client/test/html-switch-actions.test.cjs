const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function loadSwitch() {
    const filename = path.join(__dirname, '../src/app/gauges/controls/html-switch/html-switch.component.ts');
    const { outputText, diagnostics } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        fileName: filename,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
        reportDiagnostics: true
    });
    assert.equal(diagnostics.length, 0);

    const actions = [];
    const displayedValues = [];
    class GaugeBaseComponent {
        static runActionHide(_element, type) { actions.push(type); }
        static runActionShow(_element, type) { actions.push(type); }
    }
    const decorator = () => target => target;
    const imports = {
        '@angular/core': { Injectable: decorator },
        '../../../_models/hmi': {
            GaugeActionsType: { hide: 'hide', show: 'show' },
            GaugeProperty: class {}, GaugeStatus: class {}, Event: class {}
        },
        '../../gauge-property/gauge-property.component': { GaugeDialogType: { Switch: 'switch' } },
        '../../../_helpers/utils': {
            Utils: { searchTreeStartWith: () => ({ setValue: value => displayedValues.push(value) }), normalizeTagValue: value => value }
        },
        '../../gauge-base/gauge-base.component': { GaugeBaseComponent },
        '../../../_services/auth.service': {}
    };
    const context = {
        exports: {},
        document: { getElementById() { return null; } },
        SVG: { adopt: node => ({ node }) },
        require: name => imports[name] || {}
    };
    vm.runInNewContext(outputText, context, { filename });
    return { HtmlSwitchComponent: context.exports.HtmlSwitchComponent, actions, displayedValues };
}

test('switch advertises the same hide and show actions as other HTML controls', () => {
    const { HtmlSwitchComponent } = loadSwitch();
    assert.deepEqual({ ...HtmlSwitchComponent.getActions(HtmlSwitchComponent.TypeTag) }, {
        hide: 'hide', show: 'show'
    });
});

for (const type of ['hide', 'show']) {
    test(`switch executes its ${type} action for a matching tag range`, () => {
        const { HtmlSwitchComponent, actions } = loadSwitch();
        const property = {
            variableId: 'switch-value', options: {},
            actions: [{ type, variableId: 'action-tag', range: { min: 1, max: 3 } }]
        };
        HtmlSwitchComponent.processValue(
            { property }, { node: { id: 'switch' } }, { id: 'action-tag', value: 2 }, { variablesValue: {} }, { setValue() {} }
        );
        assert.deepEqual(actions, [type]);
    });
}

test('action tags do not overwrite the displayed switch value', () => {
    const { HtmlSwitchComponent, displayedValues } = loadSwitch();
    const property = {
        variableId: 'switch-value', bitmask: null, options: { offValue: 0, onValue: 1 },
        actions: [{ type: 'hide', variableId: 'action-tag', range: { min: 1, max: 3 } }]
    };
    const switcher = { setValue: value => displayedValues.push(value) };
    HtmlSwitchComponent.processValue(
        { property }, { node: { id: 'switch' } }, { id: 'action-tag', value: 2 }, { variablesValue: {} }, switcher
    );
    assert.deepEqual(displayedValues, []);
});

test('switch property editor persists configured actions', () => {
    const component = fs.readFileSync(path.join(__dirname,
        '../src/app/gauges/controls/html-switch/html-switch-property/html-switch-property.component.ts'), 'utf8');
    const template = fs.readFileSync(path.join(__dirname,
        '../src/app/gauges/controls/html-switch/html-switch-property/html-switch-property.component.html'), 'utf8');
    const manager = fs.readFileSync(path.join(__dirname, '../src/app/gauges/gauges.component.ts'), 'utf8');
    assert.match(component, /property\.actions\s*=\s*this\.flexAction\.getActions\(\)/);
    assert.match(template, /<flex-action\b/);
    assert.match(manager, /GaugeWithActions\s*=\s*\[[\s\S]*HtmlSwitchComponent/);
});
