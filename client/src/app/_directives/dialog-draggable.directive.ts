import { Directive, HostListener, AfterViewInit } from '@angular/core';
import { MatDialogContainer as MatDialogContainer, MatDialogRef as MatDialogRef } from '@angular/material/dialog';
import { fromEvent } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Position } from './modal-position.cache';

@Directive({
    selector: '[mat-dialog-draggable]'
})
export class DialogDraggableDirective implements AfterViewInit {

    // private _subscription: Subscription;

    mouseStart: Position;

    mouseDelta: Position;

    offset: Position;

    constructor(
        private matDialogRef: MatDialogRef<any>,
        private container: MatDialogContainer,
        // private positionCache: ModalPositionCache
    ) { }

    ngAfterViewInit() {
        const dialogType = this.matDialogRef.componentInstance.constructor;
        // const cachedValue = this.positionCache.get(dialogType);
        this.offset = this._getOffset();
        // this._updatePosition(this.offset.y, this.offset.x);

        // this.matDialogRef.beforeClose().pipe(take(1))
        //   .subscribe(() => this.positionCache.set(dialogType, this.offset));
    }

    @HostListener('mousedown', ['$event'])
    onMouseDown(event: MouseEvent) {
        this.offset = this._getOffset();
        this.mouseStart = { x: event.pageX, y: event.pageY };

        const mouseup$ = fromEvent(document, 'mouseup');
        // this._subscription = mouseup$.subscribe(() => this.onMouseup());

        const mousemove$ = fromEvent(document, 'mousemove')
            .pipe(takeUntil(mouseup$))
            .subscribe((e: MouseEvent) => this.onMouseMove(e));

        // this._subscription.add(mousemove$);
    }

    onMouseMove(event: MouseEvent) {
        this.mouseDelta = { x: (event.pageX - this.mouseStart.x), y: (event.pageY - this.mouseStart.y) };

        this._updatePosition(this.offset.y + this.mouseDelta.y, this.offset.x + this.mouseDelta.x);
    }

    onMouseup() {
        // if (this._subscription) {
        //   this._subscription.unsubscribe();
        //   this._subscription = undefined;
        // }
        if (this.mouseDelta) {
            this.offset.x += this.mouseDelta.x;
            this.offset.y += this.mouseDelta.y;
        }
    }

    private _updatePosition(top: number, left: number) {
        this.matDialogRef.updatePosition({
            top: top + 'px',
            left: left + 'px'
        });
    }

    private _getOffset(): Position {
        const box = this.container['_elementRef'].nativeElement.getBoundingClientRect();
        return {
            x: box.left + pageXOffset,
            y: box.top + pageYOffset
        };
    }
}
