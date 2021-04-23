import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, Input, Output, EventEmitter, ElementRef } from '@angular/core';

import { NgxUplotComponent } from '../../../../gui-helpers/ngx-uplot/ngx-uplot.component';
import { Options, Series, Axis } from '../../../../gui-helpers/ngx-uplot/uPlot';
import { DaqQuery } from '../../../../_models/hmi';

@Component({
    selector: 'chart-uplot',
    templateUrl: './chart-uplot.component.html',
    styleUrls: ['./chart-uplot.component.css']
})
export class ChartUplotComponent implements OnInit, AfterViewInit, OnDestroy {

    @ViewChild('chartPanel') public chartPanel: ElementRef;
    @ViewChild('nguplot') public nguplot: NgxUplotComponent;
    
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
            delete this.nguplot;
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
            this.nguplot.resize(this.options.height, this.options.width);
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
        this.nguplot.init(this.options);
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
            this.mapData[id] = { index: Object.keys(this.mapData).length + 1, attribute: <Series>{ label: name, stroke: color, spanGaps: true } };
            this.nguplot.addSerie(this.mapData[id].index, this.mapData[id].attribute);
        }
        if (this.isEditor) {
            this.nguplot.setSample();
        }
    }

    public addValue(id: string, x, y) {
        if (this.mapData[id]) {
            this.nguplot.addValue(this.mapData[id].index, x, y);
        }
    }

    public setValues(values) {
        this.nguplot.setData(values);
    }

    public redraw() {
        this.nguplot.redraw();
    }

    public static DefaultOptions() {
        return <ChartOptions>{ fontFamily: 'Roboto-Regular', legendFontSize: 10, colorBackground: 'rgba(0,0,0,0)', legendBackground: 'rgba(0,0,0,0)', 
        titleHeight: 20, axisLabelFontSize: 12, labelsDivWidth: 0, axisLineColor: 'rgba(0,0,0,1)', axisLabelColor: 'rgba(0,0,0,1)',
        legendMode: 'always', series: [], width: 360, height: 200 };
    }
}

export interface ChartOptions extends Options  {
    /** chart panel size, with from toolbar to legend */
    panel?: { height: number, width: number };
    /** when true, null data values will not cause line breaks, Series.spanGaps */
    connectSeparatedPoints?: boolean;

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
    legendMode?: string;
}