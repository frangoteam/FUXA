const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const sourceRoot = process.env.FUXA_TAG_PASTE_SOURCE_ROOT || path.join(__dirname, '../src');
const decorator = () => () => {};

class EventEmitter {
    constructor() {
        this.values = [];
    }
    emit(value) {
        this.values.push(value);
    }
}

class FormControl {
    setValue(value) {
        this.value = value;
    }
    patchValue(value) {
        this.value = value;
    }
}

const DevicesUtils = {
    getTagFromTagId(devices, tagId) {
        for (const device of Object.values(devices || {})) {
            const tag = Object.values(device.tags || {}).find(candidate => candidate.id === tagId);
            if (tag) return tag;
        }
        return null;
    },
    getDeviceFromTagId(devices, tagId) {
        return Object.values(devices || {}).find(device =>
            Object.values(device.tags || {}).some(tag => tag.id === tagId));
    }
};

function loadComponent(relativePath, exportName) {
    const filename = path.join(sourceRoot, relativePath);
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
    const exportsObject = {};
    vm.runInNewContext(outputText, {
        exports: exportsObject,
        console,
        require(name) {
            if (name === '@angular/core') {
                return { Component: decorator, Input: decorator, Output: decorator, EventEmitter };
            }
            if (name === '@angular/forms') return { UntypedFormControl: FormControl };
            if (name === 'rxjs') return { map: value => value, startWith: value => value };
            if (name.includes('_models/device')) {
                return { DevicesUtils, PlaceholderDevice: { id: '@', tags: [] } };
            }
            if (name.includes('_helpers/utils')) return { Utils: { defaultColor: [] } };
            return {};
        }
    }, { filename });
    return exportsObject[exportName];
}

const FlexVariableComponent = loadComponent(
    'app/gauges/gauge-property/flex-variable/flex-variable.component.ts',
    'FlexVariableComponent');
const FlexDeviceTagComponent = loadComponent(
    'app/gauges/gauge-property/flex-device-tag/flex-device-tag.component.ts',
    'FlexDeviceTagComponent');

function tag(id, name) {
    return { id, name, label: null, address: name };
}

function device(id, name, tags) {
    return { id, name, tags: Object.fromEntries(tags.map(item => [item.id, item])) };
}

function group(name, tags) {
    return { name, tags: tags.map(item => ({ id: item.id, name: item.name, device: name })) };
}

function paste(value) {
    return {
        prevented: false,
        clipboardData: { getData: type => type === 'text' ? value : '' },
        preventDefault() { this.prevented = true; }
    };
}

function makeFlexVariable(groups, devices, variableId = null) {
    const component = Object.create(FlexVariableComponent.prototype);
    component.devices = groups;
    component.data = { devices };
    component.variableId = variableId;
    component.value = { variableId };
    component.variableValue = undefined;
    component.withBitmask = false;
    component.tagFilter = new FormControl();
    component.onchange = new EventEmitter();
    component.valueChange = new EventEmitter();
    return component;
}

function makeFlexDeviceTag(groups, devices, variableId = null) {
    const component = Object.create(FlexDeviceTagComponent.prototype);
    component.devicesGroups = groups;
    component.devices = Object.values(devices);
    component.variableId = variableId;
    component.deviceTagValue = { variableId };
    component.tagFilter = new FormControl();
    component.onchange = new EventEmitter();
    return component;
}

const pump = tag('pump-id', 'Pump Speed');
const valve = tag('valve-id', 'Valve Open');
const devices = {
    line: device('line', 'Line', [pump, valve])
};
const groups = [group('Line', [pump, valve])];

test('pasting a unique tag name selects it in flex-variable', () => {
    const component = makeFlexVariable(groups, devices);
    const event = paste('  pump speed\n');
    component.onTagPaste(event);
    assert.equal(event.prevented, true);
    assert.equal(component.variableId, pump.id);
    assert.equal(component.tagFilter.value.id, pump.id);
    assert.equal(component.value.variableId, pump.id);
    assert.equal(component.value.variableRaw.id, pump.id);
    assert.equal(component.valueChange.values.length, 1);
});

test('pasting a unique tag name selects it in flex-device-tag', () => {
    const component = makeFlexDeviceTag(groups, devices);
    const event = paste('VALVE OPEN');
    component.onTagPaste(event);
    assert.equal(event.prevented, true);
    assert.equal(component.variableId, valve.id);
    assert.equal(component.tagFilter.value.id, valve.id);
    assert.equal(component.deviceTagValue.variableId, valve.id);
    assert.equal(component.deviceTagValue.variableRaw.id, valve.id);
    assert.equal(component.onchange.values.length, 1);
});

test('an ambiguous pasted name keeps the browser paste and current binding', () => {
    const duplicateGroups = [group('Line A', [pump]), group('Line B', [tag('pump-2', 'Pump Speed')])];
    const component = makeFlexVariable(duplicateGroups, devices, valve.id);
    const event = paste('Pump Speed');
    component.onTagPaste(event);
    assert.equal(event.prevented, false);
    assert.equal(component.variableId, valve.id);
    assert.equal(component.value.variableId, valve.id);
    assert.equal(component.valueChange.values.length, 0);
});

test('an unknown or empty pasted name keeps the browser paste unchanged', () => {
    for (const value of ['Unknown', '   ']) {
        const component = makeFlexDeviceTag(groups, devices, pump.id);
        const event = paste(value);
        component.onTagPaste(event);
        assert.equal(event.prevented, false);
        assert.equal(component.variableId, pump.id);
        assert.equal(component.onchange.values.length, 0);
    }
});

test('normal autocomplete selection remains supported in both controls', () => {
    const option = groups[0].tags[0];
    const variable = makeFlexVariable(groups, devices);
    variable.onDeviceTagSelected(option);
    assert.equal(variable.value.variableId, pump.id);
    const deviceTag = makeFlexDeviceTag(groups, devices);
    deviceTag.onDeviceTagSelected(option);
    assert.equal(deviceTag.deviceTagValue.variableId, pump.id);
});

test('both templates bind paste handling to their tag inputs', () => {
    for (const template of [
        'app/gauges/gauge-property/flex-variable/flex-variable.component.html',
        'app/gauges/gauge-property/flex-device-tag/flex-device-tag.component.html'
    ]) {
        assert.match(fs.readFileSync(path.join(sourceRoot, template), 'utf8'), /\(paste\)="onTagPaste\(\$event\)"/);
    }
});
