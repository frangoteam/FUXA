import { Component, OnInit, AfterViewInit, OnChanges, ViewChild, HostListener, ElementRef, Input, SimpleChanges } from '@angular/core';

import { GaugeOptions, GaugeType } from './gaugeOptions';

declare const Gauge: any;
declare const Donut: any;

@Component({
    selector: 'ngx-gauge',
    templateUrl: './ngx-gauge.component.html',
    styleUrls: ['./ngx-gauge.component.css']
})
export class NgxGaugeComponent implements OnInit, AfterViewInit, OnChanges {

    @Input() public id: string;
    @Input() public options: GaugeOptions;
    @Input() public value: any;
    @ViewChild('panel') public panel: ElementRef;
    @ViewChild('gauge') public canvas: ElementRef;
    @ViewChild('gaugetext') public gaugetext: ElementRef;

    gauge: any;
    type = GaugeType.Gauge;
    defOptions = new GaugeOptions();

    constructor() { }

    ngOnInit() {
        this.options = Object.assign(this.defOptions, this.options);
    }

    ngAfterViewInit() {
        setTimeout(() => {
            this.onResize(null);
        }, 500);
    }

    ngOnChanges(changes: SimpleChanges) {
        if (this.gauge) {
            if (changes) {
                if (changes.value) {
                    this.gauge.set(changes.value.currentValue);
                }
            }
        }
    }

    @HostListener('window:resize', ['$event'])
    onResize(event) {
        let canvas = this.canvas.nativeElement;
        let w = canvas.parentNode.clientWidth;
        let h = canvas.parentNode.clientHeight;// - (canvas.parentNode.clientHeight / 4);
        if (w < h) h = w;
        this.canvas.nativeElement.height = h;
        this.canvas.nativeElement.width = w;        
        this.init(this.type);
    }

    resize(height?, width?) {
        this.onResize(null);
    }

    setValue(value) {
        let val = parseFloat(value);
        if (Number.isNaN(val)) {
            // maybe boolean
            val = Number(value);
        } else {
            val = parseFloat(val.toFixed(5));
        }
        this.gauge.set(val);
    }

    setOptions(options: GaugeOptions) {
        this.options = options;
        // if (options.backgroundColor) {
        //     this.panel.nativeElement.style.backgroundColor = options.backgroundColor;
        // }
        this.gauge.animationSpeed = options.animationSpeed;
        this.gauge.minValue = options.minValue;
        this.gauge.maxValue = options.maxValue;
        this.gaugetext.nativeElement.style.fontSize = options.fontSize + 'px';
        if (options.fontFamily) {
            this.gaugetext.nativeElement.style.fontFamily = options.fontFamily;
        }
        if (options.pointer && options.pointer.color) {
            this.gaugetext.nativeElement.style.color = options.pointer.color;
        }
        this.gaugetext.nativeElement.style.top = options.textFilePosition + '%';
        this.gauge.setOptions(options);
        this.gauge.ctx.clearRect(0, 0, this.gauge.ctx.canvas.width, this.gauge.ctx.canvas.height);
        this.gauge.render();
    }

    getOptions() {
        return this.options;
    }

    init(type: GaugeType) {
        this.type = type;
        if (type === GaugeType.Gauge) {
            this.gauge = new Gauge(this.canvas.nativeElement);        
            this.gauge.setTextField(this.gaugetext.nativeElement);
        } else if (type === GaugeType.Zones) {
            this.gauge = new Gauge(this.canvas.nativeElement);        
            this.gauge.setTextField(this.gaugetext.nativeElement);
        } else if (type === GaugeType.Donut) {
            this.gauge = new Donut(this.canvas.nativeElement);        
            this.gauge.setTextField(this.gaugetext.nativeElement);
        }
        this.setOptions(this.options);
        this.gauge.set(this.value);
    }
}
