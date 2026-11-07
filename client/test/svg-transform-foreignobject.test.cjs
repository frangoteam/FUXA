'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadUtils() {
    const filename = path.join(__dirname, '../src/app/_helpers/utils.ts');
    const src = fs.readFileSync(filename, 'utf8');
    const { outputText } = ts.transpileModule(src, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true }
    });
    const exports = {};
    const noopDeco = () => (t) => t;
    const sandbox = {
        exports,
        module: { exports },
        require: (name) => {
            if (name === '@angular/core') {
                return {
                    Injectable: noopDeco,
                    Pipe: noopDeco,
                    Inject: noopDeco,
                    Optional: noopDeco,
                };
            }
            return {};
        },
        console,
        document: { createElement: () => ({ style: {} }) },
        window: {},
        navigator: { userAgent: 'node' },
        Blob: class {},
        URL: { createObjectURL: () => '', revokeObjectURL: () => {} },
        FileReader: class {},
        atob: (s) => Buffer.from(s, 'base64').toString('binary'),
        btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    };
    vm.runInNewContext(outputText, sandbox);
    return sandbox.module.exports.Utils || exports.Utils;
}

describe('svg transform foreignObject (#2384)', () => {
    const Utils = loadUtils();

    it('converts rotate(angle) to CSS degrees', () => {
        assert.equal(Utils.svgTransformAttrToCss('rotate(-90)'), 'rotate(-90deg)');
    });

    it('converts rotate(angle cx cy) to translate/rotate/translate', () => {
        const css = Utils.svgTransformAttrToCss('rotate(-90, 40, 20)');
        assert.match(css, /translate\(40px, 20px\)/);
        assert.match(css, /rotate\(-90deg\)/);
        assert.match(css, /translate\(-40px, -20px\)/);
    });

    it('promotes SVG transform to CSS for groups that wrap foreignObject', () => {
        const style = { transform: '' };
        const fo = { tagName: 'foreignObject' };
        const g = {
            getAttribute: (n) => (n === 'transform' ? 'rotate(-90, 10, 15)' : null),
            removeAttribute: function (n) { this._removed = n; },
            querySelector: (sel) => (sel === 'foreignObject' ? fo : null),
            style,
            _removed: null,
        };
        const root = {
            querySelectorAll: (sel) => (sel === '[transform]' ? [g] : []),
        };
        const n = Utils.promoteSvgTransformForForeignObject(root);
        assert.equal(n, 1);
        assert.match(g.style.transform, /rotate\(-90deg\)/);
        assert.equal(g._removed, 'transform');
    });

    it('skips elements without foreignObject or without rotate', () => {
        let removed = false;
        const g = {
            getAttribute: () => 'translate(1,2)',
            querySelector: () => null,
            style: {},
            removeAttribute: () => { removed = true; },
        };
        const root = { querySelectorAll: () => [g] };
        assert.equal(Utils.promoteSvgTransformForForeignObject(root), 0);
        g.querySelector = () => ({});
        assert.equal(Utils.promoteSvgTransformForForeignObject(root), 0);
        assert.equal(removed, false);
    });

    it('fuxa-view calls promote after injecting svgcontent', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '../src/app/fuxa-view/fuxa-view.component.ts'),
            'utf8'
        );
        assert.match(src, /promoteSvgTransformForForeignObject\(this\.dataContainer\.nativeElement\)/);
    });
});
