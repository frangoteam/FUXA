import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, HostListener, ElementRef, Input } from '@angular/core';

declare const noUiSlider: any;
declare const wNumb: any;

@Component({
    selector: 'ngx-nouislider',
    templateUrl: './ngx-nouislider.component.html',
    styleUrls: ['./ngx-nouislider.component.css']
})
export class NgxNouisliderComponent implements OnInit, AfterViewInit, OnDestroy {

    @Input() public id: string;
    @ViewChild('panel') public panel: ElementRef;
    @ViewChild('slider') public slider: ElementRef;
    @Input() public options: NgxNouisliderOptions;

    size = { w: 0, h: 0 };
	//alt boşluk
    padding = 20;
    defOptions = new NgxNouisliderOptions();
    uiSlider: any;
    onUpdate: any;
    uiWorking = false;
    uiWorkingTimeout: any;

    constructor() { }

    ngOnInit() {
        this.options = Object.assign(this.defOptions, this.options);
    }

    ngAfterViewInit() {
        setTimeout(() => {
            this.init();
        }, 200);
    }

    resize(height?, width?) {
        this.size.h = height - (2 * this.padding);
        this.size.w = width - (2 * this.padding);
        this.init();
    }

    ngOnDestroy() {
        try {
            this.slider.nativeElement.remove();
            this.panel.nativeElement.remove();
            if (this.uiWorkingTimeout) {
                clearTimeout(this.uiWorkingTimeout);
            }
            if (this.uiSlider) {
                this.uiSlider.off();
                this.uiSlider.destroy();
                delete this.uiSlider;
                delete this.onUpdate;
            }
        } catch (e) {
        }
    }

    setOptions(options: any): boolean {
        let toInit = false;
        if (this.options.orientation !== options.orientation || JSON.stringify(this.options.range) !== JSON.stringify(options.range) || 
            JSON.stringify(this.options.pips) !== JSON.stringify(options.pips) || JSON.stringify(this.options.marker) !== JSON.stringify(options.marker) ||
            JSON.stringify(this.options.tooltip) !== JSON.stringify(options.tooltip)) {
            toInit = true;
        }
        if (options.fontFamily) {
            this.panel.nativeElement.style.fontFamily = options.fontFamily;
        }
        this.options = options;
        if (toInit) {
            this.init();
            return true;
        }
        return false;
    }

    getOptions() {
        return this.options;
    }

    init() {
        if (this.options.orientation === 'vertical') {
            this.slider.nativeElement.style.height = this.size.h + "px";
            this.slider.nativeElement.style.width =  null;
        } else {
            this.slider.nativeElement.style.width = this.size.w + "px";
            this.slider.nativeElement.style.height =  null;
        }
        let tooltip = [false];
        if (this.options.tooltip.type === 'hide' || this.options.tooltip.type === 'show') {
            tooltip =  [wNumb({decimals: this.options.tooltip.decimals})];
        }
        if (this.uiSlider) {
            this.uiSlider.off();
            this.uiSlider.destroy();
        }
        this.uiSlider = noUiSlider.create(this.slider.nativeElement, {
            start: [this.options.range.min + Math.abs(this.options.range.max - this.options.range.min) / 2],
            connect: [true, false],
            orientation: this.options.orientation,
            direction: this.options.direction,
            tooltips: tooltip,
            range: this.options.range,
            step: this.options.step,
            pips: {
                mode: 'values',
                values: this.options.pips.values,
                density: this.options.pips.density,
            },
            shape: this.options.shape,
            marker: this.options.marker,

        });
        // tooltip
        if (this.options.tooltip.type === 'show') {
            var tp = this.uiSlider.target.getElementsByClassName('noUi-tooltip');
            if (tp && tp.length > 0)
                tp[0].style.display = 'inline';
        } else if (this.options.tooltip.type === 'hide') {
            var tp = this.uiSlider.target.getElementsByClassName('noUi-active noUi-tooltip');
            if (tp && tp.length > 0)
                tp[0].style.display = 'inline';
        }
        if (this.options.tooltip.type !== 'none') {
            var tp = this.uiSlider.target.getElementsByClassName('noUi-tooltip');
            if (tp && tp.length > 0) {
                tp[0].style.color = this.options.tooltip.color;
                tp[0].style.background = this.options.tooltip.background;
                tp[0].style.fontSize = this.options.tooltip.fontSize + 'px';
            }    
        }

		let self = this;
        this.uiSlider.on('slide', function (values, handle) {
            if (self.onUpdate) {
                self.resetWorkingTimeout();
                self.onUpdate(values[handle]);
            }
        });
    }

    resetWorkingTimeout()
    {
        this.uiWorking = true;
        if (this.uiWorkingTimeout) {
            clearTimeout(this.uiWorkingTimeout);
        }
		let self = this;
        this.uiWorkingTimeout = setTimeout(function() {
            self.uiWorking = false;
        }, 1000);
    }

    setValue(value: number) {
        if (!this.uiWorking) {
            this.uiSlider.set(value);
        }
    }

    bindUpdate(calback: any) {
        this.onUpdate = calback;
    }

    currentValue() {
        return parseFloat(this.uiSlider.get());
    }

}

export class NgxNouisliderOptions {
    orientation = 'vertical';//'horizontal';
    direction = 'rtl';
    fontFamily = 'Sans-serif';
    shape = { baseColor: '#dcdcdc', connectColor: '#49b2ff', handleColor: '#018ef5' };
    marker = { color: '#000', subWidth: 5, subHeight: 1, fontSize: 12, divHeight: 2, divWidth: 10 };
    range = { min: 0, max: 100 };
    step = 1;
    pips = { mode: 'values', values: [0, 50, 100], density: 5 };
    tooltip = { type: 'hide', decimals: 0, background: '#FFF', color: '#000', fontSize: 12 }
}