const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');
const ts = require('typescript');

// Exercise the application methods against the shipped SVG editor in a real browser.
// Only Angular decorators and unrelated controls/services are replaced in this harness.
const root = path.resolve(__dirname, '..');
const sources = [
    ['utils', '_helpers/utils.ts'], ['svgUtils', '_helpers/svg-utils.ts'],
    ['base', 'gauges/gauge-base/gauge-base.component.ts'],
    ['image', 'gauges/controls/html-image/html-image.component.ts'],
    ['gauges', 'gauges/gauges.component.ts'], ['editor', 'editor/editor.component.ts']
].map(([name, file]) => [name, ts.transpileModule(fs.readFileSync(path.join(root, 'src/app', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true }
}).outputText]);
let server, browser, origin;

before(async () => {
    server = http.createServer((req, res) => {
        if (req.url === '/') {
            res.setHeader('Content-Type', 'text/html');
            res.end('<!doctype html><html><body><div id="svgcanvas"></div></body></html>');
            return;
        }
        const filename = path.resolve(root, 'src', '.' + decodeURIComponent(req.url));
        if (!filename.startsWith(path.join(root, 'src') + path.sep) || !fs.existsSync(filename)) {
            res.writeHead(404).end();
            return;
        }
        res.end(fs.readFileSync(filename));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ channel: process.env.FUXA_TEST_BROWSER || 'chromium', headless: true });
});

after(async () => {
    await browser?.close();
    await new Promise(resolve => server?.close(resolve));
});

async function fixture(t) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
    t.after(() => page.close());
    await page.goto(origin);
    for (const file of ['jquery.min.js', 'jquery-ui-1.8.17.custom.min.js', 'jquery-plugin.min.js', 'fuxa-editor.min.js']) {
        await page.addScriptTag({ url: origin + '/assets/lib/svgeditor/' + file });
    }
    await page.evaluate(({ sources }) => {
        const decorator = () => () => {};
        const angular = new Proxy({}, { get: () => decorator });
        const classes = new Map();
        const fallback = new Proxy({}, { get: (_, name) => {
            if (!classes.has(name)) {
                const control = class {};
                control.TypeTag = { ShapesComponent: 'svg-ext-shapes', ProcEngComponent: 'svg-ext-proceng',
                    ApeShapesComponent: 'svg-ext-ape' }[name] || String(name);
                classes.set(name, control);
            }
            return classes.get(name);
        } });
        const modules = {};
        const imports = {
            '@angular/core': angular,
            '../../../_helpers/endpointapi': { EndPointApi: { getURL: () => '', getBasePath: () => '' } },
            '../../../_models/device': { DeviceType: { WebCam: 'WebCam' } },
            '../../../_models/hmi': { GaugePropertyColor: class {} },
            '../_models/hmi': { ViewType: { cards: 'cards', maps: 'maps' } }
        };
        for (const [name, source] of sources) {
            const exports = {};
            new Function('require', 'exports', source)(id => imports[id]
                ? new Proxy(imports[id], { get: (value, key) => value[key] ?? fallback[key] }) : fallback, exports);
            modules[name] = exports;
            if (name === 'utils') {
                for (const id of ['./utils', '../_helpers/utils', '../../_helpers/utils', '../../../_helpers/utils']) imports[id] = exports;
            } else if (name === 'svgUtils') {
                imports['../../../_helpers/svg-utils'] = exports;
            } else if (name === 'base') {
                imports['../../gauge-base/gauge-base.component'] = exports;
            } else if (name === 'image') {
                imports['./controls/html-image/html-image.component'] = exports;
                imports['../gauges/controls/html-image/html-image.component'] = exports;
            } else if (name === 'gauges') {
                imports['../gauges/gauges.component'] = exports;
            }
        }
        Object.assign(window, {
            HtmlImageComponent: modules.image.HtmlImageComponent,
            GaugesManager: modules.gauges.GaugesManager
        });
        mypathseg.initPathSeg();
        mybrowser.initBrowser();
        mysvgutils.initSvgutils();
        myselect.initSelect();
        mydraw.initDraw();
        mysvgcanvas.initSvgCanvas();
        const canvas = new $.SvgCanvas(document.getElementById('svgcanvas'), {
            dimensions: [900, 600], initFill: { color: 'FFFFFF', opacity: 1 },
            initStroke: { color: '000000', opacity: 1, width: 1 }, initOpacity: 1, baseUnit: 'px'
        });
        document.getElementById('svgcontent').setAttribute('x', '0');
        document.getElementById('svgcontent').setAttribute('y', '0');
        window.canvas = canvas;
        window.svgEditor = {
            canvas,
            getSelectedElements: () => canvas.getSelectedElems(),
            selectOnly: elements => canvas.selectOnly(elements),
            setColor: (solidColor, alpha, type) => canvas.setPaint(type, { solidColor, alpha, type: 'solidColor' }),
            getSvgString: () => canvas.getSvgString()
        };
        window.editor = Object.create(modules.editor.EditorComponent.prototype);
        editor.winRef = { nativeWindow: window };
        editor.currentView = { items: {} };
        editor.projectService = { setView: view => { window.savedView = JSON.parse(JSON.stringify(view)); } };
        window.importWidget = (content, id = 'OXC_test') => {
            const group = canvas.addSvgElementFromJson({ element: 'g', attr: { id, type: HtmlImageComponent.TypeTag, fill: '#ffffff' } });
            group.innerHTML = `<rect id="bg_${id}" x="20" y="20" width="300" height="220" fill="#ffffff" stroke="none" stroke-width="0"/>
                <foreignObject x="20" y="20" width="300" height="220"><div xmlns="http://www.w3.org/1999/xhtml" id="D-${id}" style="width:100%;height:100%"></div></foreignObject>`;
            const settings = { id, type: HtmlImageComponent.TypeTag, property: { address: 'test.svg', actions: [] } };
            localStorage.setItem('test.svg', content);
            HtmlImageComponent.initElement(settings, false);
            editor.currentView.items[id] = settings;
            canvas.selectOnly([group]);
            return settings;
        };
        window.changeFill = value => { editor.colorFill = value; editor.onChangeFillColor(value); };
        window.snapshot = () => document.querySelector('[id^="D-OXC_"] svg').outerHTML;
    }, { sources });
    await page.evaluate(svg => { window.settings = importWidget(svg); }, fs.readFileSync(path.join(__dirname, 'fixtures/multicolor-widget.svg'), 'utf8'));
    return page;
}

