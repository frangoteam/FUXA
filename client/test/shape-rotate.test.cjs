const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function rotate(minAngle, maxAngle, value, min = 0, max = 100) {
    const filename = path.join(__dirname, '../src/app/gauges/shapes/shapes.component.ts');
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true }
    });
    let result;
    const element = { animate: () => ({ ease: () => ({ transform: t => { result = t.rotate; } }) }) };
    const imports = {
        '@angular/core': { Component: () => () => {} },
        '../gauge-base/gauge-base.component': { GaugeBaseComponent: class {} },
        '../../_models/hmi': { GaugeActionsType: {} }
    };
    const exports = {};
    vm.runInNewContext(outputText, { exports, console, SVG: { adopt: () => element }, require: name => imports[name] || {} });
    exports.ShapesComponent.rotateShape({ range: { min, max }, options: { minAngle, maxAngle } }, { node: {} }, value);
    return result;
}

test('clockwise rotation is unchanged', () => {
    assert.equal(rotate(0, 90, 0), 0);
    assert.equal(rotate(0, 90, 50), 45);
    assert.equal(rotate(0, 90, 100), 90);
});

test('counter-clockwise rotation with minAngle > maxAngle (#1914)', () => {
    assert.equal(rotate(0, -90, 0), 0);
    assert.equal(rotate(0, -90, 50), -45);
    assert.equal(rotate(0, -90, 100), -90);
    assert.equal(rotate(90, 0, 50), 45);
});

test('negative angles clockwise', () => {
    assert.equal(rotate(-90, 0, 50), -45);
});

test('non-zero range.min interpolates from the minimum', () => {
    // range 20-120, value 70 is the midpoint → should be halfway in angle
    assert.equal(rotate(0, 90, 70, 20, 120), 45);
    assert.equal(rotate(0, -90, 70, 20, 120), -45);
});
