const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

const sourceRoot = path.join(__dirname, '../src/app/gauges/controls/html-scheduler/scheduler-property');
const sourceFile = path.join(sourceRoot, 'scheduler-property.component.ts');
const templateFile = path.join(sourceRoot, 'scheduler-property.component.html');
const { outputText, diagnostics } = ts.transpileModule(fs.readFileSync(sourceFile, 'utf8'), {
    fileName: sourceFile,
    compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        experimentalDecorators: true
    },
    reportDiagnostics: true
});
assert.equal(diagnostics.length, 0);

const decorator = () => () => {};
class EventEmitter {
    constructor() {
        this.values = [];
    }

    emit(value) {
        this.values.push(value);
    }
}
const actionType = {
    onSetValue: 'onSetValue',
    onToggleValue: 'onToggleValue',
    onRunScript: 'onRunScript'
};
const exportsObject = {};
vm.runInNewContext(outputText, {
    exports: exportsObject,
    console,
    require(name) {
        if (name === '@angular/core') {
            return { Component: decorator, Input: decorator, Output: decorator, EventEmitter };
        }
        if (name.endsWith('/_models/hmi')) {
            return { GaugeEventActionType: actionType };
        }
        if (name.endsWith('/_helpers/utils')) {
            return { Utils: { defaultColor: [] } };
        }
        return {};
    }
}, { filename: sourceFile });
const { SchedulerPropertyComponent } = exportsObject;

function makeComponent(actions = []) {
    const component = new SchedulerPropertyComponent(undefined, {
        getViews: () => [{ id: 'view-1' }],
        getScripts: () => [{ id: 'script-1' }]
    }, {
        get: value => ({ subscribe: callback => callback(value) })
    });
    component.data = {
        settings: {
            name: 'scheduler-1',
            property: {
                devices: [{ name: 'Pump', variableId: 'tag-1' }],
                deviceActions: actions
            }
        }
    };
    component.ngOnInit();
    return component;
}

test('the Scheduler Actions tab is available', () => {
    const template = fs.readFileSync(templateFile, 'utf8');
    const match = template.match(/<mat-tab[^>]*settings-actions[^>]*>/);
    assert.ok(match, 'Scheduler Actions tab must be present');
    assert.doesNotMatch(match[0], /\[disabled\]\s*=\s*"true"/);
    assert.match(template, /Actions when Device Turns ON/);
    assert.match(template, /Actions when Device Turns OFF/);
});

test('existing actions are split by trigger and normalized', () => {
    const component = makeComponent([
        { deviceName: 'Pump', action: 'onSetValue', actparam: '1' },
        { deviceName: 'Pump', action: 'onRunScript', actparam: 'script-1', eventTrigger: 'off' }
    ]);
    assert.equal(component.deviceActionsOn.length, 1);
    assert.equal(component.deviceActionsOff.length, 1);
    assert.equal(component.deviceActionsOn[0].eventTrigger, 'on');
    assert.equal(component.deviceActionsOff[0].eventTrigger, 'off');
    assert.deepEqual(component.views, [{ id: 'view-1' }]);
    assert.deepEqual(component.scripts, [{ id: 'script-1' }]);
});

test('property updates retain valid ON and OFF actions and omit incomplete rows', () => {
    const component = makeComponent([]);
    component.deviceActionsOn[0].deviceName = 'Pump';
    component.deviceActionsOn[0].action = 'onToggleValue';
    component.deviceActionsOff[0].deviceName = 'Pump';
    component.deviceActionsOff[0].action = 'onSetValue';
    component.deviceActionsOff.push({ deviceName: '', action: 'onRunScript', eventTrigger: 'off' });

    component.onPropertyChanged();

    assert.equal(component.data.settings.property.deviceActions.length, 2);
    assert.deepEqual(Array.from(component.data.settings.property.deviceActions, action => action.eventTrigger), ['on', 'off']);
    assert.equal(component.onPropChanged.values.length, 1);
    assert.equal(component.onPropChanged.values[0], component.data.settings);
});