for (const color of ['none', 'rgba(0,0,0,0)', '#88bbdd']) {
    test(`widget background ${color} preserves fills, strokes, inline style, groups and geometry`, async t => {
        const page = await fixture(t);
        const result = await page.evaluate(color => {
            const before = snapshot();
            const svg = document.querySelector('[id^="D-OXC_"] svg');
            const group = document.getElementById('OXC_test');
            changeFill(color);
            return { before, after: snapshot(), sameNode: svg === document.querySelector('[id^="D-OXC_"] svg'),
                selected: svgEditor.getSelectedElements()[0] === group,
                background: getComputedStyle(document.getElementById('bg_OXC_test')).fill };
        }, color);
        if (process.env.FUXA_SCREENSHOT_DIR) {
            fs.mkdirSync(process.env.FUXA_SCREENSHOT_DIR, { recursive: true });
            await page.screenshot({ path: path.join(process.env.FUXA_SCREENSHOT_DIR, color.startsWith('#') ? 'solid.png' : 'transparent.png') });
        }
        assert.equal(result.after, result.before);
        assert.equal(result.sameNode, true);
        assert.equal(result.selected, true);
        assert.equal(result.background, color.startsWith('#') ? 'rgb(136, 187, 221)' : color === 'none' ? 'none' : 'rgba(0, 0, 0, 0)');
    });
}

test('background color is reported by the widget color picker', async t => {
    const page = await fixture(t);
    const result = await page.evaluate(() => {
        changeFill('#88bbdd');
        const colors = {};
        const handled = GaugesManager.checkGaugeColor(settings, svgEditor.getSelectedElements(), colors);
        return { handled, colors };
    });
    assert.equal(result.handled, true);
    assert.equal(result.colors.fill, '#88bbdd');
});

test('background change has working undo/redo without changing widget artwork', async t => {
    const page = await fixture(t);
    const result = await page.evaluate(() => {
        const before = snapshot();
        changeFill('#88bbdd');
        canvas.undoMgr.undo();
        const undone = document.getElementById('bg_OXC_test').getAttribute('fill');
        canvas.undoMgr.redo();
        return { before, after: snapshot(), undone, redone: document.getElementById('bg_OXC_test').getAttribute('fill') };
    });
    assert.equal(result.after, result.before);
    assert.equal(result.undone, '#ffffff');
    assert.equal(result.redone, '#88bbdd');
});

test('dynamic widget colors continue receiving bound values after background changes', async t => {
    const page = await fixture(t);
    const result = await page.evaluate(() => {
        const variable = settings.property.varsToBind.find(variable => variable.type === 'color');
        variable.variableId = 'tag-color';
        const label = document.querySelector('[id^="label_"]');
        HtmlImageComponent.processValue(settings, { node: document.getElementById(settings.id) }, { id: 'tag-color', value: '#aa22dd' }, {});
        const first = label.getAttribute('fill');
        changeFill('rgba(0,0,0,0)');
        const preserved = label.getAttribute('fill');
        HtmlImageComponent.processValue(settings, { node: document.getElementById(settings.id) }, { id: 'tag-color', value: '#22ddaa' }, {});
        return { first, preserved, updated: label.getAttribute('fill') };
    });
    assert.deepEqual(result, { first: '#aa22dd', preserved: '#aa22dd', updated: '#22ddaa' });
});

