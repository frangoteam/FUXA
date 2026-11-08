const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function load(relative, imports, globals = {}) {
    const filename = path.join(__dirname, '../src/app', relative);
    const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        fileName: filename,
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
            experimentalDecorators: true
        },
        reportDiagnostics: true
    });
    assert.equal(result.diagnostics.length, 0);
    const exports = {};
    vm.runInNewContext(result.outputText, {
        exports,
        console,
        require: id => imports[id] || {},
        setTimeout,
        clearTimeout,
        ...globals
    }, { filename });
    return exports;
}

function graphRuntime(kind) {
    const decorator = () => () => {};
    class EventEmitter {
        emit() {}
    }
    const angular = {
        Component: decorator,
        Input: decorator,
        Output: decorator,
        ViewChild: decorator,
        EventEmitter
    };
    class GraphBaseComponent {
        static getGridLines(options) {
            return { display: options.gridLinesShow };
        }
        static getTitle(options, title) {
            if (title) options.plugins.title.text = title;
            return options.plugins.title.text;
        }
        isOffline() { return false; }
    }
    const graphBase = { GraphBaseComponent, GraphThemeType: { light: 'light' } };
    const graphModel = {
        GraphBarXType: { value: 'value', date: 'date' },
        GraphRangeType: {},
        GraphBarFunction: {},
        GraphBarDateFunctionType: { sumHourIntegral: 'sumHourIntegral', sumValueIntegral: 'sumValueIntegral' },
        GraphDateGroupType: { hours: 'hours', days: 'days' }
    };
    const utils = {
        Utils: {
            getEnumKey: (_type, value) => value,
            rand: () => 50,
            formatDate: () => '00:00'
        }
    };
    const pie = load('gauges/controls/html-graph/graph-pie/graph-pie.component.ts', {
        '@angular/core': angular,
        '../graph-base/graph-base.component': graphBase,
        'ng2-charts': { BaseChartDirective: class {} },
        '../../../../_models/graph': graphModel,
        'chartjs-plugin-datalabels': {}
    });
    const bar = load('gauges/controls/html-graph/graph-bar/graph-bar.component.ts', {
        '@angular/core': angular,
        '../graph-base/graph-base.component': graphBase,
        '../../../../_models/graph': graphModel,
        '../../../../_helpers/utils': utils,
        '../../../../_helpers/calc': { Calc: {}, CollectionType: {} },
        'ng2-charts': { BaseChartDirective: class {} },
        '../../../../_models/hmi': { DaqQuery: class {} },
        'chartjs-plugin-datalabels': {}
    });

    const panel = {
        clientHeight: 321,
        clientWidth: 654,
        innerHTML: 'old chart',
        appendChild(node) { this.child = node; }
    };
    utils.Utils.searchTreeStartWith = () => panel;
    const element = { setAttribute() {} };
    const document = { getElementById: () => element };
    const host = load('gauges/controls/html-graph/html-graph.component.ts', {
        '@angular/core': angular,
        '../../gauge-base/gauge-base.component': { GaugeBaseComponent: class {} },
        '../../../_models/hmi': {},
        '../../../_helpers/utils': utils,
        '../../gauge-property/gauge-property.component': {},
        './graph-bar/graph-bar.component': bar,
        './graph-pie/graph-pie.component': pie,
        './graph-base/graph-base.component': graphBase
    }, { document });

    const snapshots = [];
    const resolver = { resolveComponentFactory: component => component };
    const viewContainerRef = {
        createComponent(ComponentClass) {
            const instance = new ComponentClass();
            let initialized = false;
            return {
                instance,
                location: { nativeElement: {} },
                changeDetectorRef: {
                    detectChanges() {
                        instance.chart = { update() {} };
                        snapshots.push(kind === 'pie'
                            ? { height: instance.height, width: instance.width }
                            : { height: instance.height, width: instance.width,
                                offline: instance.barChartOptions.offline });
                        if (!initialized) {
                            initialized = true;
                            instance.ngOnInit();
                            instance.ngAfterViewInit();
                        }
                    }
                }
            };
        }
    };
    const settings = { id: 'graph', name: 'Graph', type: `svg-ext-html_graph-${kind}` };
    const instance = host.HtmlGraphComponent.initElement(settings, resolver, viewContainerRef, false);
    const current = kind === 'pie'
        ? { height: instance.height, width: instance.width }
        : { height: instance.height, width: instance.width, offline: instance.barChartOptions.offline };
    return { current, rendered: snapshots.at(-1), panel };
}

for (const kind of ['pie', 'bar']) {
    test(`${kind} graph synchronizes its configured bindings before the host check`, () => {
        const result = graphRuntime(kind);
        assert.deepEqual(result.rendered, result.current);
        assert.equal(result.current.height, 321);
        assert.equal(result.current.width, 654);
        assert.ok(result.panel.child);
    });
}
