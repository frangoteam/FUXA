const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const rxjs = require('rxjs');

// Real scheduler load/save methods and RxJS; Angular rendering and transport are controlled.
const filename = path.join(__dirname, '../src/app/gauges/controls/html-scheduler/scheduler/scheduler.component.ts');
const { outputText, diagnostics } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
    reportDiagnostics: true
});
assert.equal(diagnostics.length, 0);
const decorator = () => () => {};
const exportsObject = {};
vm.runInNewContext(outputText, {
    exports: exportsObject, console,
    require: name => name === 'rxjs' ? rxjs : name === '@angular/core'
        ? { Component: decorator, Input: decorator, ViewChild: decorator, ViewEncapsulation: { None: 0 } }
        : {}
}, { filename });
const { SchedulerComponent } = exportsObject;
const device = (name, variableId) => ({ name, variableId });
const event = (name, variableId) => ({ id: 'event-1', deviceName: name, variableId,
    startTime: '08:00', endTime: '09:00', days: [false, true, false, false, false, false, false],
    months: Array(12).fill(true), daysOfMonth: Array(31).fill(true) });

function load(currentDevices, storedDevices, schedules = {}, editor = false) {
    const data = { settings: { devices: storedDevices, deviceActions: [] }, schedules };
    const before = JSON.stringify(data);
    const writes = [];
    const hmi = {
        askSchedulerData: () => rxjs.of(JSON.parse(before)),
        setSchedulerData: (id, value) => {
            writes.push({ id, data: JSON.parse(JSON.stringify(value)) });
            return rxjs.of({ result: 'ok' });
        }
    };
    const component = new SchedulerComponent(hmi, { detectChanges() {} });
    component.id = 'scheduler-1';
    component.property = { devices: currentDevices };
    component.isEditor = editor;
    component.initializeActiveStates = () => {};
    component.loadDeviceStatesForDisplay = () => {};
    component.refreshTagSubscriptions = () => {};
    component.initializeDevices();
    component.loadSchedulesFromServer();
    assert.equal(JSON.stringify(data), before, 'loading must not mutate the server response');
    return { component, writes };
}

test('loading after device removal republishes the current device list even without events', () => {
    const kept = device('Kept', 'kept-tag');
    const { writes } = load([kept], [kept, device('Removed', 'removed-tag')]);
    assert.equal(writes.length, 1);
    assert.deepEqual(writes[0].data.settings.devices.map(d => d.variableId), ['kept-tag']);
});

test('removing the last device releases all stored scheduler tag ownership', () => {
    const { writes } = load([], [device('Removed', 'removed-tag')]);
    assert.equal(writes.length, 1);
    assert.deepEqual(writes[0].data.settings.devices, []);
});

test('rebinding a device without schedules republishes its current tag', () => {
    const { writes } = load([device('Pump', 'new-tag')], [device('Pump', 'old-tag')]);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].data.settings.devices[0].variableId, 'new-tag');
});

test('editor reload also synchronizes removed devices while preserving stored schedules', () => {
    const kept = device('Kept', 'kept-tag');
    const schedules = { Kept: [event('Kept', 'kept-tag')], Removed: [event('Removed', 'removed-tag')] };
    const { writes } = load([kept], [kept, device('Removed', 'removed-tag')], schedules, true);
    assert.equal(writes.length, 1);
    assert.deepEqual(writes[0].data.schedules, schedules);
    assert.deepEqual(writes[0].data.settings.devices.map(d => d.name), ['Kept']);
});

test('unchanged devices do not cause another write after a server update', () => {
    const kept = device('Kept', 'kept-tag');
    const first = load([kept], [kept, device('Removed', 'removed-tag')]);
    assert.equal(first.writes.length, 1);
    const next = load([kept], first.writes[0].data.settings.devices);
    assert.deepEqual(next.writes, []);
});

test('display labels and permissions are preserved without causing redundant writes', () => {
    const kept = { ...device('Kept', 'kept-tag'), permission: 3, permissionRoles: { enabled: ['operator'] } };
    const { writes, component } = load([kept], [{ ...kept, label: 'Kept' }]);
    assert.deepEqual(writes, []);
    assert.equal(component.deviceList[0].permission, 3);
    assert.equal(component.deviceList[0].permissionRoles, kept.permissionRoles);
});

test('existing schedule tag synchronization still writes once for a rebound device', () => {
    const { writes } = load([device('Pump', 'new-tag')], [device('Pump', 'old-tag')],
        { Pump: [event('Pump', 'old-tag')] });
    assert.equal(writes.length, 1);
    assert.equal(writes[0].data.schedules.Pump[0].variableId, 'new-tag');
});

test('an unchanged empty device list does not write', () => {
    assert.deepEqual(load([], []).writes, []);
});
