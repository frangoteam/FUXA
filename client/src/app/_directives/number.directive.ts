import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
    selector: '[numberOnly]'
})
export class NumberOnlyDirective {
    // Allow only non-negative integers: digits 0-9
    private regex = new RegExp(/^[0-9]+$/g);
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
        // Prevent any key that is not a digit (blocks '-', '.', 'e', letters, etc.)
        const current: string = this.el.nativeElement.value;
        const next: string = current.concat(event.key);
        if (next && !String(next).match(this.regex)) {
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
