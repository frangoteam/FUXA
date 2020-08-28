import { Component, Input, Output, ElementRef, OnInit, AfterViewInit, OnChanges, ViewChild, SimpleChanges, EventEmitter } from '@angular/core';
import { ChangeDetectorRef  } from '@angular/core';
import { DygraphOptions } from './dygraphOptions';

import { ChartRangeType, ChartRangeConverter } from '../../_models/chart';
import { DaqQuery } from '../../_models/hmi';
import { isUndefined } from 'util';

declare const Dygraph: any;
@Component({
    selector: 'ngx-dygraphs',
    templateUrl: './ngx-dygraphs.component.html',
    styleUrls: ['./ngx-dygraphs.component.css']
})
/**
 * Wrapper arround Dygraphs
 *
 * @class NgDygraphsComponent
 */
export class NgxDygraphsComponent implements OnInit, AfterViewInit, OnChanges {
    @Input() public id: string;
    @Input() public options: DygraphOptions;
    @Input() public data: any;
    @Input() public noDataLabel: string;
    @Output() onTimeRange: EventEmitter<DaqQuery> = new EventEmitter();
    @ViewChild('tempchart') public tempchart: ElementRef;
    @ViewChild('tempbord') public tempbord: ElementRef;
    @ViewChild('tempgridv') public tempgridv: ElementRef;
    @ViewChild('tempgrido') public tempgrido: ElementRef;
    @ViewChild('chart') public chart: ElementRef;
    @ViewChild('chartPanel') public chartPanel: ElementRef;

    public loadingInProgress: boolean;
    public withToolbar = false;
    public isEditor = false;
    public rangeTypeValue = <ChartRangeType>Object.keys(ChartRangeType)[0];
    public rangeType: ChartRangeType;
    public range = { from: Date.now(), to: Date.now() };

    //   public chartWidth: number;
    //   public chartHeight: number;
    mapData = {};

    public dygraph: any;
    public defOptions: DygraphOptions = {
        // width: "auto",
        // height: "auto",
        labels: ['Date', 'Temperature'],
        colors: [],
        // xlabel: "X label text",
        // ylabel: "Y label text",
        title: 'My Title',
        animatedZooms: true,
        connectSeparatedPoints: true,
        legend: 'always',
        labelsSeparateLines: true,
        // pointSize: 2,
        titleHeight: 20,
        axisLabelFontSize: 12
    };
    public sampleData = [[new Date('1967/09/14'), 0], [new Date('1968/09/14'), 1]];

    constructor(private changeDetector: ChangeDetectorRef) {
    }

    public ngOnInit() {
        this.defOptions = Object.assign(this.defOptions, this.options);
        this.options = Object.assign(this.defOptions, this.options);
        this.defOptions = JSON.parse(JSON.stringify(this.options));
        delete this.options['fontFamily'];
        delete this.options['legendFontSize'];
        delete this.options['colorBackground'];
        delete this.options['legendBackground'];
        this.noDataLabel = this.noDataLabel || 'NO DATA AVAILABLE';
    }

    ngAfterViewInit() {
        this.data = this.sampleData;
        this.dygraph = new Dygraph(this.chart.nativeElement, this.data, this.options);
        this.loadingInProgress = false;
        this.dygraph.ready(graph => {
            let sc: SimpleChanges = {};
            this.ngOnChanges(sc);
            // set chart layout
            if (!this.isEditor) {
                if (this.defOptions['fontFamily']) {
                    this.chart.nativeElement.style.fontFamily = this.defOptions['fontFamily'];
                }
                let  ele = this.chart.nativeElement.getElementsByClassName('dygraph-legend');
                if (ele && ele.length) {
                    if (this.defOptions['legendFontSize'] >= 0) {
                        ele[0].style.fontSize = this.defOptions['legendFontSize'] + 'px';
                    }
                    if (this.defOptions['legendBackground']) {
                        ele[0].style.backgroundColor = this.defOptions['legendBackground'];
                    }
                }
            }
            if (this.isEditor && this.tempchart && this.tempchart.nativeElement) {
                if (this.defOptions['fontFamily']) {
                    this.tempchart.nativeElement.style.fontFamily = this.defOptions['fontFamily'];
                }
                if (this.defOptions['axisLabelFontSize']) {
                    this.tempchart.nativeElement.style.fontSize = this.defOptions['axisLabelFontSize'] + 'px';
                }
                if (this.defOptions['colorBackground']) {
                    this.tempchart.nativeElement.style.backgroundColor = this.defOptions['colorBackground'];
                }
                if (this.defOptions['axisLabelColor']) {
                    this.tempbord.nativeElement.style.borderColor  = this.defOptions['axisLabelColor'];
                }
                if (this.defOptions['gridLineColor']) {
                    this.tempgridv.nativeElement.style.borderColor  = this.defOptions['gridLineColor'];
                    this.tempgrido.nativeElement.style.borderColor  = this.defOptions['gridLineColor'];
                }
            }
            if (this.defOptions['colorBackground']) {
                this.chartPanel.nativeElement.style.backgroundColor = this.defOptions['colorBackground'];
            }
            if (this.defOptions['axisLabelColor']) {
                this.chartPanel.nativeElement.style.color = this.defOptions['axisLabelColor'];
            }
        });
        if (this.withToolbar && !this.isEditor) {
            this.onRangeChanged(this.rangeTypeValue);
        }
        this.changeDetector.detectChanges();
    }

