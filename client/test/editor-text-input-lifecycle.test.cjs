const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const parse5 = require('parse5');

const clientRoot = path.resolve(__dirname, '..');
const template = fs.readFileSync(path.join(clientRoot, 'src/app/editor/editor.component.html'), 'utf8');
const editorRuntime = fs.readFileSync(path.join(clientRoot, 'src/assets/lib/svgeditor/fuxa-editor.min.js'), 'utf8');
const editorStyles = fs.readFileSync(path.join(clientRoot, 'src/assets/lib/svgeditor/svg-editor.min.css'), 'utf8');

function attributes(node) {
    return Object.fromEntries((node.attrs || []).map(attribute => [attribute.name, attribute.value]));
}

function findNodes(node, predicate, ancestors = [], result = []) {
    if (predicate(node)) {
        result.push({ node, ancestors });
    }
    for (const child of node.childNodes || []) {
        findNodes(child, predicate, [...ancestors, node], result);
    }
    return result;
}

test('the SVG text editor input remains focusable when Transform is collapsed', () => {
    const document = parse5.parseFragment(template);
    const matches = findNodes(document, node => attributes(node).id === 'text');

    assert.equal(matches.length, 1, 'the legacy SVG editor requires exactly one #text input');
    assert.equal(matches[0].node.nodeName, 'input');
    assert.ok(!matches[0].ancestors.some(node => node.nodeName === 'mat-expansion-panel'),
        '#text must not be hidden with a collapsible property panel');
    assert.ok(matches[0].ancestors.some(node => attributes(node).id === 'svg_editor'),
        '#text must stay inside #svg_editor');
});

test('the legacy editor still binds text editing to #text', () => {
    assert.match(editorRuntime, /textActions\.setInputElem\(e\("#text"\)\[0\]\)/);
    assert.match(editorRuntime, /e\("#text"\)\.focus\(\)\.select\(\)/);
    assert.match(editorRuntime, /input:not\(#text\)/);
});

test('the focus input stays visually off-screen', () => {
    assert.match(editorStyles, /#text\{position:absolute;left:-9999px\}/);
});
