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
