const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const clientRoot = path.resolve(__dirname, '..');
const componentCss = fs.readFileSync(
    path.join(clientRoot, 'src/app/gui-helpers/ngx-switch/ngx-switch.component.css'),
    'utf8'
);
const globalCss = fs.readFileSync(path.join(clientRoot, 'src/styles.css'), 'utf8');

function declarationsFor(css, selector) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'm'));
    assert.ok(match, `missing ${selector} rule`);
    return Object.fromEntries(
        match[1]
            .split(';')
            .map((declaration) => declaration.trim())
            .filter(Boolean)
            .map((declaration) => {
                const separator = declaration.indexOf(':');
                return [
                    declaration.slice(0, separator).trim(),
                    declaration.slice(separator + 1).trim()
                ];
            })
    );
}

test('the switch component host fills the SVG foreignObject label', () => {
    const host = declarationsFor(componentCss, ':host');

    assert.equal(host.display, 'block');
    assert.equal(host.width, '100%');
    assert.equal(host.height, '100%');
});

test('switch internals stay relative to the fixed host box in both states', () => {
    const label = declarationsFor(globalCss, '.md-switch');
    const toggle = declarationsFor(globalCss, '.toggle-button');
    const activeSlider = declarationsFor(globalCss, '.toggle-button.active > .inner-circle');

    assert.equal(label.width, '100%');
    assert.equal(label.height, '100%');
    assert.equal(toggle.width, '100%');
    assert.equal(toggle.height, '100%');
    assert.equal(activeSlider['margin-left'], '50%');
});
