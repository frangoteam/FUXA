import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, Input, Output, EventEmitter, ElementRef } from '@angular/core';

import { NgxUplotComponent } from '../../../../gui-helpers/ngx-uplot/ngx-uplot.component';
import { UplotOptions, Serie, Axis } from '../../../../gui-helpers/ngx-uplot/uplotOptions';
import { DaqQuery } from '../../../../_models/hmi';

@Component({
    selector: 'chart-uplot',
    templateUrl: './chart-uplot.component.html',
    styleUrls: ['./chart-uplot.component.css']
})
export class ChartUplotComponent implements OnInit, AfterViewInit, OnDestroy {

    @ViewChild('chartPanel') public chartPanel: ElementRef;
    @ViewChild('uplot') public uplot: NgxUplotComponent;
    
    @Output() onTimeRange: EventEmitter<DaqQuery> = new EventEmitter();
    
    public id: string;
    public withToolbar = false;
    public options: UplotOptions;
    public isEditor = false;
    public rangeType: any;//ChartRangeType;
    mapData = {};

    constructor() { }

    ngOnInit() {
    }

    ngAfterViewInit() {
        this.resize(300, 400);
    }

    ngOnDestroy() {
        try {
            delete this.chartPanel;
            delete this.uplot;
        } catch (e) {
            console.log(e);
        }
    }

    onClick(a) {

    }

    public resize(height?, width?) {
        let chart = this.chartPanel.nativeElement;
        if (!height && chart.offsetParent) {
            height = chart.offsetParent.clientHeight;
        }
        if (!width && chart.offsetParent) {
            width = chart.offsetParent.clientWidth;
        }
        let w = width;
        let h = height - 80;
        this.uplot.resize(h, w);
    }

    public init(options: UplotOptions = null) {
        this.mapData = {};
        // if (options) {
            this.uplot.init(options);
            this.resize();//options.height, options.width);
        // } 
        // else {
        //     this.uplot.init(<UplotOptions>{ title: 'asdf', id: 'asdf', width: 900, height: 700, scales: { x: { time: false } } });
        //     this.resize();//700, 900);
        // }
    }

    public setRange(startRange) {
    }

    public setOptions(options: UplotOptions) {
        this.options = JSON.parse(JSON.stringify(options));
        this.options.axes = [{ label: 'asdf' }, { label: 'tr' }, 
            { label: 'sasd', side: Axis.Side.Right, grid: { stroke: options.gridLineColor, width: 1 / devicePixelRatio, },
            ticks: { stroke: options.gridLineColor, width: 1 / devicePixelRatio, } } ];
        // this.options.axes = [{ labelFont: options.fontFamily }, { labelFont: options.fontFamily } ];
        this.init(this.options);
    }

    public addLine(id: string, name:string, color: string) {
        if (!this.mapData[id]) {
            this.mapData[id] = { index: Object.keys(this.mapData).length + 1, attribute: <Serie>{ label: name, stroke: color, spanGaps: true } };
            this.uplot.addSerie(this.mapData[id].index, this.mapData[id].attribute);
        }
        if (this.isEditor) {
            this.uplot.setSample();
        }
    }

    public addValue(id: string, x, y) {
        if (this.mapData[id]) {
            this.uplot.addValue(this.mapData[id].index, x, y);
        }
    }

    public setValues(values) {
        this.uplot.setData(values);
    }

    public redraw() {
        this.uplot.redraw();
    }
}
