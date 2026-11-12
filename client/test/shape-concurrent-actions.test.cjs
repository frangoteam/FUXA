const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function createRuntime() {
    let nextTimerId = 0;
    const timers = new Map();
    const timerGlobals = {
        setInterval(callback, delay) {
            const id = ++nextTimerId;
            timers.set(id, { callback, delay });
            return id;
        },
        clearInterval(id) { timers.delete(id); },
        clearTimeout(id) { timers.delete(id); }
    };
    const actionTypes = {
        hide: 'hide', show: 'show', blink: 'blink', stop: 'stop', clockwise: 'clockwise',
        anticlockwise: 'anticlockwise', rotate: 'rotate', move: 'move', moveByTags: 'moveByTags'
    };
    class GaugeActionStatus {
        constructor(type) {
            this.type = type;
            this.timer = null;
            this.animr = null;
        }
    }
    const models = {
        GaugeActionsType: actionTypes,
        GaugeActionStatus,
        GaugePropertyColor: class {}
    };
    const decorator = () => () => {};

    function load(relative, imports) {
        const filename = path.join(root, 'src/app', relative);
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
            exports, console, ...timerGlobals,
            require: name => imports[name] || {}
        }, { filename });
        return exports;
    }

    const base = load('gauges/gauge-base/gauge-base.component.ts', {
        '@angular/core': { Component: decorator, Input: decorator, Output: decorator, EventEmitter: class {} },
        '../../_models/hmi': models,
        '../../_helpers/utils': { Utils: {} },
        '../gauge-property/flex-input/flex-input.component': { PropertyType: {} }
    });
    const shapes = load('gauges/shapes/shapes.component.ts', {
        '@angular/core': { Component: decorator },
        '../gauge-base/gauge-base.component': base,
        '../../_models/hmi': models,
        '../gauge-property/gauge-property.component': { GaugeDialogType: { RangeWithAlarm: 'range' } }
    });
    const procEng = load('gauges/shapes/proc-eng/proc-eng.component.ts', {
        '@angular/core': { Component: decorator },
        '../../gauge-base/gauge-base.component': base,
        '../../../_models/hmi': models,
        '../../gauge-property/gauge-property.component': { GaugeDialogType: { RangeWithAlarm: 'range' } },
        '../shapes.component': shapes
    });
    return { ...base, ...shapes, ...procEng, GaugeActionStatus, actionTypes, timers };
}

function rotationElement() {
    const state = { starts: 0, stops: 0, unschedules: 0 };
    const element = {
        timeline() {
            return { stop: () => { state.stops++; } };
        },
        animate() {
            state.starts++;
            const runner = {
                ease() { return runner; },
                rotate() { return runner; },
                loop() { return runner; },
                unschedule() { state.unschedules++; }
            };
            return runner;
        }
    };
    return { element, state };
}

for (const [name, componentName] of [['shape', 'ShapesComponent'], ['process-engineering shape', 'ProcEngComponent']]) {
test(`${name} blink and clockwise rotation retain independent runtime state`, () => {
    const runtime = createRuntime();
    const { GaugeBaseComponent, GaugeActionStatus, actionTypes, timers } = runtime;
    const Component = runtime[componentName];
    const status = { actionRef: new GaugeActionStatus(actionTypes.blink) };
    const blinkElement = { style: { backgroundColor: 'black', color: 'white' } };
    const blink = {
        type: actionTypes.blink,
        variableId: 'blink-tag',
        range: { min: 1, max: 1 },
        options: { interval: 100, fillA: 'red', fillB: 'black', strokeA: 'white', strokeB: 'gray' }
    };
    const { element, state } = rotationElement();

    GaugeBaseComponent.checkActionBlink(blinkElement, blink, status, true, true);
    const timer = status.actionRef.timer;
    assert.equal(timers.size, 1);

    Component.runMyAction(element, actionTypes.clockwise, status);
    const rotation = status.actionRef.animr;
    assert.equal(status.actionRef.timer, timer, 'starting rotation must retain the blink timer');
    assert.ok(rotation, 'rotation runner is recorded');

    GaugeBaseComponent.checkActionBlink(blinkElement, blink, status, true, true);
    Component.runMyAction(element, actionTypes.clockwise, status);
    assert.equal(timers.size, 1, 'later tag updates must not create another blink interval');
    assert.equal(status.actionRef.animr, rotation, 'later blink updates must not restart the same rotation');
    assert.equal(state.starts, 1);
    assert.equal(state.unschedules, 0);
});
}

test('stopping blink leaves the active rotation runner owned and reusable', () => {
    const { GaugeBaseComponent, ShapesComponent, GaugeActionStatus, actionTypes, timers } = createRuntime();
    const status = { actionRef: new GaugeActionStatus(actionTypes.blink) };
    const blinkElement = { style: { backgroundColor: 'black', color: 'white' } };
    const blink = {
        type: actionTypes.blink,
        variableId: 'blink-tag',
        range: { min: 1, max: 1 },
        options: { interval: 100, fillA: 'red', fillB: 'black', strokeA: 'white', strokeB: 'gray' }
    };
    const { element, state } = rotationElement();

    GaugeBaseComponent.checkActionBlink(blinkElement, blink, status, true, true);
    ShapesComponent.runMyAction(element, actionTypes.clockwise, status);
    const rotation = status.actionRef.animr;

    GaugeBaseComponent.checkActionBlink(blinkElement, blink, status, false, true);
    assert.equal(timers.size, 0);
    assert.equal(status.actionRef.animr, rotation);
    ShapesComponent.runMyAction(element, actionTypes.clockwise, status);
    assert.equal(state.starts, 1);
});