test('save through EditorComponent and reload through HtmlImageComponent preserves colors', async t => {
    const page = await fixture(t);
    const result = await page.evaluate(() => {
        const before = snapshot();
        const properties = JSON.stringify(settings.property);
        changeFill('#88bbdd');
        editor.onSaveProject();
        canvas.setSvgString(savedView.svgcontent);
        HtmlImageComponent.initElement(savedView.items.OXC_test, false);
        return { before, after: snapshot(), propertiesUnchanged: properties === JSON.stringify(savedView.items.OXC_test.property),
            background: document.getElementById('bg_OXC_test').getAttribute('fill') };
    });
    assert.equal(result.after, result.before);
    assert.equal(result.propertiesUnchanged, true);
    assert.equal(result.background, '#88bbdd');
});

test('native shapes and explicitly selected widget children remain editable', async t => {
    const page = await fixture(t);
    const result = await page.evaluate(() => {
        const native = ['rect', 'circle', 'text'].map((element, index) => canvas.addSvgElementFromJson({ element,
            attr: { id: 'native_' + index, x: 350, y: 40, cx: 400, cy: 80, r: 25, width: 70, height: 40, fill: '#123456', stroke: '#654321' } }));
        native[2].textContent = 'Native';
        canvas.selectOnly(native);
        changeFill('#88bbdd');
        const nativeColors = native.map(element => [element.getAttribute('fill'), element.getAttribute('stroke')]);
        const child = document.querySelector('[id^="bezel_"]');
        canvas.selectOnly([child]);
        changeFill('#aabbcc');
        return { nativeColors, childFill: child.getAttribute('fill'), childStroke: child.getAttribute('stroke') };
    });
    assert.deepEqual(result.nativeColors, Array(3).fill(['#88bbdd', '#654321']));
    assert.equal(result.childFill, '#aabbcc');
    assert.equal(result.childStroke, '#111111');
});

for (const grouped of [false, true]) {
    test(`mixed widget/native selection${grouped ? ' inside a group' : ''} retains artwork and selection`, async t => {
        const page = await fixture(t);
        const result = await page.evaluate(grouped => {
            const widget = document.getElementById('OXC_test');
            const native = canvas.addSvgElementFromJson({ element: 'rect', attr: {
                id: 'native_rect', x: 350, y: 20, width: 100, height: 100, fill: '#123456'
            } });
            let selection = [widget, native];
            if (grouped) {
                const group = canvas.addSvgElementFromJson({ element: 'g', attr: { id: 'mixed_group' } });
                group.append(widget, native);
                selection = [group];
            }
            canvas.selectOnly(selection);
            const before = snapshot();
            changeFill('#88bbdd');
            return { before, after: snapshot(), native: native.getAttribute('fill'),
                background: document.getElementById('bg_OXC_test').getAttribute('fill'),
                selected: selection.every(element => canvas.getSelectedElems().includes(element)) };
        }, grouped);
        assert.equal(result.after, result.before);
        assert.equal(result.native, '#88bbdd');
        assert.equal(result.background, '#88bbdd');
        assert.equal(result.selected, true);
    });
}

test('data point color ranges keep working on image controls', async t => {
    const page = await fixture(t);
    const result = await page.evaluate(() => {
        changeFill('none');
        settings.property.variableId = 'tag-status';
        settings.property.ranges = [{ min: 1, max: 2, color: '#dd4422', stroke: '#448822' }];
        const node = document.getElementById(settings.id);
        const before = snapshot();
        HtmlImageComponent.processValue(settings, { node }, { id: 'tag-status', value: 1 }, {});
        return { before, after: snapshot(), fill: node.getAttribute('fill'), stroke: node.getAttribute('stroke') };
    });
    assert.equal(result.after, result.before);
    assert.equal(result.fill, '#dd4422');
    assert.equal(result.stroke, '#448822');
});

// The upstream issue attachment is intentionally kept outside the repository.
// FUXA_ISSUE_FIXTURE=/path/to/Test.json also checks both original exported widgets.
if (process.env.FUXA_ISSUE_FIXTURE) {
    test('issue #2472 Test.json retains both widgets when their backgrounds change', async t => {
        const page = await fixture(t);
        const project = JSON.parse(fs.readFileSync(process.env.FUXA_ISSUE_FIXTURE, 'utf8'));
        const result = await page.evaluate(project => {
            const view = project.hmi.views[0];
            canvas.setSvgString(view.svgcontent);
            editor.currentView = view;
            const results = [];
            for (const item of Object.values(view.items)) {
                HtmlImageComponent.initElement(item, false);
                const group = document.getElementById(item.id);
                const svg = group.querySelector('foreignObject svg');
                const before = svg.outerHTML;
                canvas.selectOnly([group]);
                changeFill('none');
                results.push(svg.outerHTML === before);
            }
            return results;
        }, project);
        if (process.env.FUXA_SCREENSHOT_DIR) {
            await page.screenshot({ path: path.join(process.env.FUXA_SCREENSHOT_DIR, 'issue-2472.png') });
        }
        assert.deepEqual(result, [true, true]);
    });
}
