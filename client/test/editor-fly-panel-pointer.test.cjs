'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('editor fly panel blocks pointer events to canvas (#1739)', () => {
    const html = fs.readFileSync(
        path.join(__dirname, '../src/app/editor/editor.component.html'),
        'utf8'
    );
    const ts = fs.readFileSync(
        path.join(__dirname, '../src/app/editor/editor.component.ts'),
        'utf8'
    );
    const css = fs.readFileSync(
        path.join(__dirname, '../src/app/editor/editor.component.css'),
        'utf8'
    );

    it('svg-tools-fly stops mousedown/pointerdown propagation', () => {
        assert.match(html, /class="svg-tools-fly"[^>]*\(mousedown\)="onFlyPointerDown\(\$event\)"/);
        assert.match(html, /class="svg-tools-fly"[^>]*\(pointerdown\)="onFlyPointerDown\(\$event\)"/);
    });

    it('property side drawers also stop propagation', () => {
        assert.match(html, /class="editor-sidenav"[^>]*\(mousedown\)="onFlyPointerDown\(\$event\)"/);
        assert.match(html, /class="sidepanel-selector"[^>]*\(mousedown\)="onFlyPointerDown\(\$event\)"/);
    });

    it('onFlyPointerDown stops propagation and ends active drag', () => {
        assert.match(ts, /onFlyPointerDown\(event: Event\)\s*\{[\s\S]*?event\.stopPropagation\(\);[\s\S]*?endActivePointerInteraction/);
    });

    it('fly panel and sidenavs keep pointer-events auto', () => {
        assert.match(css, /\.svg-tools-fly\s*\{[^}]*pointer-events:\s*auto/);
        assert.match(css, /\.editor-sidenav\s*\{[^}]*pointer-events:\s*auto/);
    });
});
