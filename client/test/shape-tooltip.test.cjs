const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');
const ts = require('typescript');

// Run GaugesManager.setTooltip against a real SVG DOM in the browser.
const root = path.resolve(__dirname, '..');
const source = ts.transpileModule(fs.readFileSync(path.join(root, 'src/app/gauges/gauges.component.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true }
}).outputText;
let browser, page;

before(async () => {
    browser = await chromium.launch({ channel: process.env.FUXA_TEST_BROWSER || 'chromium', headless: true });
    page = await browser.newPage();
    await page.setContent(`<!doctype html><html><body><svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">
        <g id="shape"><rect x="10" y="10" width="50" height="50"/></g>
        <g id="button"><title>old</title><rect x="100" y="10" width="80" height="30"/>
            <foreignObject x="100" y="10" width="80" height="30"><button>Button</button></foreignObject></g>
    </svg></body></html>`);
    await page.evaluate(code => {
        const decorator = () => undefined;
        const stub = new Proxy(function () {}, { get: (_, name) => name === '__esModule' ? false : (name === 'prototype' ? {} : stub), apply: () => decorator });
        const exports = {};
        new Function('exports', 'require', code)(exports, () => stub);
        window.GaugesManager = exports.GaugesManager;
    }, source);
});

after(async () => {
    await browser?.close();
});

const titles = id => page.evaluate(id => Array.from(document.getElementById(id).children)
    .filter(c => c.tagName === 'title').map(c => ({ text: c.textContent, ns: c.namespaceURI, first: c === c.parentNode.firstChild })), id);

test('setTooltip adds an svg title as first child of the shape', async () => {
    await page.evaluate(() => GaugesManager.setTooltip(document.getElementById('shape'), 'Pump 1 running'));
    assert.deepEqual(await titles('shape'), [{ text: 'Pump 1 running', ns: 'http://www.w3.org/2000/svg', first: true }]);
});

test('setTooltip replaces an existing title and can remove it', async () => {
    await page.evaluate(() => GaugesManager.setTooltip(document.getElementById('button'), 'Start motor'));
    assert.deepEqual(await titles('button'), [{ text: 'Start motor', ns: 'http://www.w3.org/2000/svg', first: true }]);
    await page.evaluate(() => GaugesManager.setTooltip(document.getElementById('button'), ''));
    assert.deepEqual(await titles('button'), []);
    await page.evaluate(() => GaugesManager.setTooltip(null, 'ignored'));
});

test('tooltip property label exists in every language', () => {
    const dir = path.join(root, 'src/assets/i18n');
    for (const lang of fs.readdirSync(dir)) {
        const json = JSON.parse(fs.readFileSync(path.join(dir, lang), 'utf8').replace(/^\uFEFF/, ''));
        assert.ok(json['gauges.property-tooltip'], lang);
    }
});
