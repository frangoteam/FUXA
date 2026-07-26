import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, Input } from '@angular/core';

declare const noUiSlider: any;

export class NgxNouisliderOptions {
    orientation = 'vertical';//'horizontal';
    direction = 'ltr';
    fontFamily = 'Sans-serif';
    shape = { baseColor: '#cdcdcd', connectColor: '#262c3b', handleColor: '#3f4964', barWidth: 18, handleWidth: 0, handleHeight: 0 };
    marker = { color: '#222222', subWidth: 5, subHeight: 1, fontSize: 18, divHeight: 2, divWidth: 12 };
    range = { min: 0, max: 100 };
    step = 1;
    pips = { mode: 'values', values: [0, 50, 100], density: 4 };
    tooltip = { type: 'none', decimals: 0, background: '#FFF', color: '#000', fontSize: 12 };
}
@Component({
    selector: 'ngx-nouislider',
    templateUrl: './ngx-nouislider.component.html',
    styleUrls: ['./ngx-nouislider.component.css']
})
export class NgxNouisliderComponent implements OnInit, AfterViewInit, OnDestroy {

    @Input() public id: string;
    @ViewChild('panel', {static: false}) public panel: ElementRef;
    @ViewChild('slider', {static: false}) public slider: ElementRef;
    @Input() public options: NgxNouisliderOptions;

    size = { w: 0, h: 0 };
    padding = 40;
    defOptions = new NgxNouisliderOptions();
    uiSlider: any;
    onUpdate: any;
    uiWorking = false;
    uiWorkingTimeout: any;

    constructor() { }

    ngOnInit() {
        this.options = Object.assign(this.defOptions, this.options);
        this.options.shape = Object.assign({}, this.defOptions.shape, this.options.shape);
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
        options = Object.assign({}, this.defOptions, options);
        options.shape = Object.assign({}, this.defOptions.shape, options.shape);
        let toInit = false;
        if (this.options.orientation !== options.orientation || JSON.stringify(this.options.range) !== JSON.stringify(options.range) ||
            JSON.stringify(this.options.pips) !== JSON.stringify(options.pips) || JSON.stringify(this.options.shape) !== JSON.stringify(options.shape) ||
            JSON.stringify(this.options.marker) !== JSON.stringify(options.marker) ||
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
            this.slider.nativeElement.style.height = this.size.h + 'px';
            this.slider.nativeElement.style.width = this.getBarWidth() + 'px';
        } else {
            this.slider.nativeElement.style.width = this.size.w + 'px';
            this.slider.nativeElement.style.height = this.getBarWidth() + 'px';
        }
        let tooltip: any[] = [false];
        if (this.options.tooltip.type === 'hide' || this.options.tooltip.type === 'show') {
            tooltip = [{
                to: (value: number) => Number(value).toFixed(this.options.tooltip.decimals),
                from: Number
            }];
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
        this.applyShapeSize();
        // tooltip
        if (this.options.tooltip.type === 'show') {
            var tp = this.uiSlider.target.getElementsByClassName('noUi-tooltip');
            if (tp && tp.length > 0)
                {tp[0].style.display = 'block';}
        } else if (this.options.tooltip.type === 'hide') {
            var tp = this.uiSlider.target.getElementsByClassName('noUi-active noUi-tooltip');
            if (tp && tp.length > 0)
                {tp[0].style.display = 'block';}
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
        this.uiSlider.on('slide', function(values, handle) {
            if (self.onUpdate) {
                self.resetWorkingTimeout();
                self.onUpdate(values[handle]);
            }
        });
    }

    getBarWidth(): number {
        const width = Number(this.options?.shape?.barWidth);
        return Number.isFinite(width) && width > 0 ? width : this.defOptions.shape.barWidth;
    }

    getHandleWidth(): number {
        const width = Number(this.options?.shape?.handleWidth);
        const defaultWidth = this.options.orientation === 'vertical' ? 28 : 34;
        return Number.isFinite(width) && width > 0 ? width : defaultWidth;
    }

    getHandleHeight(): number {
        const height = Number(this.options?.shape?.handleHeight);
        const defaultHeight = this.options.orientation === 'vertical' ? 34 : 28;
        return Number.isFinite(height) && height > 0 ? height : defaultHeight;
    }

    applyShapeSize() {
        const barWidth = this.getBarWidth();
        const handleWidth = this.getHandleWidth();
        const handleHeight = this.getHandleHeight();
        const target = this.slider.nativeElement;
        const handles = target.getElementsByClassName('noUi-handle');

        if (this.options.orientation === 'vertical') {
            target.style.width = barWidth + 'px';
            Array.from(handles).forEach((handle: HTMLElement) => {
                handle.style.width = handleWidth + 'px';
                handle.style.height = handleHeight + 'px';
                handle.style.right = ((barWidth - handleWidth) / 2) + 'px';
                handle.style.bottom = (-handleHeight / 2) + 'px';
            });
        } else {
            target.style.height = barWidth + 'px';
            Array.from(handles).forEach((handle: HTMLElement) => {
                handle.style.width = handleWidth + 'px';
                handle.style.height = handleHeight + 'px';
                handle.style.right = (-handleWidth / 2) + 'px';
                handle.style.top = ((barWidth - handleHeight) / 2) + 'px';
            });
        }
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
