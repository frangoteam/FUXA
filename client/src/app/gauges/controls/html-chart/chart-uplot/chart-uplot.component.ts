import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, Input, Output, EventEmitter, ElementRef } from '@angular/core';

import { ChartLegendMode, ChartRangeType, ChartRangeConverter, ChartLine } from '../../../../_models/chart';
import { NgxUplotComponent, NgxOptions, NgxSeries } from '../../../../gui-helpers/ngx-uplot/ngx-uplot.component';
import { DaqQuery, DateFormatType, TimeFormatType, IDateRange } from '../../../../_models/hmi';
import { Utils } from '../../../../_helpers/utils';
import { TranslateService } from '@ngx-translate/core';

import { DaterangeDialogComponent } from '../../../../gui-helpers/daterange-dialog/daterange-dialog.component';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

@Component({
    selector: 'chart-uplot',
    templateUrl: './chart-uplot.component.html',
    styleUrls: ['./chart-uplot.component.css']
})
export class ChartUplotComponent implements OnInit, AfterViewInit, OnDestroy {

    @ViewChild('chartPanel') public chartPanel: ElementRef;
    @ViewChild('nguplot') public nguplot: NgxUplotComponent;

    @Input() options: ChartOptions;
    @Output() onTimeRange: EventEmitter<DaqQuery> = new EventEmitter();

    public id: string;
    public withToolbar = false;
    public isEditor = false;
    rangeTypeValue = Utils.getEnumKey(ChartRangeType, ChartRangeType.last8h);
    rangeType: ChartRangeType;
    range = { from: Date.now(), to: Date.now() };
    mapData = {};

    constructor(
        public dialog: MatDialog, 
        private translateService: TranslateService) {
    }

    ngOnInit() {
        if (!this.options) {
            this.options = ChartUplotComponent.DefaultOptions();
        }
    }

    ngAfterViewInit() {
        this.translateService.get('chart.labels-serie').subscribe((txt: string) => { if (this.nguplot) this.nguplot.languageLabels.serie = txt });
        this.translateService.get('chart.labels-time').subscribe((txt: string) => { if (this.nguplot) this.nguplot.languageLabels.time = txt });
        this.translateService.get('chart.labels-title').subscribe((txt: string) => { if (this.nguplot) this.nguplot.languageLabels.title = txt });
    }

    ngOnDestroy() {
        try {
            delete this.chartPanel;
            if (this.nguplot) {
                this.nguplot.ngOnDestroy();
            }
            delete this.nguplot;
        } catch (e) {
            console.error(e);
        }
    }

    onClick(ev: string) {
        if (this.isEditor) {
            return;
        }
        let msg = new DaqQuery();
        msg.gid = this.id;
        msg.event = ev;
        if (ev === 'B') {           // back
            this.range.to = new Date(this.range.from).getTime();
            this.range.from = new Date(this.range.from).setTime(new Date(this.range.from).getTime() - (ChartRangeConverter.ChartRangeToHours(<ChartRangeType>this.rangeTypeValue) * 60 * 60 * 1000));
        } else if (ev === 'F') {    // forward
            this.range.from = new Date(this.range.to).getTime();
            this.range.to = new Date(this.range.from).setTime(new Date(this.range.from).getTime() + (ChartRangeConverter.ChartRangeToHours(<ChartRangeType>this.rangeTypeValue) * 60 * 60 * 1000));
        }
        msg.sids = Object.keys(this.mapData);
        msg.from = this.range.from;
        msg.to = this.range.to;
        this.onTimeRange.emit(msg);
    }

    onRangeChanged(ev) {
        if (this.isEditor) {
            return;
        }
        if (ev) {
            this.range.from = Date.now();
            this.range.to = Date.now();
            this.range.from = new Date(this.range.from).setTime(new Date(this.range.from).getTime() - (ChartRangeConverter.ChartRangeToHours(ev) * 60 * 60 * 1000));

            let msg = new DaqQuery();
            msg.event = ev;
            msg.gid = this.id;
            msg.sids = Object.keys(this.mapData);
            msg.from = this.range.from;
            msg.to = this.range.to;
            this.onTimeRange.emit(msg);
        }
    }

