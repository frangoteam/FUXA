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

    it('should BLOCK minus sign — core fix for #1865', () => {
        expect(fireKey(input, '-', '')).toBe(true);
        expect(fireKey(input, '-', '10')).toBe(true);
    });

    it('should BLOCK decimal point', () => {
        expect(fireKey(input, '.', '')).toBe(true);
        expect(fireKey(input, '.', '3')).toBe(true);
    });

    it('should BLOCK letter e and E', () => {
        expect(fireKey(input, 'e', '')).toBe(true);
        expect(fireKey(input, 'E', '')).toBe(true);
    });

    it('should BLOCK plus sign, letters and space', () => {
        expect(fireKey(input, '+', '')).toBe(true);
        expect(fireKey(input, 'a', '')).toBe(true);
        expect(fireKey(input, ' ', '')).toBe(true);
    });

    // --- paste ---
    it('should prevent default on all paste events', () => {
        expect(firePaste(input, '30')).toBe(true);
        expect(firePaste(input, '-5')).toBe(true);
        expect(firePaste(input, '3.14')).toBe(true);
    });

    it('should reject paste of negative value entirely — "-5" must not become "5"', () => {
        input.value = '';
        firePaste(input, '-5');
        expect(input.value).toBe('');
    });

    it('should reject paste of decimal value entirely', () => {
        input.value = '';
        firePaste(input, '3.14');
        expect(input.value).toBe('');
    });

    it('should reject paste of mixed text entirely', () => {
        input.value = '';
        firePaste(input, 'abc-5');
        expect(input.value).toBe('');
    });

    // --- input (browser spinner) ---
    it('should clamp negative spinner value to 0', () => {
        expect(fireInput(input, '-1')).toBe('0');
        expect(fireInput(input, '-100')).toBe('0');
    });

    it('should strip decimal from spinner', () => {
        expect(fireInput(input, '3.7')).toBe('3');
    });

    it('should leave valid non-negative integer unchanged', () => {
        expect(fireInput(input, '42')).toBe('42');
    });

    it('should clamp NaN to 0', () => {
        expect(fireInput(input, 'abc')).toBe('0');
    });

    // --- attributes ---
    it('should have min="0" and step="1" attributes', () => {
        expect(input.getAttribute('min')).toBe('0');
        expect(input.getAttribute('step')).toBe('1');
    });
});
