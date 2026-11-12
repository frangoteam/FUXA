const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appRoot = path.join(__dirname, '../src/app');
const template = fs.readFileSync(path.join(appRoot, 'app.component.html'), 'utf8');
const styles = fs.readFileSync(path.join(appRoot, 'app.component.scss'), 'utf8');

function rule(selector) {
    const match = styles.match(new RegExp(`\\.${selector}\\s*\\{([\\s\\S]*?)\\n    \\}`, 'm'));
    assert.ok(match, `missing .${selector} style rule`);
    return match[1];
}

test('connection failure renders the banner and interaction overlay from one status subscription', () => {
    assert.equal((template.match(/serverErrorBanner\$\s*\|\s*async/g) || []).length, 1);
    const guarded = template.match(/<ng-container\s+\*ngIf="serverErrorBanner\$\s*\|\s*async">([\s\S]*?)<\/ng-container>/);
    assert.ok(guarded, 'connection status should guard the banner and overlay together');
    assert.match(guarded[1], /class="banner"/);
    assert.match(guarded[1], /class="connection-overlay"/);
    assert.match(guarded[1], /aria-hidden="true"/);
});

test('connection overlay covers the viewport below the banner and intercepts input', () => {
    const overlay = rule('connection-overlay');
    assert.match(overlay, /position:\s*fixed\s*;/);
    assert.match(overlay, /top:\s*48px\s*;/);
    for (const edge of ['right', 'bottom', 'left']) {
        assert.match(overlay, new RegExp(`${edge}:\\s*0(?:px)?\\s*;`));
    }
    assert.match(overlay, /background-color:\s*rgba\(0,\s*0,\s*0,\s*0\.[1-9]\d*\)\s*;/);
    assert.match(overlay, /pointer-events:\s*auto\s*;/);

    const overlayZ = Number(overlay.match(/z-index:\s*(\d+)\s*;/)?.[1]);
    const bannerZ = Number(rule('banner').match(/z-index:\s*(\d+)\s*;/)?.[1]);
    assert.ok(overlayZ > 0 && overlayZ < bannerZ, 'overlay should cover the app without hiding the banner');
});
