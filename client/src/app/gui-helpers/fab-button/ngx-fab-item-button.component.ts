import {
    Component,
    Input,
    Output,
    EventEmitter,
    ViewChild,
    ChangeDetectionStrategy
} from '@angular/core';

@Component({
    selector: 'ngx-fab-item-button',
    styles: [`
  .item {
    /* width:40px; */
    height: 36px;
    left: 3px;
    /* left: -3px; */
    transform: translate3d(0, 0, 0);
    transition: transform, opacity ease-out 200ms;
    transition-timing-function: cubic-bezier(0.165, 0.84, 0.44, 1);
    transition-duration: 180ms;
    position: absolute;
    cursor: pointer;
    top:5px;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    z-index: 9999;
  }
  .item.disabled {
    pointer-events: none;
  }
  .item.disabled .fab-item {
    background-color: lightgray;
  }
  .content {
    z-index: 9999;
    background: rgba(68,138,255, 1);
    margin-left: 0px;
    line-height: 25px;
    color: white;
    /* text-transform: lowercase; */
    padding: 5px 20px 3px 20px;
    border-top-right-radius: 18px;
    border-bottom-right-radius: 18px;
    border-bottom-left-radius: 18px;
    border-top-left-radius: 18px;
    display: none;
    font-size: 13px;
    height: 28px;
    /* margin-top: 4px; */
    box-shadow: 0 2px 5px 0 rgba(0,0,0,.26);
    white-space:nowrap;
  }
  .fab-item {
    left: 0;
    background: rgba(68,138,255, 1);
    border-radius: 100%;
    width: 36px;
    height: 36px;
    position: absolute;
    color: white;
    text-align: center;
    cursor: pointer;
    line-height: 50px;
    /* box-shadow: 0 2px 5px 0 rgba(0,0,0,.26); */
  }
  .fab-item-ex {
    top: 0;
    background: rgba(68,138,255, 1);
    border-radius: 100%;
    width: 36px;
    height: 36px;
    position: absolute;
    color: white;
    text-align: center;
    cursor: pointer;
    line-height: 45px;
    /* box-shadow: 0 2px 5px 0 rgba(0,0,0,.26); */
  }
  .fab-item img {
    padding-bottom: 2px;
    padding-left: 5px;
  }
  `],
    template: `
    <div #elementref class="item {{ disabled ? 'disabled' : ''}}"
    (click)="emitClickEvent($event)">
        <a class="fab-item" [style.backgroundColor]="color">
          <img *ngIf="svgicon" src="{{svgicon}}"/>
          <i class="material-icons" *ngIf="!svgicon"> {{ icon }} </i>
        </a>
        <div class="content-wrapper" #contentref>
          <div class="content" [style.display]="content ? 'block' : 'none'" [style.padding-right]="iconex ? '28px' : '20px'">{{content}}
            <a class="fab-item-ex" [style.backgroundColor]="color" *ngIf="iconex" (click)="stopPropagation($event);emitClickExEvent($event)">
                <i class="material-icons" style="font-size: 18px"> {{ iconex }} </i>
            </a>
          </div>
        </div>
    </div>
  `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class NgxFabItemButtonComponent {
    @Input() icon: string;
    @Input() svgicon: string;
    @Input() iconex: string;
    @Input() svgiconex: string;
    @Input() content: string;
    @Input() color = 'white';
    @Output() clicked: EventEmitter<any> = new EventEmitter();
    @Output() exclicked: EventEmitter<any> = new EventEmitter();
    @Input() disabled = false;
    @ViewChild('elementref', {static: true}) elementref;
    @ViewChild('contentref', {static: true}) contentref;

    emitClickEvent($event: Event) {
        if (this.disabled) {
            return this.disabled;
        }
        this.clicked.emit($event);
    }
    emitClickExEvent($event: Event) {
        if (this.disabled) {
            return this.disabled;
        }
        this.exclicked.emit($event);
    }

    public stopPropagation($event: Event) {
        $event.stopPropagation();
    }
}
