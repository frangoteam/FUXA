const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const rxjs = require('rxjs');

function load(relative, imports = {}) {
    const filename = path.join(__dirname, '../src/app', relative);
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
    const exports = {};
    vm.runInNewContext(outputText, {
        exports,
        console,
        require: name => imports[name] || {}
    }, { filename });
    return exports;
}

const decorator = () => () => {};
class EventEmitter {}
const angular = { Injectable: decorator, Output: decorator, Component: decorator, ViewChild: decorator, Inject: decorator, EventEmitter };
const { ProjectService } = load('_services/project.service.ts', {
    '@angular/core': angular,
    rxjs,
    '../../environments/environment': { environment: {} },
    '../_models/project': { ProjectData: class {}, ProjectDataCmdType: {} },
    '../_models/hmi': {},
    '../_models/chart': {},
    '../_models/graph': {},
    '../_models/alarm': {},
    '../_models/notification': {},
    '../_models/script': {},
    '../_models/language': {},
    '../_models/device': {},
    'ngx-toastr': {},
    '@ngx-translate/core': {},
    './rcgi/resource-storage.service': {},
    './rcgi/resdemo.service': {},
    './rcgi/resclient.service': {},
    './rcgi/reswebapi.service': {},
    './app.service': {},
    '../_helpers/utils': {},
    'file-saver': {},
    '../_models/report': {},
    '../_models/maps': {},
    '../_models/client-access': {},
    '../_models/ar': {}
});

const { DevicePropertyComponent } = load('device/device-property/device-property.component.ts', {
    '@angular/core': angular,
    '@angular/material/dialog': {},
    '@angular/material/expansion': {},
    rxjs,
    '@ngx-translate/core': {},
    '../../_services/hmi.service': {},
    '../../_services/app.service': {},
    '../../_services/project.service': {},
    './../../_models/device': { DeviceType: {} },
    '../../_helpers/utils': {},
    '../device-enipmodule/device-enipmodule.component': {},
    '../../gui-helpers/confirm-dialog/confirm-dialog.component': {}
});

function projectService(existing) {
    const service = Object.create(ProjectService.prototype);
    service.projectData = { devices: Object.fromEntries(existing.map(device => [device.id, device])) };
    service.setDevice = device => service.imported.push(device);
    service.notifyError = code => service.errors.push(code);
    service.imported = [];
    service.errors = [];
    return service;
}

test('device import rejects an existing name before changing the project', () => {
    const service = projectService([{ id: 'old', name: 'Line PLC' }]);
    service.importDevices([
        { id: 'new-unique', name: 'Packaging PLC' },
        { id: 'new-duplicate', name: 'Line PLC' }
    ]);
    assert.deepEqual(service.imported, []);
    assert.deepEqual(service.errors, ['msg.import-devices-error']);
});

test('device import rejects duplicate names within one file atomically', () => {
    const service = projectService([]);
    service.importDevices([
        { id: 'first', name: 'Boiler PLC' },
        { id: 'second', name: 'Boiler PLC' }
    ]);
    assert.deepEqual(service.imported, []);
    assert.equal(service.errors.length, 1);
});

test('unique devices and same-id updates retain import compatibility', () => {
    const service = projectService([{ id: 'existing', name: 'Line PLC' }]);
    const devices = [
        { id: 'existing', name: 'Line PLC', polling: 500 },
        { id: 'new', name: 'Packaging PLC' },
        { id: '', name: 'invalid' }
    ];
    service.importDevices(devices);
    assert.deepEqual(service.imported, devices.slice(0, 2));
    assert.deepEqual(service.errors, []);
});

test('legacy duplicate names can be removed but cannot be accepted while editing', () => {
    const component = Object.create(DevicePropertyComponent.prototype);
    component.data = { exist: ['Line PLC'] };
    component.isToRemove = false;
    assert.equal(component.isValid({ name: 'Line PLC', type: 'modbus' }), false);
    component.isToRemove = true;
    assert.equal(component.isValid({ name: 'Line PLC', type: 'modbus' }), true);
});
