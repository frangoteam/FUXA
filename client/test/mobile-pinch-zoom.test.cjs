const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { chromium } = require('playwright');

const indexPath = process.env.FUXA_INDEX_HTML || path.join(__dirname, '../src/index.html');
const source = fs.readFileSync(indexPath, 'utf8');
let browser;

test.before(async () => {
    browser = await chromium.launch({ headless: true });
});

test.after(async () => {
    await browser?.close();
});

async function render(width, height) {
    const context = await browser.newContext({
        viewport: { width, height },
        screen: { width, height },
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: width < 768
    });
    const page = await context.newPage();
    await page.setContent(source, { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(() => ({
        viewport: document.querySelector('meta[name="viewport"]')?.content,
        htmlTouchAction: getComputedStyle(document.documentElement).touchAction,
        bodyTouchAction: getComputedStyle(document.body).touchAction
    }));
    await context.close();
    return result;
}

test('viewport policy does not cap or disable browser zoom', () => {
    assert.doesNotMatch(source, /user-scalable\s*=\s*no/i);
    assert.doesNotMatch(source, /(?:minimum|maximum)-scale\s*=/i);
    assert.equal([...source.matchAll(/user-scalable=yes/g)].length, 2);
});

test('mobile viewport fits the HMI and permits panning and pinch zoom', async () => {
    const result = await render(390, 844);
    assert.equal(result.viewport,
        'width=768, initial-scale=0.5078125, user-scalable=yes, viewport-fit=cover');
    // CSS `manipulation` is the canonical pan-x/pan-y/pinch-zoom alias.
    assert.equal(result.htmlTouchAction, 'manipulation');
    assert.equal(result.bodyTouchAction, 'manipulation');
});

test('desktop viewport also leaves browser zoom available', async () => {
    const result = await render(1280, 720);
    assert.equal(result.viewport, 'width=device-width, initial-scale=1, user-scalable=yes');
    assert.equal(result.htmlTouchAction, 'manipulation');
    assert.equal(result.bodyTouchAction, 'manipulation');
});

test('orientation changes still reload the fitted viewport', () => {
    assert.match(source, /addEventListener\(['"]orientationchange['"]/);
    assert.match(source, /window\.location\.reload\(\)/);
});
