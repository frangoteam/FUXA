const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const minPath = path.join(__dirname, '../src/assets/lib/svgeditor/fuxa-editor.min.js');

describe('editor delete/backspace dialog guard (#2544)', () => {
    it('does not delete while a Material dialog overlay is open', () => {
        const src = fs.readFileSync(minPath, 'utf8');
        const idx = src.indexOf('bt=function(e){');
        assert.ok(idx >= 0, 'delete handler bt should exist');
        const snippet = src.slice(idx, idx + 420);
        assert.match(snippet, /mat-dialog-container/);
        assert.match(snippet, /cdk-overlay-container/);
        assert.match(snippet, /querySelector\([^)]*mat-dialog-container[^)]*\)\)return/);
    });

    it('header onSetup clears selection before opening Setup', () => {
        const header = fs.readFileSync(
            path.join(__dirname, '../src/app/header/header.component.ts'),
            'utf8'
        );
        const m = header.match(/onSetup\(\)\s*\{[\s\S]*?\n    \}/);
        assert.ok(m, 'onSetup method present');
        assert.match(m[0], /clearSelection/);
        assert.match(m[0], /SetupComponent/);
    });
});