    /**
     * ngOnChanges
     * @method ngOnChanges
     * @return {void}
     */
    public ngOnChanges(changes: SimpleChanges) {
        if (!changes) {
            return;
        }

        if (!this.data || !this.data.length) {
            this.loadingInProgress = false;
            return;
        }

        this.loadingInProgress = true;
        const options = Object.assign({}, this.options);

        // if (!options.width) {
        //   options.width = this.chartWidth;
        // }
        // if (!options.height) {
        //   options.height = this.chartHeight;
        // }
        if (!options.legend) {
            options.legend = 'always';
        }

        // this.resize();
        // setTimeout(() => {
        //   this.dygraph = new Dygraph(this.chart.nativeElement, this.data, options);
        //   this.loadingInProgress = false;
        //   this.dygraph.ready(graph => {
        //     this.watchRangeSelector(graph);
        //   });
        // }, 500);
    }

    onClick(ev) {
        let msg = new DaqQuery();
        msg.gid = this.id;
        msg.event = ev;
        if (ev === 'B') {           // back
            this.range.to = new Date(this.range.from).getTime();
            this.range.from = new Date(this.range.from).setTime(new Date(this.range.from).getTime() - (ChartRangeConverter.ChartRangeToHours(this.rangeTypeValue) * 60 * 60 * 1000));    
        } else if (ev === 'F') {    // forward
            this.range.from = new Date(this.range.to).getTime();
            this.range.to = new Date(this.range.from).setTime(new Date(this.range.from).getTime() + (ChartRangeConverter.ChartRangeToHours(this.rangeTypeValue) * 60 * 60 * 1000));    
        }
        msg.sids = Object.keys(this.mapData);
        msg.from = this.range.from;
        msg.to = this.range.to;        
        this.onTimeRange.emit(msg);
    }

    onRangeChanged(ev) {
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


    public resize(height?, width?) {
        let chart = this.chart.nativeElement;
        let w = chart.parentNode.clientWidth;
        let h = chart.parentNode.clientHeight;
        if (height) {
            h = height;
        }
        if (width) {
            w = width;
        }
        chart.style.height = h + 'px';
        chart.style.width = w + 'px';
        if (this.dygraph) {
            this.dygraph.updateOptions({ height: h, width: w });
            this.dygraph.resize(width, height);
        }
    }

    public changeVisibility(index, value) {
        if (this.dygraph) {
            this.dygraph.setVisibility(index, value);
        }
    }

    public init() {
        this.options.labels = ['DateTime'];
        this.mapData = {};
        this.data = [];
    }

    public setRange(startRange) {
        if (this.withToolbar && !this.isEditor) {
            this.rangeTypeValue = startRange;
            this.onRangeChanged(this.rangeTypeValue);
        }
    }

    public setOptions(options) {
        try {
            this.options = Object.assign(this.options, options);
            if (this.dygraph) {
                this.dygraph.updateOptions(this.options);
            }
        } catch (e) {
        }
    }

    public addLine(id: string, name:string, color: string) {
        if (!this.mapData[id]) {
            this.mapData[id] = this.options.labels.length;
            this.options.labels.push(name);
            this.options.colors.push(color);
            if (this.dygraph) {
                this.dygraph.updateOptions({ labels: this.options.labels, colors: this.options.colors });
            }
        }
    }

    public addValue(id: string, value) {
        if (this.mapData[id] && !isUndefined(value)) {
            let row = Array(this.options.labels.length).fill(null);
            row[0] = new Date();
            let val: any = parseFloat(value);
            if (Number.isNaN(val)) {
                // maybe boolean
                val = Number(value);
            }
            row[this.mapData[id]] = val;

            this.data.push(row);
            // check to remove old value
            if (this.data.length > 1000) {
                this.data.shift();
            }
            if (this.dygraph) {
                this.dygraph.updateOptions({ file: this.data });
            }
        }
    }

    public setValues(values) {
        this.data = values;
        if (this.dygraph) {
            this.dygraph.updateOptions({ file: this.data, dateWindow: [this.range.from, this.range.to] });
        }
    }

    public clear() {
        this.data = [];
        if (this.dygraph) {
            this.dygraph.updateOptions({ file: this.data });
        }
    }
}
