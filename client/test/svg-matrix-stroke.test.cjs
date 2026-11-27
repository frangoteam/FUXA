const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const editor = fs.readFileSync(path.join(__dirname, '../src/assets/lib/svgeditor/fuxa-editor.min.js'), 'utf8');
const branch = editor.match(/var _=St\.getAttribute\("stroke-width"\);if\((.*?)\)\{var tt=\(Math\.abs\(Y\.a\)\+Math\.abs\(Y\.d\)\)\/2;St\.setAttribute\("stroke-width",_\*tt\)\}/);

assert.ok(branch, 'matrix stroke adjustment branch is present in the shipped editor');
const shouldScaleAttribute = new Function('St', 'it', '_', `return (${branch[1]});`);

function apparentStrokeWidth({ width, scale, transformAbsorbed, stroke = '#000' }) {
    const it = { numberOfItems: transformAbsorbed ? 0 : 1 };
    const St = { getAttribute: name => name === 'stroke' ? stroke : String(width) };
    const adjustedWidth = shouldScaleAttribute(St, it, width) ? width * scale : width;
    return adjustedWidth * (transformAbsorbed ? 1 : scale);
}

test('a matrix retained on a shape scales its stroke exactly once', () => {
    assert.equal(apparentStrokeWidth({ width: 4, scale: 2, transformAbsorbed: false }), 8);
});

test('a matrix absorbed into path geometry retains its apparent stroke width', () => {
    assert.equal(apparentStrokeWidth({ width: 4, scale: 2, transformAbsorbed: true }), 8);
});

test('unpainted shapes do not receive a stroke-width adjustment', () => {
    assert.equal(apparentStrokeWidth({ width: 4, scale: 2, transformAbsorbed: true, stroke: 'none' }), 4);
});
