import { isNull } from '@angular/compiler/src/output/output_ast';
import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild, Input } from '@angular/core';

import { Series, Options, Legend } from './uPlot';

declare const uPlot: any;
declare const placement: any;

@Component({
    selector: 'ngx-uplot',
    templateUrl: './ngx-uplot.component.html',
    styleUrls: ['./ngx-uplot.component.css']
})
export class NgxUplotComponent implements OnInit, AfterViewInit, OnDestroy {

    @Input() public id: string;
    @Input() public options: NgxOptions;
    @ViewChild('graph') public graph: ElementRef;

    overlay: any;
    uplot: any;
    data: number[][];
    xtime = [new Date().getTime() / 1000 - 1, new Date().getTime() / 1000];     // start and sample x time
    sampleData = [this.xtime, [35, 71]];

    private getShortTimeFormat(min: boolean = true) {
        if (this.options && this.options.timeFormat === 'hh_mm_ss_AA') {
            if (min) return "{h}:{mm} {AA}";
            return "{h} {AA}";
        }
        if (min) return "{HH}:{mm}";
        return "{HH}";
    }

    private xTimeFormat = { hh_mm_ss: "{HH}:{mm}:{ss}", hh_mm_ss_AA: "{h}:{mm}:{ss} {AA}" };
    private xDateFormat = { };

