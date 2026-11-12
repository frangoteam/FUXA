const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const template = fs.readFileSync(path.join(
    __dirname,
    '../src/app/gauges/controls/html-graph/graph-bar/graph-bar.component.html'
), 'utf8');
const propertySource = fs.readFileSync(path.join(
    __dirname,
    '../src/app/gauges/controls/html-graph/graph-property/graph-property.component.ts'
), 'utf8');

function graphSurfaceAttributes() {
    const wrapper = template.match(/<div\b([^>]*)>/);
    assert.ok(wrapper, 'graph template must have a surface wrapper');
    return wrapper[1];
}

test('line and bar charts apply the configured background to the full graph surface', () => {
    const attributes = graphSurfaceAttributes();
    assert.match(attributes, /\[style\.backgroundColor\]="barChartOptions\.backgroundColor"/);
});

test('the background owner is the same wrapper that owns the configured dimensions', () => {
    const attributes = graphSurfaceAttributes();
    assert.match(attributes, /\[style\.height\]="height \+ 'px'"/);
    assert.match(attributes, /\[style\.width\]="width \+ 'px'"/);
    assert.match(attributes, /\[style\.backgroundColor\]="barChartOptions\.backgroundColor"/);
});

test('the built-in dark theme supplies a valid CSS background color', () => {
    assert.match(propertySource, /this\.options\.backgroundColor\s*=\s*'#242424'/);
});
