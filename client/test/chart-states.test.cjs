const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

const decorator = () => () => {};
function load(relativePath, imports = {}, globals = {}) {
    const filename = path.join(__dirname, '../src/app', relativePath);
    const { outputText, diagnostics } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        fileName: filename,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
        reportDiagnostics: true
    });
    assert.equal(diagnostics.length, 0);
    const exports = {};
    vm.runInNewContext(outputText, {
        exports, console, ...globals,
        require: name => name === '@angular/core'
            ? { Component: decorator, Input: decorator, Output: decorator, ViewChild: decorator, Inject: decorator }
            : imports[name] || {}
    }, { filename });
    return exports;
}

const helpers = load('gui-helpers/ngx-uplot/state-timeline.ts');
const { StateTimeline, trimStateData } = helpers;
const running = { value: '1', label: 'Running', color: '#00aa00', description: 'Production' };
const stopped = { value: '0', label: 'Stopped', color: '#aa0000' };
const plain = value => JSON.parse(JSON.stringify(value));

test('numeric, boolean and recipe values use text mappings without losing zero or empty strings', () => {
    const timeline = new StateTimeline('Machine', [running, stopped], '#333333');
    assert.equal(timeline.encode(1), timeline.encode('1'));
    const values = [0, false, '', 'Recipe A'].map(value => timeline.encode(value));
    const intervals = timeline.intervals([1, 2, 3, 4], values, 0, 5);
    assert.deepEqual(plain(intervals.map(interval => interval.state.label)), ['Stopped', 'false', '', 'Recipe A']);
    assert.equal(intervals[3].state.color, '#333333');
});

test('sparse samples and repeated states merge, and intervals clip to the shared zoom range', () => {
    const timeline = new StateTimeline('Machine', [running, stopped], 'gray');
    const values = [1, undefined, 1, 0].map(value => timeline.encode(value));
    assert.deepEqual(plain(timeline.intervals([0, 1, 2, 4], values, 1.5, 5)), [
        { from: 1.5, to: 4, state: running }, { from: 4, to: 5, state: stopped }
    ]);
});

test('explicit missing states end intervals and history never invents a preceding state', () => {
    const timeline = new StateTimeline('Machine', [running, stopped], 'gray');
    const values = [1, null, undefined, 0].map(value => timeline.encode(value));
    assert.deepEqual(plain(timeline.intervals([2, 3, 4, 5], values, 0, 6)), [
        { from: 2, to: 3, state: running }, { from: 5, to: 6, state: stopped }
    ]);
    assert.equal(timeline.intervals([], [], 0, 6).length, 0);
    assert.equal(timeline.intervals([2], [values[0]], 3, 3).length, 0);
});

test('subsecond transitions remain distinct and a transition at the right boundary has no width', () => {
    const timeline = new StateTimeline('Machine', [running, stopped], 'gray');
    const values = [1, 0, 1].map(value => timeline.encode(value));
    assert.deepEqual(plain(timeline.intervals([1.1, 1.2, 1.3], values, 1, 1.3)), [
        { from: 1.1, to: 1.2, state: running }, { from: 1.2, to: 1.3, state: stopped }
    ]);
});

test('rolling windows retain each state at the boundary without filling numeric trends', () => {
    const data = [[0, 5, 10, 20], [10, 20, 30, 40], [0, null, 1, null], [2, null, null, null]];
    trimStateData(data, 15, [2, 3]);
    assert.deepEqual(data, [[15, 20], [null, 40], [1, null], [2, null]]);
    trimStateData(data, 20, [2, 3]);
    assert.deepEqual(data, [[20], [40], [1], [2]]);
});

test('an explicit state gap survives trimming, while a change at the boundary wins', () => {
    const data = [[0, 5, 10], [1, NaN, null], [1, null, 2]];
    trimStateData(data, 10, [1, 2]);
    assert.ok(Number.isNaN(data[1][0]));
    assert.equal(data[2][0], 2);
});

const { NgxUplotComponent } = load('gui-helpers/ngx-uplot/ngx-uplot.component.ts', {
    './state-timeline': helpers
}, { uPlot: { fmtDate: () => () => '' } });

