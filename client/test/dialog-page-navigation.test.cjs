const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

class EventEmitter {
    constructor() { this.values = []; }
    emit(value) { this.values.push(value); }
}

const decorator = () => () => {};

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

function createViewRuntime(child) {
    const { FuxaViewComponent } = load('fuxa-view/fuxa-view.component.ts', {
        '@angular/core': {
            Component: decorator, Input: decorator, Output: decorator,
            ViewChild: decorator, HostListener: decorator, EventEmitter
        },
        '../_models/hmi': {
            GaugeEventActionType: {
                onpage: 'PAGE', onwindow: 'WINDOW', ondialog: 'DIALOG',
                onSetValue: 'SET', onToggleValue: 'TOGGLE', onSetInput: 'INPUT',
                oniframe: 'IFRAME', oncard: 'CARD', onclose: 'CLOSE', onMonitor: 'MONITOR'
            },
            GaugeEventType: {}, GaugeStatus: class {}, ViewType: {}
        },
        '../_helpers/utils': { Utils: { getEnumKey: (_value, key) => key } },
        '../_helpers/endpointapi': { EndPointApi: { getURL: () => '' } }
    });
    const view = Object.create(FuxaViewComponent.prototype);
    view.child = child;
    view.onpage = new EventEmitter();
    return view;
}

test('an Open Page action in a child view bubbles to its owning page', () => {
    const view = createViewRuntime(true);
    view.loadPage = () => assert.fail('child view must not replace its own dialog or card content');
    const event = { clientX: 10, clientY: 20 };
    const options = { variablesMapping: [{ from: 'source', to: 'target' }] };

    view.runEvents(view, {}, event, [{ action: 'onpage', actparam: 'view-b', actoptions: options }]);

    assert.equal(view.onpage.values.length, 1);
    assert.equal(view.onpage.values[0].event, event);
    assert.equal(view.onpage.values[0].viewref, 'view-b');
    assert.equal(view.onpage.values[0].options, options);
});

test('the owning page handles a bubbled request and closes its cards', async () => {
    const view = createViewRuntime(false);
    view.cards = [{ id: 'open-card' }];
    view.getView = async id => ({ id, svgcontent: '<svg></svg>' });
    view.loadHmi = loaded => { view.loaded = loaded; };

    await view.onPageRequest({ event: null, viewref: 'view-b', options: {} });

    assert.equal(view.loaded.id, 'view-b');
    assert.equal(view.cards.length, 0);
});

test('nested child requests keep bubbling instead of replacing the child', () => {
    const view = createViewRuntime(true);
    const request = { event: null, viewref: 'view-c', options: { sourceDeviceId: 'device-1' } };

    view.onPageRequest(request);

    assert.equal(view.onpage.values.length, 1);
    assert.equal(view.onpage.values[0], request);
});

test('a dialog closes before forwarding its page request', () => {
    const order = [];
    const { FuxaViewDialogComponent } = load('fuxa-view/fuxa-view-dialog/fuxa-view-dialog.component.ts', {
        '@angular/core': { Component: decorator, Inject: decorator },
        '@angular/material/dialog': { MAT_DIALOG_DATA: {}, MatDialogRef: class {} }
    });
    const dialog = Object.create(FuxaViewDialogComponent.prototype);
    dialog.dialogRef = { close: () => order.push('close') };
    dialog.data = { onPage: request => order.push(`page:${request.viewref}`) };

    dialog.onPage({ viewref: 'view-b' });

    assert.deepEqual(order, ['close', 'page:view-b']);
});