    private checkDateFormat() {
        this.xDateFormat = {
            YYYY_MM_DD: { 
                legendDate: '{YYYY}/{MM}/{DD}',
                values: [
                    // tick incr default: year (3600 * 24 * 365), month(3600 * 24 * 28), day(3600 * 24), hour, min, sec, mode
                    [31536000, "{YYYY}", null, null, null, null, null, null, 1],
                    [2419200, "{MMM}", "\n{YYYY}", null, null, null, null, null, 1],
                    [86400, "{DD}/{MM}", "\n{YYYY}", null, null, null, null, null, 1],
                    [3600, "" + this.getShortTimeFormat(false), "\n{YYYY}/{MM}/{DD}", null, "\n{DD}/{MM}", null, null, null, 1],
                    [60, "" + this.getShortTimeFormat(), "\n{YYYY}/{MM}/{DD}", null, "\n{DD}/{MM}", null, null, null, 1],
                    [1, ":{ss}", "\n{YYYY}/{MM}/{DD} " + this.getShortTimeFormat(), null, "\n{DD}/{MM} " + this.getShortTimeFormat(), null, "\n" + this.getShortTimeFormat(), null, 1],
                    [0.001, ":{ss}.{fff}", "\n{YYYY}/{MM}/{DD} " + this.getShortTimeFormat(), null, "\n{DD}/{MM} " + this.getShortTimeFormat(), null, "\n" + this.getShortTimeFormat(), null, 1]]
            },
            MM_DD_YYYY: {
                legendDate: '{MM}/{DD}/{YYYY}',
                values: [
                    // tick incr default: year (3600 * 24 * 365), month(3600 * 24 * 28), day(3600 * 24), hour, min, sec, mode
                    [31536000, "{YYYY}", null, null, null, null, null, null, 1],
                    [2419200, "{MMM}", "\n{YYYY}", null, null, null, null, null, 1],
                    [86400, "{MM}/{DD}", "\n{YYYY}", null, null, null, null, null, 1],
                    [3600, "" + this.getShortTimeFormat(false), "\n{MM}/{DD}/{YYYY}", null, "\n{MM}/{DD}", null, null, null, 1],
                    [60, "" + this.getShortTimeFormat(), "\n{MM}/{DD}/{YYYY}", null, "\n{MM}/{DD}", null, null, null, 1],
                    [1, ":{ss}", "\n{MM}/{DD}/{YYYY} " + this.getShortTimeFormat(), null, "\n{MM}/{DD} " + this.getShortTimeFormat(), null, "\n" + this.getShortTimeFormat(), null, 1],
                    [0.001, ":{ss}.{fff}", "\n{MM}/{DD}/{YYYY} " + this.getShortTimeFormat(), null, "\n{MM}/{DD} " + this.getShortTimeFormat(), null, "\n" + this.getShortTimeFormat(), null, 1]]
            },
            DD_MM_YYYY: {
                legendDate: '{DD}/{MM}/{YYYY}',
                values: [
                    // tick incr default: year (3600 * 24 * 365), month(3600 * 24 * 28), day(3600 * 24), hour, min, sec, mode
                    [31536000, "{YYYY}", null, null, null, null, null, null, 1],
                    [2419200, "{MMM}", "\n{YYYY}", null, null, null, null, null, 1],
                    [86400, "{DD}/{MM}", "\n{YYYY}", null, null, null, null, null, 1],
                    [3600, "" + this.getShortTimeFormat(false), "\n{DD}/{MM}/{YYYY}", null, "\n{DD}/{MM}", null, null, null, 1],
                    [60, "" + this.getShortTimeFormat(), "\n{DD}/{MM}/{YYYY}", null, "\n{DD}/{MM}", null, null, null, 1],
                    [1, ":{ss}", "\n{DD}/{MM}/{YYYY} " + this.getShortTimeFormat(), null, "\n{DD}/{MM} " + this.getShortTimeFormat(), null, "\n" + this.getShortTimeFormat(), null, 1],
                    [0.001, ":{ss}.{fff}", "\n{DD}/{MM}/{YYYY} " + this.getShortTimeFormat(), null, "\n{DD}/{MM} " + this.getShortTimeFormat(), null, "\n" + this.getShortTimeFormat(), null, 1]]
            },
            MM_DD_YY: {
                legendDate: '{MM}/{DD}/{YY}',
                values: [
                    // tick incr default: year (3600 * 24 * 365), month(3600 * 24 * 28), day(3600 * 24), hour, min, sec, mode
                    [31536000, "{YYYY}", null, null, null, null, null, null, 1],
                    [2419200, "{MMM}", "\n{YYYY}", null, null, null, null, null, 1],
                    [86400, "{MM}/{DD}", "\n{YYYY}", null, null, null, null, null, 1],
                    [3600, "" + this.getShortTimeFormat(false), "\n{MM}/{DD}/{YY}", null, "\n{MM}/{DD}", null, null, null, 1],
                    [60, "" + this.getShortTimeFormat(), "\n{MM}/{DD}/{YY}", null, "\n{MM}/{DD}", null, null, null, 1],
                    [1, ":{ss}", "\n{MM}/{DD}/{YY} " + this.getShortTimeFormat(), null, "\n{MM}/{DD} " + this.getShortTimeFormat(), null, "\n" + this.getShortTimeFormat(), null, 1],
                    [0.001, ":{ss}.{fff}", "\n{MM}/{DD}/{YY} " + this.getShortTimeFormat(), null, "\n{MM}/{DD} " + this.getShortTimeFormat(), null, "\n" + this.getShortTimeFormat(), null, 1]]
            },
            DD_MM_YY: {
                legendDate: '{DD}/{MM}/{YY}',
                values: [
                    // tick incr default: year (3600 * 24 * 365), month(3600 * 24 * 28), day(3600 * 24), hour, min, sec, mode
                    [31536000, "{YYYY}", null, null, null, null, null, null, 1],
                    [2419200, "{MMM}", "\n{YYYY}", null, null, null, null, null, 1],
                    [86400, "{DD}/{MM}", "\n{YYYY}", null, null, null, null, null, 1],
                    [3600, "" + this.getShortTimeFormat(false), "\n{DD}/{MM}/{YY}", null, "\n{DD}/{MM}", null, null, null, 1],
                    [60, "" + this.getShortTimeFormat(), "\n{DD}/{MM}/{YY}", null, "\n{DD}/{MM}", null, null, null, 1],
                    [1, ":{ss}", "\n{DD}/{MM}/{YY} " + this.getShortTimeFormat(), null, "\n{DD}/{MM} " + this.getShortTimeFormat(), null, "\n" + this.getShortTimeFormat(), null, 1],
                    [0.001, ":{ss}.{fff}", "\n{DD}/{MM}/{YY} " + this.getShortTimeFormat(), null, "\n{DD}/{MM} " + this.getShortTimeFormat(), null, "\n" + this.getShortTimeFormat(), null, 1]]
            },
        }
    }

    fmtDate = uPlot.fmtDate("{DD}/{MM}/{YY} {HH}:{mm}:{ss}");