function plot() {
    const component = new NgxUplotComponent();
    component.data = [[0, 1]];
    component.chartHeight = 300;
    component.graph = { nativeElement: {} };
    component.stateLanes = { nativeElement: { style: {} } };
    component.uplot = {
        width: 600, series: [{}],
        addSeries(series, index) { this.series.splice(index, 0, series); },
        setData(data) { this.data = data; },
        setSize(size) { this.size = size; }
    };
    component.addSerie(1, { label: 'Temperature', scale: '1' });
    component.addSerie(2, { label: 'Machine', type: 'state', states: [running, stopped] });
    return component;
}

test('state series reserve lanes and never participate in numeric scaling or paths', () => {
    const component = plot();
    assert.equal(component.uplot.series[2].show, false);
    assert.equal(component.uplot.series[2].auto, false);
    assert.equal(component.uplot.series[2].paths(), null);
    assert.equal(component.uplot.size.height, 252);
    component.resize(100, 500);
    assert.equal(component.uplot.size.height, 60);
});

test('lane labels use the chart axis color instead of inheriting the SVG text color', () => {
    const element = () => ({ style: {}, children: [], appendChild(child) { this.children.push(child); } });
    const { NgxUplotComponent: Component } = load('gui-helpers/ngx-uplot/ngx-uplot.component.ts', {}, {
        uPlot: { fmtDate: () => () => '' },
        document: { createElement: element, createDocumentFragment: element }
    });
    const component = new Component();
    let fragment;
    component.stateLanes = { nativeElement: { replaceChildren(value) { fragment = value; } } };
    component.stateTimelines.set(1, { label: 'Machine', intervals: () => [] });
    const u = { root: { querySelectorAll: () => [] }, scales: { x: { min: 0, max: 1 } },
        over: { offsetLeft: 40, clientWidth: 300 }, data: [[], []] };
    for (const [color, expected] of [['#222222', '#222222'], ['#ffffff', '#ffffff'], [undefined, 'black']]) {
        component.options = { axisLabelColor: color };
        component.drawStateTimelines(u);
        assert.equal(fragment.children[0].children[0].style.color, expected);
        assert.equal(fragment.children[0].children[0].textContent, 'Machine');
    }
});

test('bulk history, live updates and rolling windows preserve categorical states', () => {
    const component = plot();
    const source = [[0, 10], [20, 30], ['Recipe A', undefined]];
    component.setData(source);
    assert.equal(source[2][0], 'Recipe A');
    component.addValue(1, 20, 40, 5);
    assert.deepEqual(plain(component.data[0]), [15, 20]);
    const timeline = component.stateTimelines.get(2);
    assert.equal(timeline.intervals(component.data[0], component.data[2], 15, 20)[0].state.label, 'Recipe A');
    component.addValue(2, 20, 'Recipe B', 5);
    assert.equal(timeline.intervals(component.data[0], component.data[2], 20, 25)[0].state.label, 'Recipe B');
    component.setData([[], [], []]);
    assert.equal(timeline.intervals(component.data[0], component.data[2], 0, 25).length, 0);
});

test('replaying paused tags in arrival order keeps all series chronologically aligned', () => {
    const component = plot();
    component.setData([[0], [20], ['Running']]);
    component.addValue(1, 20, 30, 60);
    component.addValue(2, 10, 'Stopped', 60);
    component.addValue(2, 15, 'Running', 60);
    component.addValue(1, 10, 25, 60);
    assert.deepEqual(plain(component.data[0]), [0, 10, 15, 20]);
    assert.deepEqual(plain(component.data[1]), [20, 25, null, 30]);
    const intervals = component.stateTimelines.get(2).intervals(component.data[0], component.data[2], 0, 20);
    assert.deepEqual(plain(intervals.map(interval => [interval.from, interval.to, interval.state.label])), [
        [0, 10, 'Running'], [10, 15, 'Stopped'], [15, 20, 'Running']
    ]);
});

const { ChartUplotComponent } = load('gauges/controls/html-chart/chart-uplot/chart-uplot.component.ts', {}, {
    setTimeout: callback => callback()
});
function chart() {
    const component = Object.create(ChartUplotComponent.prototype);
    component.mapData = { trend: { index: 1, attribute: {} }, state: { index: 2, attribute: { type: 'state' } } };
    return component;
}

