import { Directive, ElementRef, HostListener, Input } from '@angular/core';

@Directive({
    selector: '[numberOnly]'
})
export class NumberOnlyDirective {
    /**
     * When false, the minus sign is blocked so users cannot enter negative values.
     * Defaults to true to preserve the existing permissive behaviour across all current usages.
     * Set to false on fields where only non-negative integers are valid (e.g. time delay).
     */
    @Input() allowNegative = true;
    /**
     * When false, the decimal point is blocked so users cannot enter fractional values.
     * Defaults to true to preserve the existing permissive behaviour across all current usages.
     * Set to false on fields where only whole numbers are valid (e.g. time delay).
     */
    @Input() allowDecimal = true;

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

        const current: string = this.el.nativeElement.value;

        // Handle minus sign
        if (event.key === '-') {
            if (this.allowNegative && !current.startsWith('-')) {
                return;
            }
            event.preventDefault();
            return;
        }

        // Handle decimal point
        if (event.key === '.') {
            if (this.allowDecimal && !current.includes('.')) {
                return;
            }
            event.preventDefault();
            return;
        }

        // Block anything that is not a digit
        if (!/^[0-9]$/.test(event.key)) {
            event.preventDefault();
        }
    }
}

@Directive({
    selector: '[numberOrNullOnly]'
})
export class NumberOrNullOnlyDirective {
    // Allow decimal numbers and negative values
    private regex = new RegExp(/^-?[0-9]+(\.[0-9]*){0,1}$/g);
    private specialKeys: Array<string> = ['Backspace', 'Delete', 'Tab', 'End', 'Home', 'ArrowLeft', 'ArrowRight'];

    constructor(private el: ElementRef) {
    }
    @HostListener('keydown', ['$event'])
    onKeyDown(event: KeyboardEvent) {
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
