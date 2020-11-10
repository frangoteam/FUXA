import { Directive, HostListener, OnInit, AfterViewInit } from '@angular/core';
import { MatDialogContainer, MatDialogRef } from '@angular/material';
import { Subscription, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators/takeUntil';
import 'rxjs/add/observable/fromEvent';
import { take } from 'rxjs/operators/take';
import { ModalPositionCache, Position } from './modal-position.cache';

@Directive({
  selector: '[mat-dialog-draggable]'
})
export class DialogDraggableDirective implements OnInit, AfterViewInit {

  // private _subscription: Subscription;

  mouseStart: Position;

  mouseDelta: Position;

  offset: Position;

   constructor(
    private matDialogRef: MatDialogRef<any>,
    private container: MatDialogContainer,
    // private positionCache: ModalPositionCache
  ) {}

  ngOnInit() {
  }

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
    this.mouseStart = {x: event.pageX, y: event.pageY};

    const mouseup$ = Observable.fromEvent(document, 'mouseup');
    // this._subscription = mouseup$.subscribe(() => this.onMouseup());

    const mousemove$ = Observable.fromEvent(document, 'mousemove')
      .pipe(takeUntil(mouseup$))
      .subscribe((e: MouseEvent) => this.onMouseMove(e));

    // this._subscription.add(mousemove$);
  }

  onMouseMove(event: MouseEvent) {
      this.mouseDelta = {x: (event.pageX - this.mouseStart.x), y: (event.pageY - this.mouseStart.y)};

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
