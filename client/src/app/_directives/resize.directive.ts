import { Directive, HostListener, Input, Output, EventEmitter } from '@angular/core';

@Directive({
    selector: '[appResize]'
})
export class ResizeDirective {
    oldY = 0;
    isGrabbing = false;

    @Input() height: number;
    @Output() heightChange = new EventEmitter<number>();
    @Output() changeEnd = new EventEmitter<void>();

    @HostListener('mousemove', ['$event'])
    onMouseMove(event: MouseEvent) {
        if (!this.isGrabbing) {
            return;
        }
        this.height += (event.clientY - this.oldY);
        this.heightChange.emit(this.height);
        this.oldY = event.clientY;
    }

    @HostListener('mouseup', ['$event'])
    onMouseUp(event: MouseEvent) {
        this.isGrabbing = false;
        this.changeEnd.emit();
    }

    @HostListener('mousedown', ['$event'])
    onMouseDown(event: MouseEvent) {
        this.isGrabbing = true;
        this.oldY = event.clientY;
    }

    @HostListener('mouseleave', ['$event'])
    onMouseLeave(event: MouseEvent) {
        this.isGrabbing = false;
        this.changeEnd.emit();
    }
}

export interface Edges {
    top?: boolean;
    bottom?: boolean;
    left?: boolean;
    right?: boolean;
    [key: string]: boolean | number | undefined;
}
