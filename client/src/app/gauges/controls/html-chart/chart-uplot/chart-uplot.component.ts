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
    public options: ChartOptions;
    public isEditor = false;
    public rangeType: any;//ChartRangeType;
    mapData = {};

    constructor() { }

    ngOnInit() {
    }

    ngAfterViewInit() {
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

    public resize(height?: number, width?: number) {
        let chart = this.chartPanel.nativeElement;
        if (!height && chart.offsetParent) {
            height = chart.offsetParent.clientHeight;
        }
        if (!width && chart.offsetParent) {
            width = chart.offsetParent.clientWidth;
        }
        if (height && width) {
            this.options.panel.width = width;
            this.options.width = width;
            this.options.panel.height = height;
            this.options.height = height - 80;
            this.uplot.resize(this.options.height, this.options.width);
        }
    }

    public init(options: ChartOptions = null) {
        this.mapData = {};
        if (options) {
            this.options = options;
            if (this.options.panel) {
                this.resize(this.options.panel.height, this.options.panel.width);
            }
        }
        this.uplot.init(this.options);
    }

    public setRange(startRange) {
    }

    public setOptions(options: ChartOptions, clear: boolean = false) {
        this.options = { ...this.options, ...options };
        if (clear) {
            this.options = { ...this.options, ...<ChartOptions>{ series: [{}] } };
        }
        // this.options.axes = [{ labelFont: options.fontFamily }, { labelFont: options.fontFamily } ];
        this.init(this.options);
        this.redraw();
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

export interface ChartOptions extends UplotOptions  {
    panel: { height: number, width: number };
    connectSeparatedPoints?: boolean;
    labelsSeparateLines?: boolean;
    titleHeight?: number;
    axisLabelFontSize?: number;
    axisLabelWidth?: number;
    labelsDivWidth?: number;
    axisLineColor?: string;
    axisLabelColor?: string;
    gridLineColor?: string;

    fontFamily?: string;
    legendFontSize?: number;
    colorBackground?: string;
    legendBackground?: string;
}