    onDateRange() {
        let dialogRef = this.dialog.open(DaterangeDialogComponent, {
            panelClass: 'light-dialog-container'
        });
        dialogRef.afterClosed().subscribe((dateRange: IDateRange) => {
            if (dateRange) {
                this.range.from = dateRange.start;
                this.range.to = dateRange.end;
                let msg = new DaqQuery();
                msg.gid = this.id;
                msg.sids = Object.keys(this.mapData);
                msg.from = dateRange.start;
                msg.to = dateRange.end;
                this.onTimeRange.emit(msg);
            }
        });
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
            this.options.height = height;
            this.options.height -= 40;      // legend
            if (this.withToolbar) {
                this.options.height -= 34;  // toolbar
            }
            let size = Utils.getDomTextHeight(this.options.titleHeight, this.options.fontFamily);
            this.options.height -= size;    // title

            size = Utils.getDomTextHeight(this.options.axisLabelFontSize, this.options.fontFamily);
            if (size < 10) size = 10;
            this.options.height -= size;    // axis
            this.nguplot.resize(this.options.height, this.options.width);
        }
    }

    public init(options: ChartOptions = null) {
        this.mapData = {};
        if (options) {
            this.options = options;
        }
        this.updateCanvasOptions(this.nguplot);
        if (this.options.panel) {
            this.resize(this.options.panel.height, this.options.panel.width);
        }
        this.nguplot.init(this.options);
        this.updateDomOptions(this.nguplot);
    }

    public setRange(startRange) {
        if (this.withToolbar) {
            if (startRange) {
                this.rangeTypeValue = this.options.lastRange;
            } else if (this.options.lastRange) {
                this.rangeTypeValue = this.options.lastRange;
            }
            this.onRangeChanged(this.rangeTypeValue);
        }
    }

    public setOptions(options: ChartOptions, clear: boolean = false) {
        this.options = { ...this.options, ...options };
        if (clear) {
            this.options = { ...this.options, ...<ChartOptions>{ series: [{}] } };
        }
        this.init(this.options);
        this.redraw();
    }

    public addLine(id: string, name: string, line: ChartLine, addYaxisToLabel: boolean) {
        if (!this.mapData[id]) {
            let linelabel = line.label || name;
            if (addYaxisToLabel) 
                linelabel = `Y${line.yaxis} - ${linelabel}`;
            let serie = <NgxSeries>{ label: linelabel, stroke: line.color, spanGaps: true };
            if (line.yaxis > 1) {
                serie.scale = line.yaxis.toString();
            } else {
                serie.scale = '1';
            }
            if (line.fill) {
                serie.fill = line.fill;
            }
            serie.lineInterpolation = line.lineInterpolation;
            this.mapData[id] = {
                index: Object.keys(this.mapData).length + 1,
                attribute: serie
            };
            this.nguplot.addSerie(this.mapData[id].index, this.mapData[id].attribute);
        }
        if (this.isEditor) {
            this.nguplot.setSample();
        }
    }

    /**
     * add value to a realtime chart
     * @param id 
     * @param x 
     * @param y 
     */
    public addValue(id: string, x, y) {
        if (this.mapData[id]) {
            this.nguplot.addValue(this.mapData[id].index, x, y, this.options.realtime * 60);
        }
    }

    /**
     * set values to a history chart
     * the values is composed of a matrix of array, array of lines values[]<datetime, value> [line][pos]{dt, value}
     * the have to be transform in uplot format. a matrix with array of datetime and arrays of values [datetime[dt], lineN[value]]
     * @param values 
     */
    public setValues(values) {
        let result = [];
        result.push([]);    // timestamp, index 0
        let xmap = {};
        for (var i = 0; i < values.length; i++) {
            result.push([]);    // line
            for (var x = 0; x < values[i].length; x++) {
                let t = values[i][x].dt / 1e3;
                if (!result[0][t]) {
                    result[0].push(t);
                    xmap[t] = {};
                }
                xmap[t][i] = values[i][x].value;
            }
        }
        result[0].sort(function (a, b) { return a - b });
        for (var i = 0; i < result[0].length; i++) {
            let t = result[0][i];
            for (var x = 1; x < result.length; x++) {
                if (xmap[t][x - 1] !== undefined) {
                    result[x].push(xmap[t][x - 1]);
                } else {
                    result[x].push(null);
                }
            }
        }
        this.nguplot.setData(result);
        this.nguplot.setXScala(this.range.from / 1e3, this.range.to / 1e3);
    }

    public redraw() {
        this.nguplot.redraw();
    }

    public static DefaultOptions() {
        return <ChartOptions>{
            title: 'Title', fontFamily: 'Roboto-Regular', legendFontSize: 12, colorBackground: 'rgba(255,255,255,0)', legendBackground: 'rgba(255,255,255,0)',
            titleHeight: 18, axisLabelFontSize: 12, labelsDivWidth: 0, axisLineColor: 'rgba(0,0,0,1)', axisLabelColor: 'rgba(0,0,0,1)',
            legendMode: 'always', series: [], width: 360, height: 200, decimalsPrecision: 2, realtime: 60,
            dateFormat: Utils.getEnumKey(DateFormatType, DateFormatType.MM_DD_YYYY),
            timeFormat: Utils.getEnumKey(TimeFormatType, TimeFormatType.hh_mm_ss_AA)
        };
    }

    private updateCanvasOptions(ngup: NgxUplotComponent) {
        if (!this.options.axes) {
            this.options.axes = [{ label: 'Time', grid: { show: true, width: 1 / devicePixelRatio }, ticks: {} }];
            this.options.axes.push({ grid: { show: true, width: 1 / devicePixelRatio }, ticks: {}, scale: '1' });
            this.options.axes.push({ grid: { show: false, width: 1 / devicePixelRatio }, ticks: {}, side: 1, scale: '2' });
            this.options.axes.push({ grid: { show: false, width: 1 / devicePixelRatio }, ticks: {}, side: 3, scale: '3' });
            this.options.axes.push({ grid: { show: false, width: 1 / devicePixelRatio }, ticks: {}, side: 1, scale: '4' });
        }
        for (let i = 0; i < this.options.axes.length; i++) {
            let font = '';
            if (this.options.axisLabelFontSize) {
                font = this.options.axisLabelFontSize + 'px';
            }
            if (this.options.fontFamily) font += ' ' + this.options.fontFamily;
            this.options.axes[i].font = font;
            this.options.axes[i].labelFont = font;
            this.options.axes[i].ticks = { width: 1 / devicePixelRatio };
            if (this.options.gridLineColor) {
                this.options.axes[i].grid.stroke = this.options.gridLineColor;
                this.options.axes[i].ticks.stroke = this.options.gridLineColor;
            }
            if (this.options.axisLabelColor) this.options.axes[i].stroke = this.options.axisLabelColor;
        }

        let always = Utils.getEnumKey(ChartLegendMode, ChartLegendMode.always);
        let bottom = Utils.getEnumKey(ChartLegendMode, ChartLegendMode.bottom);
        let follow = Utils.getEnumKey(ChartLegendMode, ChartLegendMode.follow);
        this.options.legend = { show: (this.options.legendMode === always || this.options.legendMode === bottom), width: 1 };
        this.options.tooltip = { show: (this.options.legendMode === always || this.options.legendMode === follow) };
        // Axes label
        if (this.options.axisLabelX) this.options.axes[0].label = this.options.axisLabelX;
        if (this.options.axisLabelY1) this.options.axes[1].label = this.options.axisLabelY1;
        if (this.options.axisLabelY2) this.options.axes[2].label = this.options.axisLabelY2;
        if (this.options.axisLabelY3) this.options.axes[3].label = this.options.axisLabelY3;
        if (this.options.axisLabelY4) this.options.axes[4].label = this.options.axisLabelY4;
    }

    private updateDomOptions(ngup: NgxUplotComponent) {
        let ele = this.chartPanel.nativeElement.getElementsByClassName('u-title');
        if (ele) {
            let title = ele[0];
            if (this.options.titleHeight) {
                if (this.options.axisLabelColor) title.style.color = this.options.axisLabelColor;
                if (this.options.titleHeight) title.style.fontSize = this.options.titleHeight + "px";
                if (this.options.fontFamily) title.style.fontFamily = this.options.fontFamily;
            } else {
                title.style.display = 'none';
            }
        }
        let legend = this.chartPanel.nativeElement.querySelector('.u-legend');
        if (legend) {
            if (this.options.axisLabelColor) legend.style.color = this.options.axisLabelColor;
            legend.style.lineHeight = 0;
        }
        this.chartPanel.nativeElement.style.backgroundColor = this.options.colorBackground;
    }
}

export interface ChartOptions extends NgxOptions {
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
    axisLabelX?: string;
    axisLabelY1?: string;
    axisLabelY2?: string;
    axisLabelY3?: string;
    axisLabelY4?: string;

    fontFamily?: string;
    legendFontSize?: number;
    colorBackground?: string;
    legendBackground?: string;
    legendMode?: string;
    realtime?: number;
    lastRange?: string;
}