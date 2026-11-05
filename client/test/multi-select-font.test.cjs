const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');

// Exercise the shipped SVG canvas font setters with several selected elements.
const root = path.resolve(__dirname, '..');
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
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    t.after(() => page.close());
    await page.goto(origin);
    for (const file of ['jquery.min.js', 'jquery-ui-1.8.17.custom.min.js', 'jquery-plugin.min.js', 'fuxa-editor.min.js']) {
        await page.addScriptTag({ url: origin + '/assets/lib/svgeditor/' + file });
    }
    await page.evaluate(() => {
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
        window.canvas = canvas;
        // Minimal button-like extension: applies font attributes to the inner button style.
        canvas.addExtension('test_button', () => ({
            setFontAttribute: ({ elem, attr, value }) => {
                const button = elem.querySelector('button');
                if (button) {
                    button.style[attr.replace('text-anchor', 'text-align')] = value.replace('middle', 'center').replace('end', 'right').replace('start', 'left');
                }
            }
        }));
        window.addButton = id => {
            const group = canvas.addSvgElementFromJson({ element: 'g', attr: { id, type: 'svg-ext-html_button' } });
            group.innerHTML = `<rect x="10" y="10" width="80" height="30"/><foreignObject x="10" y="10" width="80" height="30">
                <div xmlns="http://www.w3.org/1999/xhtml"><button style="font-size:14px">${id}</button></div></foreignObject>`;
            return group;
        };
        window.fonts = () => [...document.querySelectorAll('button')].map(b => [b.style.fontFamily, b.style.fontSize, b.style.textAlign]);
    });
    return { page, errors };
}

test('font family, size and alignment are applied to every selected button', async t => {
    const { page, errors } = await fixture(t);
    const result = await page.evaluate(() => {
        const groups = ['HXB_1', 'HXB_2', 'HXB_3'].map(addButton);
        canvas.selectOnly(groups);
        canvas.setFontFamily('Courier New');
        canvas.setFontSize(22);
        canvas.setTextAlign('end');
        return fonts();
    });
    assert.deepEqual(result, Array(3).fill(['"Courier New"', '22px', 'right']));
    assert.deepEqual(errors, []);
});

test('single selection keeps changing only the selected button', async t => {
    const { page, errors } = await fixture(t);
    const result = await page.evaluate(() => {
        const groups = ['HXB_1', 'HXB_2'].map(addButton);
        canvas.selectOnly([groups[1]]);
        canvas.setFontFamily('Arial');
        return fonts();
    });
    assert.deepEqual(result, [['', '14px', ''], ['Arial', '14px', '']]);
    assert.deepEqual(errors, []);
});