test('history merging preserves millisecond transitions across newest-first chunks', () => {
    const data = chart().buildUnifiedData([
        [[{ dt: 1200, value: 30 }], [{ dt: 1100, value: 'B' }]],
        [[{ dt: 1000, value: 20 }], [{ dt: 1050, value: 'A' }]]
    ]);
    assert.deepEqual(plain(data[0]), [1, 1.05, 1.1, 1.2]);
    assert.deepEqual(plain(data[1]), [20, null, null, 30]);
    assert.equal(data[2][0], undefined);
    assert.equal(data[2][1], 'A');
    assert.equal(data[2][2], 'B');
    assert.equal(chart().buildUnifiedData([[]]).length, 3);
});

test('state transitions bypass the numeric sampling interval', () => {
    const component = chart();
    component.addValueInterval = 60;
    component.range = {};
    component.options = { realtime: 1 };
    const calls = [];
    component.nguplot = { addValue: (...args) => calls.push(args) };
    component.addValue('state', 1, 'Running');
    component.addValue('state', 1.01, 'Stopped');
    assert.equal(calls.length, 2);
});

test('resuming after a pause replays tags together before the live window is trimmed', () => {
    const component = chart();
    const graph = plot();
    graph.setData([[0], [20], ['Running']]);
    component.nguplot = { setXScala: () => {} };
    component.pauseMemoryValue = { trend: [{ x: 20, y: 30 }], state: [{ x: 10, y: 'Stopped' }] };
    component.updateLastDaqQueryRange = () => {};
    component.addValue = (id, x, y) => graph.addValue(component.mapData[id].index, x, y, 5);
    component.setZoom({ from: 15000, to: 20000, zoomStep: 0 });
    const intervals = graph.stateTimelines.get(2).intervals(graph.data[0], graph.data[2], 15, 20);
    assert.deepEqual(plain(intervals.map(interval => [interval.from, interval.to, interval.state.label])), [
        [15, 20, 'Stopped']
    ]);
    assert.deepEqual(plain(component.pauseMemoryValue), {});
});

test('history with an empty first series still loads states, and empty history clears stale data', () => {
    const component = chart();
    component.range = { from: 0, to: 2000 };
    component.setLoading = () => {};
    let data;
    component.nguplot = { setData: values => data = values, setXScala: () => {} };
    component.setValues([[], [{ dt: 1000, value: 'Running' }]], null);
    assert.deepEqual(plain(data), [[1], [null], ['Running']]);
    component.setValues([[], []], null);
    assert.deepEqual(plain(data), [[], [], []]);
});

test('custom series distinguish sparse alignment from explicit missing state values', () => {
    const component = chart();
    component.setLoading = () => {};
    let data;
    component.nguplot = { setData: values => data = values };
    component.setCustomValues([
        { x: [1, 3], y: [20, 30] }, { x: [2, 4], y: ['Recipe', null] }
    ]);
    assert.deepEqual(plain(data[0]), [1, 2, 3, 4]);
    assert.equal(data[2][0], undefined);
    assert.equal(data[2][1], 'Recipe');
    assert.equal(data[2][2], undefined);
    assert.equal(data[2][3], null);
});

const { ChartLinePropertyComponent } = load('editor/chart-config/chart-line-property/chart-line-property.component.ts');
test('ambiguous state mappings cannot be saved, and switching to numeric trends remains possible', () => {
    const component = Object.create(ChartLinePropertyComponent.prototype);
    component.formGroup = { value: { type: 'state' }, getRawValue: () => ({ type: 'trend' }) };
    component.data = { states: [{ value: 1 }, { value: '1' }] };
    let saved;
    component.dialogRef = { close: value => saved = value };
    component.onOkClick();
    assert.equal(saved, undefined);
    component.formGroup.value.type = 'trend';
    component.onOkClick();
    assert.equal(saved.type, 'trend');
});

const { ChartConfigComponent } = load('editor/chart-config/chart-config.component.ts');
test('cancelling a state mapping edit does not mutate the saved chart', () => {
    const component = Object.create(ChartConfigComponent.prototype);
    const line = { type: 'state', states: [{ ...running }] };
    component.dialog = { open: (_type, options) => {
        options.data.states[0].label = 'Changed';
        options.data.states.push(stopped);
        return { afterClosed: () => ({ subscribe: callback => callback(undefined) }) };
    } };
    component.editChartLine(line);
    assert.deepEqual(line.states, [running]);
});
