import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild, Input } from '@angular/core';

import { Series, Options } from './uPlot';

declare const uPlot: any;

@Component({
    selector: 'ngx-uplot',
    templateUrl: './ngx-uplot.component.html',
    styleUrls: ['./ngx-uplot.component.css']
})
export class NgxUplotComponent implements OnInit, AfterViewInit, OnDestroy {

    @Input() public id: string;
    @Input() public options: Options;
    @ViewChild('graph') public graph: ElementRef;

    uplot: any;
    data: number[][];
    xtime = [new Date().getTime() / 1000 - 1, new Date().getTime() / 1000];     // start and sample x time
    sampleData = [this.xtime, [35, 71]];
    
    fmtDate = uPlot.fmtDate("{DD}/{MM}/{YY} {HH}:{mm}:{ss}");

    sampleSerie = [
        {},
        {
            // initial toggled state (optional)
            show: true,
            spanGaps: false,
            // // in-legend display
            label: "Serie",
            value: (self, rawValue) => rawValue.toFixed(2),
            // // series style
            stroke: "red",
            width: 1,
            fill: "rgba(255, 0, 0, 0.3)",
            dash: [10, 5],
        }
    ];

    defOptions: Options = {
        title: "Default Chart",
        id: "defchart",
        class: "my-chart",
        width: 800,
        height: 600,
        legend: { show: true, width: 1 },
        scales: {
            x: {
                time: true,
            },
        },
        series: this.sampleSerie,
    };

    constructor() { }

    ngOnInit() {
        this.options = this.defOptions;
        this.uplot = new uPlot(this.defOptions, this.sampleData, this.graph.nativeElement);
    }

    ngAfterViewInit() {
    }

    ngOnDestroy() {
        try {
            this.uplot.destroy();
        } catch (e) {
            console.log(e);
        }
    }

    resize(height?, width?) {
        let chart = this.graph.nativeElement;        
        if (!height) { 
            height = chart.clientHeight;
        }
        if (!width) {
            width = chart.clientWidth;
        }
        this.uplot.setSize({height: height, width: width});
        // this.uplot.redraw(false, true);
    }

    init(options?: Options) {
        this.data = [[]];
        if (options) {
            this.options = options;
            if (!options.id) {
                // this.options.axes = [{ label: 'Time' },
                // {
                //     grid: { width: 1 / devicePixelRatio, },
                //     ticks: { width: 1 / devicePixelRatio, }
                // }];
                this.data = this.sampleData;
                this.options.series = this.sampleSerie;
            } else {
                // this.data = this.sampleData;
                this.data = [this.xtime];
            }
        }
        let opt = this.options || this.defOptions;
        if (this.uplot) {
            this.uplot.destroy();
        }
        this.uplot = new uPlot(opt, this.data, this.graph.nativeElement);
    }

    setOptions(options: Options) {
        this.options = options;
        this.init(this.options);
    }

    addSerie(index: string, attribute: Series) {
        this.data.push([null,null]);
        this.uplot.addSeries(attribute, index);
        this.uplot.setData(this.data);
    }

    setSample() {
        let sample = [this.xtime];
        for (let i = 0; i < this.uplot.series.length; i++) {
            sample.push([Math.floor(Math.random() * 20), Math.floor(Math.random() * 30)]);
        }
        this.setData(sample);
    }

    setData(data = [[]]) {
        this.data = data;
        this.uplot.setData(this.data);
    }

	addValue(index, x, y) {
        let xpos = this.data[0].indexOf(x);
        if (xpos < 0) {
            this.data[0].push(x);
            for (let i = 0; i < this.data.length; i++) {
                if (this.data[i].length > 300) {
                    this.data[i].shift();
                }
                if (i === index) {
                    this.data[i].push(y);
                } else if (i) {
                    this.data[i].push(null);
                }
            }
        } else {
            this.data[index][xpos] = y;
        }
        this.uplot.setData(this.data);
    }

    redraw(flag: boolean = false) {
        this.uplot.redraw(flag);
    }

    checkAxisOptions() {

    }
}
