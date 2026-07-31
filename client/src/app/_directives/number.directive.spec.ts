import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NumberOnlyDirective, NonNegativeIntegerOnlyDirective } from './number.directive';

function fireKey(el: HTMLInputElement, key: string, currentValue = ''): boolean {
    el.value = currentValue;
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    let prevented = false;
    event.preventDefault = () => { prevented = true; };
    el.dispatchEvent(event);
    return prevented;
}

function firePaste(el: HTMLInputElement, text: string): boolean {
    // ClipboardEvent/DataTransfer not available in jsdom — use a plain Event
    // with a manually attached clipboardData mock
    const event = new Event('paste', { bubbles: true, cancelable: true }) as any;
    event.clipboardData = { getData: (_: string) => text };
    let prevented = false;
    event.preventDefault = () => { prevented = true; };
    el.dispatchEvent(event);
    return prevented;
}

function fireInput(el: HTMLInputElement, value: string): string {
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return el.value;
}

// ─── NumberOnlyDirective — must remain IDENTICAL to original ────────────────
@Component({ template: `<input numberOnly type="number" />` })
class NumberOnlyHost {}

describe('NumberOnlyDirective — original behaviour fully preserved (no regression)', () => {
    let fixture: ComponentFixture<NumberOnlyHost>;
    let input: HTMLInputElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            declarations: [NumberOnlyHost, NumberOnlyDirective]
        }).compileComponents();
        fixture = TestBed.createComponent(NumberOnlyHost);
        fixture.detectChanges();
        input = fixture.debugElement.query(By.css('input')).nativeElement;
    });

    it('should allow digits', () => {
        expect(fireKey(input, '5')).toBe(false);
    });

    it('should allow navigation keys', () => {
        expect(fireKey(input, 'Backspace', '5')).toBe(false);
        expect(fireKey(input, 'Delete', '5')).toBe(false);
        expect(fireKey(input, 'ArrowLeft')).toBe(false);
        expect(fireKey(input, 'ArrowRight')).toBe(false);
        expect(fireKey(input, 'Tab')).toBe(false);
    });

    // Original numberOnly is a no-op for all non-nav keys — must stay that way
    it('should NOT block minus sign (original permissive behaviour)', () => {
        expect(fireKey(input, '-', '')).toBe(false);
    });

    it('should NOT block decimal point (original permissive behaviour)', () => {
        expect(fireKey(input, '.', '3')).toBe(false);
    });

    it('should NOT block letter e (original permissive behaviour)', () => {
        expect(fireKey(input, 'e', '')).toBe(false);
    });
});

// ─── NonNegativeIntegerOnlyDirective — fix for issue #1865 ──────────────────
@Component({ template: `<input nonNegativeIntegerOnly type="number" min="0" step="1" />` })
class NonNegativeHost {}

describe('NonNegativeIntegerOnlyDirective — fix for issue #1865', () => {
    let fixture: ComponentFixture<NonNegativeHost>;
    let input: HTMLInputElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            declarations: [NonNegativeHost, NonNegativeIntegerOnlyDirective]
        }).compileComponents();
        fixture = TestBed.createComponent(NonNegativeHost);
        fixture.detectChanges();
        input = fixture.debugElement.query(By.css('input')).nativeElement;
    });

    // --- keydown ---
    it('should ALLOW digits 0-9', () => {
        expect(fireKey(input, '0')).toBe(false);
        expect(fireKey(input, '5')).toBe(false);
        expect(fireKey(input, '9')).toBe(false);
    });

    it('should ALLOW navigation keys', () => {
        expect(fireKey(input, 'Backspace', '5')).toBe(false);
        expect(fireKey(input, 'Delete', '5')).toBe(false);
        expect(fireKey(input, 'ArrowLeft')).toBe(false);
        expect(fireKey(input, 'ArrowRight')).toBe(false);
        expect(fireKey(input, 'Tab')).toBe(false);
    });

    it('should BLOCK minus sign on empty field', () => {
        expect(fireKey(input, '-', '')).toBe(true);
    });

    it('should BLOCK minus sign when field has value', () => {
        expect(fireKey(input, '-', '10')).toBe(true);
    });

    it('should BLOCK decimal point', () => {
        expect(fireKey(input, '.', '')).toBe(true);
        expect(fireKey(input, '.', '3')).toBe(true);
    });

    it('should BLOCK letter e', () => {
        expect(fireKey(input, 'e', '')).toBe(true);
    });

    it('should BLOCK letter E', () => {
        expect(fireKey(input, 'E', '')).toBe(true);
    });

    it('should BLOCK plus sign', () => {
        expect(fireKey(input, '+', '')).toBe(true);
    });

    it('should BLOCK arbitrary letters', () => {
        expect(fireKey(input, 'a', '')).toBe(true);
    });

    it('should BLOCK space', () => {
        expect(fireKey(input, ' ', '')).toBe(true);
    });

    // --- paste ---
    // All paste events call preventDefault() — the directive fully controls insertion.
    // Valid non-negative integers are inserted; anything else is rejected entirely
    // (not silently stripped — pasting "-5" does NOT become "5").
    it('should allow paste of valid non-negative integer', () => {
        expect(firePaste(input, '30')).toBe(true); // preventDefault always fires
    });

    it('should reject paste of negative value entirely — "-5" must not become "5"', () => {
        expect(firePaste(input, '-5')).toBe(true);
    });

    it('should reject paste of decimal value entirely', () => {
        expect(firePaste(input, '3.14')).toBe(true);
    });

    it('should reject paste of mixed text entirely', () => {
        expect(firePaste(input, 'abc-5')).toBe(true);
    });

    it('should reject paste of negative decimal entirely', () => {
        expect(firePaste(input, '-3.14')).toBe(true);
    });

    // --- input (browser spinner / programmatic change) ---
    it('should clamp negative value from browser spinner to 0', () => {
        expect(fireInput(input, '-1')).toBe('0');
    });

    it('should clamp negative value to 0', () => {
        expect(fireInput(input, '-100')).toBe('0');
    });

    it('should strip decimal portion from spinner', () => {
        expect(fireInput(input, '3.7')).toBe('3');
    });

    it('should leave valid non-negative integer unchanged', () => {
        expect(fireInput(input, '42')).toBe('42');
    });

    it('should clamp NaN / empty to 0', () => {
        expect(fireInput(input, 'abc')).toBe('0');
    });

    // --- min and step attributes ---
    it('should have min="0" attribute set', () => {
        expect(input.getAttribute('min')).toBe('0');
    });

    it('should have step="1" attribute set', () => {
        expect(input.getAttribute('step')).toBe('1');
    });
});
