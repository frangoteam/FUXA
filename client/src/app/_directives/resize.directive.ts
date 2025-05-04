import { Directive, HostListener, Input, Output, EventEmitter, ElementRef, OnDestroy } from '@angular/core';

@Directive({
    selector: '[appResize]'
})
export class ResizeDirective implements OnDestroy {
    private oldY = 0;
    private isGrabbing = false;
    private resizeZoneHeight = 6;

    @Input() height: number;
    @Output() heightChange = new EventEmitter<number>();
    @Output() changeEnd = new EventEmitter<void>();

    constructor(private el: ElementRef) { }

    @HostListener('mousemove', ['$event'])
    onMouseMove(event: MouseEvent) {
        if (!this.isGrabbing) {
            const bounds = this.el.nativeElement.getBoundingClientRect();
            const offsetY = event.clientY - bounds.top;
            this.el.nativeElement.style.cursor = offsetY >= bounds.height - this.resizeZoneHeight ? 'ns-resize' : 'default';
            return;
        }
    }

    @HostListener('mousedown', ['$event'])
    onMouseDown(event: MouseEvent) {
        const bounds = this.el.nativeElement.getBoundingClientRect();
        const offsetY = event.clientY - bounds.top;

        if (offsetY >= bounds.height - this.resizeZoneHeight) {
            this.isGrabbing = true;
            this.oldY = event.clientY;

            // attach to window so we don't lose tracking
            window.addEventListener('mousemove', this.resizeHandler);
            window.addEventListener('mouseup', this.releaseHandler);

            event.preventDefault();
        }
    }

    private resizeHandler = (event: MouseEvent) => {
        if (!this.isGrabbing) {
            return;
        }
        this.height += (event.clientY - this.oldY);
        this.height = Math.max(50, this.height);
        this.heightChange.emit(this.height);
        this.oldY = event.clientY;
    };

    private releaseHandler = () => {
        if (this.isGrabbing) {
            this.isGrabbing = false;
            this.changeEnd.emit();
            window.removeEventListener('mousemove', this.resizeHandler);
            window.removeEventListener('mouseup', this.releaseHandler);
        }
    };

    ngOnDestroy() {
        window.removeEventListener('mousemove', this.resizeHandler);
        window.removeEventListener('mouseup', this.releaseHandler);
    }
}
