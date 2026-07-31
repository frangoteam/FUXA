import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
    selector: '[numberOnly]'
})
export class NumberOnlyDirective {
    // Allow key codes for special events. Reflect :
    // Backspace, tab, end, home
    private specialKeys: Array<string> = ['Backspace', 'Delete', 'Tab', 'End', 'Home', 'ArrowLeft', 'ArrowRight'];

    constructor(private el: ElementRef) {
    }

    @HostListener('keydown', ['$event'])
    onKeyDown(event: KeyboardEvent) {
        // Allow Backspace, tab, end, and home keys
        if (this.specialKeys.indexOf(event.key) !== -1) {
            event.stopPropagation();
            return;
        }
    }
}

@Directive({
    selector: '[numberOrNullOnly]'
})
export class NumberOrNullOnlyDirective {
    // Allow decimal numbers and negative values
    private regex = new RegExp(/^-?[0-9]+(\.[0-9]*){0,1}$/g);///^-?[0-9]+(\.[0-9]*){0,1}$/g);
    // Allow key codes for special events. Reflect :
    // Backspace, tab, end, home
    private specialKeys: Array<string> = ['Backspace', 'Delete', 'Tab', 'End', 'Home', 'ArrowLeft', 'ArrowRight'];

    constructor(private el: ElementRef) {
    }
    @HostListener('keydown', ['$event'])
    onKeyDown(event: KeyboardEvent) {
        // Allow Backspace, tab, end, and home keys
        if (this.specialKeys.indexOf(event.key) !== -1) {
            event.stopPropagation();
            return;
        }
        let current: string = this.el.nativeElement.value;
        let next = '';
        if (event.key === '-') {
            event.preventDefault();
            if (!current.startsWith('-')) {
                next = event.key + current;
                this.el.nativeElement.value = next;
            }
        } else {
            next = current.concat(event.key);
        }
        if (next && !String(next).match(this.regex)) {
            event.preventDefault();
        }
        event.stopPropagation();
    }
}

/**
 * Directive for fields that must only accept non-negative integers.
 * Use this instead of [numberOnly] when negative values and decimals
 * must be explicitly blocked (e.g. alarm time delay fields).
 * Unlike [numberOnly], this directive does NOT modify shared behaviour —
 * it is a dedicated, self-contained directive for strict positive-integer-only inputs.
 *
 * Handles three entry vectors:
 *   - keydown : blocks -, ., e, E, + and all non-digit keys
 *   - paste   : rejects pasted content entirely if it is not a non-negative integer
 *   - input   : clamps the value to a non-negative integer after browser spinner changes
 */
@Directive({
    selector: '[nonNegativeIntegerOnly]'
})
export class NonNegativeIntegerOnlyDirective {
    // Allow only whole non-negative integers: digits 0-9
    private regex = new RegExp(/^[0-9]+$/g);
    private specialKeys: Array<string> = ['Backspace', 'Delete', 'Tab', 'End', 'Home', 'ArrowLeft', 'ArrowRight'];

    constructor(private el: ElementRef) {
    }

    @HostListener('keydown', ['$event'])
    onKeyDown(event: KeyboardEvent) {
        // Always allow navigation/editing keys
        if (this.specialKeys.indexOf(event.key) !== -1) {
            event.stopPropagation();
            return;
        }
        // Block minus, decimal point, 'e', E, + and all non-digit characters
        const current: string = this.el.nativeElement.value;
        const next: string = current.concat(event.key);
        if (next && !String(next).match(this.regex)) {
            event.preventDefault();
        }
    }

    @HostListener('paste', ['$event'])
    onPaste(event: ClipboardEvent) {
        event.preventDefault();
        const pasted = event.clipboardData?.getData('text') ?? '';
        // Reject the paste entirely if the value is not a non-negative integer.
        // We do not silently strip characters (e.g. pasting "-5" should not
        // become "5") — invalid input is discarded as a whole.
        if (/^[0-9]+$/.test(pasted)) {
            const input = this.el.nativeElement as HTMLInputElement;
            // type="number" inputs do not support selectionStart/selectionEnd in all
            // environments — fall back to appending to the full value safely.
            try {
                const start = input.selectionStart ?? input.value.length;
                const end = input.selectionEnd ?? input.value.length;
                input.value = input.value.slice(0, start) + pasted + input.value.slice(end);
                input.selectionStart = input.selectionEnd = start + pasted.length;
            } catch {
                input.value = input.value + pasted;
            }
        }
    }

    @HostListener('input', ['$event'])
    onInput(event: Event) {
        const input = this.el.nativeElement as HTMLInputElement;
        const raw = input.value;
        // Guard against browser spinner producing negative or decimal values
        const parsed = parseInt(raw, 10);
        if (isNaN(parsed) || parsed < 0) {
            input.value = '0';
        } else if (raw !== String(parsed)) {
            // Strip any decimal portion the browser may have inserted
            input.value = String(parsed);
        }
    }
}
