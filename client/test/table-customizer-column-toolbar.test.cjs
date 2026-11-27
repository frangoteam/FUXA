'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const componentDir = path.join(
    __dirname,
    '../src/app/gauges/controls/html-table/table-customizer'
);
const template = fs.readFileSync(path.join(componentDir, 'table-customizer.component.html'), 'utf8');
const styles = fs.readFileSync(path.join(componentDir, 'table-customizer.component.scss'), 'utf8');

const toolbarIndex = template.indexOf('class="toolbox-column"');
const tableIndex = template.indexOf('<mat-table');

assert.notStrictEqual(toolbarIndex, -1, 'the add-column toolbar must exist');
assert.notStrictEqual(tableIndex, -1, 'the customized table must exist');
assert.ok(
    toolbarIndex < tableIndex,
    'the add-column toolbar must be outside and before the table so it cannot cover the last header menu'
);

const toolbarRule = styles.match(/\.toolbox-column\s*\{([^}]*)\}/);
assert.ok(toolbarRule, 'the add-column toolbar must have a layout rule');
assert.doesNotMatch(
    toolbarRule[1],
    /position\s*:\s*absolute/,
    'the add-column toolbar must not overlay table header controls'
);

console.log('table customizer add-column toolbar does not overlap column menus');
