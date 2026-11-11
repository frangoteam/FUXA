const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const clientRoot = path.resolve(__dirname, '..');
const template = fs.readFileSync(
  path.join(clientRoot, 'src/app/editor/editor.component.html'),
  'utf8'
);
const svgEditor = fs.readFileSync(
  path.join(clientRoot, 'src/assets/lib/svgeditor/fuxa-editor.min.js'),
  'utf8'
);

test('keeps the SVG text bridge visible when Transform is collapsed', () => {
  const textInputs = template.match(/<input\b[^>]*\bid="text"[^>]*>/g) || [];
  assert.equal(textInputs.length, 1, 'the SVG editor must have exactly one #text bridge');

  const transformPanel = template.match(
    /<mat-expansion-panel\b[^>]*panelPropertyTransformOpenState[^>]*>[\s\S]*?<\/mat-expansion-panel>/
  );
  assert.ok(transformPanel, 'the Transform expansion panel must be present');
  assert.doesNotMatch(
    transformPanel[0],
    /<input\b[^>]*\bid="text"/,
    'collapsing Transform must not hide the text-edit bridge'
  );

  assert.match(
    svgEditor,
    /textActions\.setInputElem\([^)]*#text/,
    'SVG-Edit must still bind its text actions to the bridge'
  );
});