    sampleSerie = [
        {
            value: (self, rawValue) => this.fmtDate(new Date(rawValue * 1e3))
        },
        {
            // initial toggled state (optional)
            show: true,
            spanGaps: false,
            // // in-legend display
            label: "Serie",
            value: (self, rawValue) => rawValue.toFixed(this.options.decimalsPrecision),
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
    languageLabels = { time: 'Time', serie: 'Serie', title: 'Title' };
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
            if (this.overlay.parentNode) {
                this.overlay.parentNode.removeChild(this.overlay);
            }
        } catch (e) {
            console.error(e);
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
        // set x axis format (date/time)
        this.checkDateFormat();
        if (this.options.dateFormat && this.xDateFormat[this.options.dateFormat] && this.options.timeFormat && this.xTimeFormat[this.options.timeFormat]) {
            this.fmtDate = uPlot.fmtDate(this.xDateFormat[this.options.dateFormat].legendDate + ' ' + this.xTimeFormat[this.options.timeFormat]);
            this.options.axes[0].values = this.xDateFormat[this.options.dateFormat].values;
        }
        this.sampleSerie[1].label = this.languageLabels.serie;
        if (this.options.series.length > 0) {
            this.options.series[0].value = (self, rawValue) => this.fmtDate(new Date(rawValue * 1e3));
            this.options.series[0].label = this.languageLabels.time;
        }
        if (this.options.axes.length > 0) {
            this.options.axes[0].label = this.languageLabels.time;
        }
        if (!this.options.title) {
            this.options.title = this.languageLabels.title;
        }
        // set plugins
        opt.plugins = (this.options.tooltip && this.options.tooltip.show) ? [this.tooltipPlugin()] : [];

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

    setXScala(min: number, max: number) {
        this.uplot.setScale('x', { min: min, max: max });
    }

	addValue(index, x, y, size) {
        let xpos = this.data[0].indexOf(x);
        if (xpos < 0) {
            this.data[0].push(x);
            for (let i = 0; i < this.data.length; i++) {

                if (i === index) {
                    this.data[i].push(y);
                } else if (i) {
                    this.data[i].push(null);
                }
            }
        } else {
            this.data[index][xpos] = y;
        }
        // remove data out of size
        let min = x - size;
        if (this.data[0][0] < min) {
            for (let i = 0; i < this.data.length; i++) {
                this.data[i].shift();
            }
        }
        this.uplot.setData(this.data);
    }

    redraw(flag: boolean = false) {
        this.uplot.redraw(flag);
    }

    checkAxisOptions() {

    }

    tooltipPlugin(opts: any = null) {
        let over, bound, bLeft, bTop;
        function syncBounds() {
            let bbox = over.getBoundingClientRect();
            bLeft = bbox.left;
            bTop = bbox.top;
        }

        this.overlay = document.createElement("div");
        let overlay = this.overlay;
        overlay.id = "overlay";
        overlay.style.display = "none";
        overlay.style.position = "absolute";
        document.body.appendChild(overlay);

        return {
            hooks: {
                init: u => {
                    over = u.root.querySelector(".u-over");

                    bound = over;
                    //	bound = document.body;

                    over.onmouseenter = () => {
                        overlay.style.display = "block";
                    };

                    over.onmouseleave = () => {
                        overlay.style.display = "none";
                    };
                },
                setSize: u => {
                    syncBounds();
                },
                setCursor: u => {
                    const { left, top, idx } = u.cursor;
                    const x = u.data[0][idx];
                    const anchor = { left: left + bLeft, top: top + bTop };
                    const time = this.fmtDate(new Date(x * 1e3));
                    const xdiv = `<div class="ut-head">${u.series[0].label}: ${time}</div>`;
                    let series = '';
                    for (let i = 1; i < u.series.length; i++) {
                        let value = '';
                        try {
                            if (!isNaN(u.data[i][idx])) {
                                if (u.data[i][idx].toString().indexOf('.') != -1) {
                                    value = u.data[i][idx].toFixed(this.options.decimalsPrecision);
                                } else {
                                    value = u.data[i][idx];
                                }
                            }
                        } catch { }
                        series = series + `<div class="ut-serie"><div class="ut-marker" style="border-color: ${u.series[i]._stroke}"></div>${u.series[i].label}: <div class="ut-value">${value}</div></div>`;
                    }
                    overlay.innerHTML = xdiv + series;// + `${x},${y} at ${Math.round(left)},${Math.round(top)}`;
                    placement(overlay, anchor, "right", "start", { bound });
                }
            }
        };
    }
}

export interface NgxOptions extends Options {

    decimalsPrecision?: number;
    tooltip?: Legend;
    dateFormat?: string;
    timeFormat?: string;
}

export interface NgxSeries extends Series {
}