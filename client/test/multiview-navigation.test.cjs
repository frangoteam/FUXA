const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const template = fs.readFileSync(
    path.join(__dirname, '../src/app/cards-view/cards-view.component.html'),
    'utf8'
);

test('embedded views forward page navigation through the multi-view container', () => {
    const embeddedView = template.match(/<app-fuxa-view\b[\s\S]*?<\/app-fuxa-view>/)?.[0];

    assert.ok(embeddedView, 'multi-view template must render an embedded FUXA view');
    assert.match(embeddedView, /\(ongoto\)="onGoToPage\(\$event\)"/);
});

test('map and SVG cards use the same container navigation output', () => {
    const relays = [...template.matchAll(/\(on(?:GoTo|goto)\)="onGoToPage\(\$event\)"/g)];

    assert.equal(relays.length, 2);
});
