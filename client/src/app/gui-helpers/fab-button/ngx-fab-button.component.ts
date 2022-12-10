import { Subject, Subscription, BehaviorSubject } from 'rxjs';
import { NgxFabItemButtonComponent } from './ngx-fab-item-button.component';
import {
    Component,
    Input,
    ContentChildren,
    ElementRef,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    AfterContentInit,
    OnDestroy,
    Output,
    OnChanges
} from '@angular/core';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'ngx-fab-button',
    styles: [`
  :host {
    position: absolute;
  }
  .fab-menu {
      box-sizing: border-box;
      font-size: 12px;
      width:40px;
      height: 40px;
      text-align: left;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 9;
  }
  .fab-toggle {
    border-radius: 100%;
    width: 36px;
    height: 36px;
    color: white;
    text-align: center;
    line-height: 50px;
    transform: translate3d(0, 0, 0);
    transition: all ease-out 200ms;
    z-index: 2;
    transition-timing-function: cubic-bezier(0.175, 0.885, 0.32, 1.275);
    transition-duration: 400ms;
    transform: scale(1, 1) translate3d(0, 0, 0);
    cursor: pointer;
    box-shadow: 0 2px 5px 0 rgba(0,0,0,.26);
  }
  .fab-menu .fab-toggle:hover {
    transform: scale(1.2, 1.2) translate3d(0, 0, 0);
  }
  .fab-menu ::ng-deep .item {
     opacity: 0;
  }
  .fab-menu.active ::ng-deep .item {
     opacity: 1;
  }
  .fab-menu.active ::ng-deep .content-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .fab-menu.active ::ng-deep .content {
    display: block;
  }
  .fab-menu.active .fab-toggle {
    transition-timing-function: linear;
    transition-duration: 200ms;
    transform: scale(1, 1) translate3d(0, 0, 0);
  }
  `],
    template: `
    <div class="fab-menu" [class.active]="(state | async).display">
        <a class="fab-toggle" (click)="toggle()" (touchend)="toggle()" [style.backgroundColor]="color">
          <i class="material-icons" *ngIf="!opened"> {{icon}} </i>
          <i class="material-icons" *ngIf="opened"> {{iconOpen}} </i>
        </a>
        <ng-content></ng-content>
    </div>
  `
})

export class NgxFabButtonComponent implements AfterContentInit, OnDestroy, OnChanges {
    private elementref: HTMLElement;
    private subs: Subscription[] = [];
    public state: BehaviorSubject<any>;

    @Input() icon: string;
    @Input() iconOpen: string;
    @Input() direction: string;
    @Input() spaceBetweenButtons = 45;
    @Input() open: Subject<boolean>;
    @Input() color = '#dd0031';
    @Input() disabled = false;
    @Output() events: Subject<any> = new Subject();
    @Output() opened = false;
    @ContentChildren(NgxFabItemButtonComponent) buttons;

    constructor(private element: ElementRef, private cd: ChangeDetectorRef) {
        this.elementref = element.nativeElement;

        this.state = new BehaviorSubject({
            display: false,
            direction: 'top',
            event: 'start',
            spaceBetweenButtons: this.spaceBetweenButtons
        });
    }

    public toggle() {
        if (this.disabled) {
            return this.disabled;
        }
        this.state.next({
            ...this.state.getValue(),
            display: !this.state.getValue().display,
            event: !this.state.getValue().display ? 'open' : 'close'
        });
        this.opened = this.state.getValue().display;
    }

    // only top and bottom support content element
    private checkDirectionType() {
        if (this.buttons.toArray()) {
            let display = 'block';

            if (this.direction === 'right' || this.direction === 'left') {
                display = 'none';
            }

            this.buttons.toArray().forEach(element => {
                element.contentref.nativeElement.style.display = display;
            });
        }
    }

    // transition
    private animateButtons(eventType) {
        this.buttons.toArray().forEach((btn, i) => {
            i += 1;
            if (btn.elementref) {
                const style = btn.elementref.nativeElement.style;

                if (eventType !== 'directionChanged' && this.state.getValue().display) {
                    style['transform'] = 'scale(1)';
                    style['transition-duration'] = '0s';

                    if (btn.timeout) {
                        clearTimeout(btn.timeout);
                    }
                }

                setTimeout(() => {
                    style['transition-duration'] = this.state.getValue().display ? `${90 + (100 * i)}ms` : '';
                    style['transform'] = this.state.getValue().display ? this.getTranslate(i) : '';
                }, 50);

                if (eventType !== 'directionChanged' && !this.state.getValue().display) {
                    btn.timeout = setTimeout(() => {
                        style['transform'] = 'scale(0)';
                    }, 90 + (100 * i));
                }
            }
        });
    }

    // get transition direction
    private getTranslate(i) {

        let animation;

        switch (this.direction) {
            case 'right':
                animation = `translate3d(${this.state.getValue().spaceBetweenButtons * i}px,0,0)`;
                break;
            case 'bottom':
                animation = `translate3d(0,${this.state.getValue().spaceBetweenButtons * i}px,0)`;
                break;
            case 'left':
                animation = `translate3d(-${this.state.getValue().spaceBetweenButtons * i}px,0,0)`;
                break;
            default:
                animation = `translate3d(0,-${this.state.getValue().spaceBetweenButtons * i}px,0)`;
                break;
        }

        return animation;
    }

    ngAfterContentInit() {
        if (this.direction) {
            // first time to check
            this.checkDirectionType();
        }

        const sub = this.state.subscribe(v => {
            this.animateButtons(v.event);

            this.events.next({
                display: v.display,
                event: v.event,
                direction: v.direction
            });
        });
        this.subs.push(sub);
    }

    // if @Input values changes, we need check the direction type
    ngOnChanges(changes) {
        if (changes.direction && !changes.direction.firstChange) {
            this.state.next({
                ...this.state.getValue(),
                event: 'directionChanged',
                direction: changes.direction.currentValue
            });
            // if changes happens
            this.checkDirectionType();
        }

        if (changes.open && changes.open.currentValue) {
            const sub = this.open.subscribe(v => {
                if (v !== this.state.getValue().display) {
                    this.state.next({
                        ...this.state.getValue(),
                        event: v ? 'open' : 'close',
                        display: v
                    });

                    // make angular happy
                    this.cd.markForCheck();
                }
            });

            this.subs.push(sub);
        }

        if (changes.spaceBetweenButtons && changes.spaceBetweenButtons.currentValue) {
            this.state.next({
                ...this.state.getValue(),
                event: 'spaceBetweenButtonsChanged',
                spaceBetweenButtons: changes.spaceBetweenButtons.currentValue
            });
        }
    }

    ngOnDestroy() {
        this.subs.forEach(v => {
            v.unsubscribe();
        });
    }
}
