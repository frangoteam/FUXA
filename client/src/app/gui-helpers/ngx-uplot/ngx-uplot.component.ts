/* eslint-disable @angular-eslint/component-selector */
import { Component, OnInit, OnDestroy, ElementRef, ViewChild, Input } from '@angular/core';
import { Utils } from '../../_helpers/utils';

import { Series, Options, Legend } from './uPlot';
import { ChartLineZone } from '../../_models/chart';

declare const uPlot: any;
declare const placement: any;

@Component({
    selector: 'ngx-uplot',
    templateUrl: './ngx-uplot.component.html',
    styleUrls: ['./ngx-uplot.component.css']
})
export class NgxUplotComponent implements OnInit, OnDestroy {

    @Input() public id: string;
    @Input() public options: NgxOptions;
    @ViewChild('graph', {static: true}) public graph: ElementRef;


    readonly lineInterpolations = {
        linear: 0,
        stepAfter: 1,
        stepBefore: 2,
        spline: 3,
    };

    rawData = false;
    overlay: any;
    uplot: any;
    data: number[][];
    get xSample() { return this.rawData ? [2, 7] : [new Date().getTime() / 1000 - 1, new Date().getTime() / 1000]; };     // start and sample x time
    sampleData = [this.xSample, [35, 71]];

    private getShortTimeFormat(min: boolean = true) {
        if (this.options && this.options.timeFormat === 'hh_mm_ss_AA') {
            if (min) {return '{h}:{mm} {AA}';}
            return '{h} {AA}';
        }
        if (min) {return '{HH}:{mm}';}
        return '{HH}';
    }

    private xTimeFormat = { hh_mm_ss: '{HH}:{mm}:{ss}', hh_mm_ss_AA: '{h}:{mm}:{ss} {AA}' };
    private xDateFormat = { };

    private checkDateFormat() {
        this.xDateFormat = {
            YYYY_MM_DD: {
                legendDate: '{YYYY}/{MM}/{DD}',
                values: [
                    // tick incr default: year (3600 * 24 * 365), month(3600 * 24 * 28), day(3600 * 24), hour, min, sec, mode
                    [31536000, '{YYYY}', null, null, null, null, null, null, 1],
                    [2419200, '{MMM}', '\n{YYYY}', null, null, null, null, null, 1],
                    [86400, '{DD}/{MM}', '\n{YYYY}', null, null, null, null, null, 1],
                    [3600, '' + this.getShortTimeFormat(false), '\n{YYYY}/{MM}/{DD}', null, '\n{DD}/{MM}', null, null, null, 1],
                    [60, '' + this.getShortTimeFormat(), '\n{YYYY}/{MM}/{DD}', null, '\n{DD}/{MM}', null, null, null, 1],
                    [1, '{mm}:{ss}', '\n{YYYY}/{MM}/{DD} ' + this.getShortTimeFormat(), null, '\n{DD}/{MM} ' + this.getShortTimeFormat(), null, '\n' + this.getShortTimeFormat(), null, 1],
                    [0.001, ':{ss}.{fff}', '\n{YYYY}/{MM}/{DD} ' + this.getShortTimeFormat(), null, '\n{DD}/{MM} ' + this.getShortTimeFormat(), null, '\n' + this.getShortTimeFormat(), null, 1]]
            },
            MM_DD_YYYY: {
                legendDate: '{MM}/{DD}/{YYYY}',
                values: [
                    // tick incr default: year (3600 * 24 * 365), month(3600 * 24 * 28), day(3600 * 24), hour, min, sec, mode
                    [31536000, '{YYYY}', null, null, null, null, null, null, 1],
                    [2419200, '{MMM}', '\n{YYYY}', null, null, null, null, null, 1],
                    [86400, '{MM}/{DD}', '\n{YYYY}', null, null, null, null, null, 1],
                    [3600, '' + this.getShortTimeFormat(false), '\n{MM}/{DD}/{YYYY}', null, '\n{MM}/{DD}', null, null, null, 1],
                    [60, '' + this.getShortTimeFormat(), '\n{MM}/{DD}/{YYYY}', null, '\n{MM}/{DD}', null, null, null, 1],
                    [1, '{mm}:{ss}', '\n{MM}/{DD}/{YYYY} ' + this.getShortTimeFormat(), null, '\n{MM}/{DD} ' + this.getShortTimeFormat(), null, '\n' + this.getShortTimeFormat(), null, 1],
                    [0.001, ':{ss}.{fff}', '\n{MM}/{DD}/{YYYY} ' + this.getShortTimeFormat(), null, '\n{MM}/{DD} ' + this.getShortTimeFormat(), null, '\n' + this.getShortTimeFormat(), null, 1]]
            },
            DD_MM_YYYY: {
                legendDate: '{DD}/{MM}/{YYYY}',
                values: [
                    // tick incr default: year (3600 * 24 * 365), month(3600 * 24 * 28), day(3600 * 24), hour, min, sec, mode
                    [31536000, '{YYYY}', null, null, null, null, null, null, 1],
                    [2419200, '{MMM}', '\n{YYYY}', null, null, null, null, null, 1],
                    [86400, '{DD}/{MM}', '\n{YYYY}', null, null, null, null, null, 1],
                    [3600, '' + this.getShortTimeFormat(false), '\n{DD}/{MM}/{YYYY}', null, '\n{DD}/{MM}', null, null, null, 1],
                    [60, '' + this.getShortTimeFormat(), '\n{DD}/{MM}/{YYYY}', null, '\n{DD}/{MM}', null, null, null, 1],
                    [1, '{mm}:{ss}', '\n{DD}/{MM}/{YYYY} ' + this.getShortTimeFormat(), null, '\n{DD}/{MM} ' + this.getShortTimeFormat(), null, '\n' + this.getShortTimeFormat(), null, 1],
                    [0.001, ':{ss}.{fff}', '\n{DD}/{MM}/{YYYY} ' + this.getShortTimeFormat(), null, '\n{DD}/{MM} ' + this.getShortTimeFormat(), null, '\n' + this.getShortTimeFormat(), null, 1]]
            },
            MM_DD_YY: {
                legendDate: '{MM}/{DD}/{YY}',
                values: [
                    // tick incr default: year (3600 * 24 * 365), month(3600 * 24 * 28), day(3600 * 24), hour, min, sec, mode
                    [31536000, '{YYYY}', null, null, null, null, null, null, 1],
                    [2419200, '{MMM}', '\n{YYYY}', null, null, null, null, null, 1],
                    [86400, '{MM}/{DD}', '\n{YYYY}', null, null, null, null, null, 1],
                    [3600, '' + this.getShortTimeFormat(false), '\n{MM}/{DD}/{YY}', null, '\n{MM}/{DD}', null, null, null, 1],
                    [60, '' + this.getShortTimeFormat(), '\n{MM}/{DD}/{YY}', null, '\n{MM}/{DD}', null, null, null, 1],
                    [1, '{mm}:{ss}', '\n{MM}/{DD}/{YY} ' + this.getShortTimeFormat(), null, '\n{MM}/{DD} ' + this.getShortTimeFormat(), null, '\n' + this.getShortTimeFormat(), null, 1],
                    [0.001, ':{ss}.{fff}', '\n{MM}/{DD}/{YY} ' + this.getShortTimeFormat(), null, '\n{MM}/{DD} ' + this.getShortTimeFormat(), null, '\n' + this.getShortTimeFormat(), null, 1]]
            },
            DD_MM_YY: {
                legendDate: '{DD}/{MM}/{YY}',
                values: [
                    // tick incr default: year (3600 * 24 * 365), month(3600 * 24 * 28), day(3600 * 24), hour, min, sec, mode
                    [31536000, '{YYYY}', null, null, null, null, null, null, 1],
                    [2419200, '{MMM}', '\n{YYYY}', null, null, null, null, null, 1],
                    [86400, '{DD}/{MM}', '\n{YYYY}', null, null, null, null, null, 1],
                    [3600, '' + this.getShortTimeFormat(false), '\n{DD}/{MM}/{YY}', null, '\n{DD}/{MM}', null, null, null, 1],
                    [60, '' + this.getShortTimeFormat(), '\n{DD}/{MM}/{YY}', null, '\n{DD}/{MM}', null, null, null, 1],
                    [1, '{mm}:{ss}', '\n{DD}/{MM}/{YY} ' + this.getShortTimeFormat(), null, '\n{DD}/{MM} ' + this.getShortTimeFormat(), null, '\n' + this.getShortTimeFormat(), null, 1],
                    [0.001, ':{ss}.{fff}', '\n{DD}/{MM}/{YY} ' + this.getShortTimeFormat(), null, '\n{DD}/{MM} ' + this.getShortTimeFormat(), null, '\n' + this.getShortTimeFormat(), null, 1]]
            },
        };
    }

    fmtDate = uPlot.fmtDate('{DD}/{MM}/{YY} {HH}:{mm}:{ss}');

    sampleSerie = [
        {
            value: (self, rawValue) => this.fmtDate(new Date(rawValue * 1e3))
        },
        {
            // initial toggled state (optional)
            show: true,
            spanGaps: false,
            // // in-legend display
            label: 'Serie',
            value: (self, rawValue) => rawValue?.toFixed(this.options.decimalsPrecision),
            // // series style
            stroke: 'red',
            width: 1,
            fill: 'rgba(255, 0, 0, 0.3)',
            dash: [10, 5],
        }
    ];

    defOptions: Options = {
        title: 'Default Chart',
        id: 'defchart',
        class: 'my-chart',
        width: 800,
        height: 600,
        legend: { show: true, width: 1 },
        scales: {
            x: {
                time: true,
            },
        },
        series: this.sampleSerie,
        cursor: {
            dataIdx: (self, seriesIdx, hoveredIdx, cursorXVal) => this._proximityIndex(self, seriesIdx, hoveredIdx, cursorXVal),
        },
    };
    languageLabels = { time: 'Time', serie: 'Serie', title: 'Title' };
    constructor() { }

    ngOnInit() {
        this.options = this.defOptions;
        //this.options.cursor = { drag: { x: true, y: true } };
        this.uplot = new uPlot(this.defOptions, this.sampleData, this.graph.nativeElement);
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

    init(options?: ChartOptions, rawData?: boolean) {
        this.data = [[]];
        this.rawData = rawData;
        if (!Utils.isNullOrUndefined(options?.rawData)) {
            this.rawData = options.rawData;
        }
        if (options) {
            this.options = options;
            if (!options.id) {
                this.data = this.sampleData;
                this.options.series = this.sampleSerie;
            } else {
                // this.data = this.sampleData;
                this.data = [this.xSample];
            }
        }
        let opt = this.options || this.defOptions;
        opt.cursor = this.defOptions.cursor;
        if (this.uplot) {
            this.uplot.destroy();
        }
        // set x axis format (date/time)
        this.checkDateFormat();
        if (this.options.dateFormat && this.xDateFormat[this.options.dateFormat] && this.options.timeFormat && this.xTimeFormat[this.options.timeFormat]) {
            this.fmtDate = uPlot.fmtDate(this.xDateFormat[this.options.dateFormat].legendDate + ' ' + this.xTimeFormat[this.options.timeFormat]);
            if (this.rawData) {
                this.options.axes[0].values = (self, rawValue) => rawValue;
            } else {
                this.options.axes[0].values = this.xDateFormat[this.options.dateFormat].values;
            }
        }
        this.sampleSerie[1].label = this.languageLabels.serie;
        if (this.options.series.length > 0) {
            this.options.series[0].value = (self, rawValue) => this.rawData ? rawValue : this.fmtDate(new Date(rawValue * 1e3));
            this.options.series[0].label = this.languageLabels.time;
        }
        if (this.options.axes.length > 0) {
            if (this.options.axes[0].label) {
                this.options.series[0].label = this.options.axes[0].label;
            } else {
                this.options.axes[0].label = this.languageLabels.time;
            }
        }
        if (!this.options.title) {
            this.options.title = this.languageLabels.title;
        }
        this.options.scales = {
            1: { range: [Utils.isNumeric(options.scaleY1min) ? options.scaleY1min : null, Utils.isNumeric(options.scaleY1max) ? options.scaleY1max : null] },
            2: { range: [Utils.isNumeric(options.scaleY2min) ? options.scaleY2min : null, Utils.isNumeric(options.scaleY2max) ? options.scaleY2max : null] },
            3: { range: [Utils.isNumeric(options.scaleY3min) ? options.scaleY3min : null, Utils.isNumeric(options.scaleY3max) ? options.scaleY3max : null] },
            4: { range: [Utils.isNumeric(options.scaleY4min) ? options.scaleY4min : null, Utils.isNumeric(options.scaleY4max) ? options.scaleY4max : null] },
        };

        // set plugins
        opt.plugins = (this.options.tooltip && this.options.tooltip.show) ? [this.tooltipPlugin()] : [];
        if (this.options.thouchZoom) {
            opt.plugins.push(this.touchZoomPlugin(opt));
        }
        this.uplot = new uPlot(opt, this.data, this.graph.nativeElement);

    }

    setOptions(options: Options) {
        this.options = options;
        this.init(this.options, this.rawData);
    }

    addSerie(index: number, attribute: Series) {
        this.data.push([null,null]);
        if (attribute.lineInterpolation === this.lineInterpolations.stepAfter) {
            attribute.paths = uPlot.paths.stepped({ align: 1 });
        } else if (attribute.lineInterpolation === this.lineInterpolations.stepBefore) {
            attribute.paths = uPlot.paths.stepped({ align: -1 });
        } else if (attribute.lineInterpolation === this.lineInterpolations.spline) {
            attribute.paths = uPlot.paths.spline();
        }
        this.uplot.addSeries(attribute, index);
        this.uplot.setData(this.data);
    }

    setSample() {
        let sample = [this.xSample];
        for (let i = 0; i < this.uplot.series.length; i++) {
            sample.push([Math.floor(Math.random() * 20), Math.floor(Math.random() * 30)]);
        }
        this.setData(sample);
    }

    setData(data = [[]]) {
        this.data = data;
        this.uplot.setData(this.data);
    }

    addData(data = [[]]) {
        for (var index = 0; index < data.length; index++) {
            this.data[index] = this.data[index].concat(data[index]);
        }
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
        while (this.data[0][0] < min) {
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

        this.overlay = document.createElement('div');
        let overlay = this.overlay;
        overlay.id = 'overlay';
        overlay.style.display = 'none';
        overlay.style.position = 'absolute';
        document.body.appendChild(overlay);

        return {
            hooks: {
                init: u => {
                    over = u.root.querySelector('.u-over');

                    bound = over;
                    //	bound = document.body;

                    over.onmouseenter = () => {
                        overlay.style.display = 'block';
                    };

                    over.onmouseleave = () => {
                        overlay.style.display = 'none';
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
                    const xdiv = `<div class="ut-head">${u.series[0].label}: ${this.rawData ? x : time}</div>`;
                    let series = '';
                    for (let i = 1; i < u.series.length; i++) {
                        let value = '';
                        try {
                            var ydx = this._proximityIndex(u, i, idx, x);
                            if (!isNaN(u.data[i][ydx])) {
                                value = u.data[i][ydx];
                            }
                        } catch { }
                        series = series + `<div class="ut-serie"><div class="ut-marker" style="border-color: ${u.series[i]._stroke}"></div>${u.series[i].label}: <div class="ut-value">${value}</div></div>`;
                    }
                    overlay.innerHTML = xdiv + series;// + `${x},${y} at ${Math.round(left)},${Math.round(top)}`;
                    placement(overlay, anchor, 'right', 'start', { bound });
                }
            }
        };
    }

    getColorForValue(ranges: ChartLineZone[], value: number): string {
        // Sort ranges by the min value (just in case)
        const sortedRanges = ranges.sort((a, b) => a.min - b.min);

        // Iterate through the sorted ranges to find the corresponding color for the value
        for (let i = 0; i < sortedRanges.length; i++) {
            const range = sortedRanges[i];

            // Check if the value falls within the range
            if (value >= range.min && value <= range.max) {
                return range.stroke;  // Return the corresponding color
            }
        }

        // If no range was found for the value, return a default color (base color)
        return 'red';  // Or any other default color you prefer
    }

    scaleGradient(u, scaleKey, ori, scaleStops, discrete = false) {
        let scale = u.scales[scaleKey];

        // we want the stop below or at the scaleMax
        // and the stop below or at the scaleMin, else the stop above scaleMin
        let minStopIdx;
        let maxStopIdx;

        for (let i = 0; i < scaleStops.length; i++) {
            let stopVal = scaleStops[i][0];

            if (stopVal <= scale.min || minStopIdx == null) {
                minStopIdx = i;
            }

            maxStopIdx = i;

            if (stopVal >= scale.max) {
                break;
            }
        }

        if (minStopIdx == maxStopIdx) {
            return scaleStops[minStopIdx][1];
        }

        let minStopVal = scaleStops[minStopIdx][0];
        let maxStopVal = scaleStops[maxStopIdx][0];

        if (minStopVal == -Infinity) {
            minStopVal = scale.min;
        }

        if (maxStopVal == Infinity) {
            maxStopVal = scale.max;
        }

        let minStopPos = u.valToPos(minStopVal, scaleKey, true);
        let maxStopPos = u.valToPos(maxStopVal, scaleKey, true);

        let range = minStopPos - maxStopPos;

        let x0, y0, x1, y1;

        if (ori == 1) {
            x0 = x1 = 0;
            y0 = minStopPos;
            y1 = maxStopPos;
        }
        else {
            y0 = y1 = 0;
            x0 = minStopPos;
            x1 = maxStopPos;
        }

        if (Number.isNaN(y0) || Number.isNaN(y1)) {
            return null;
        }
        let grd = this.uplot.ctx.createLinearGradient(x0, y0, x1, y1);

        let prevColor;

        for (let i = minStopIdx; i <= maxStopIdx; i++) {
            let s = scaleStops[i];

            let stopPos = i == minStopIdx ? minStopPos : i == maxStopIdx ? maxStopPos : u.valToPos(s[0], scaleKey, true);
            let pct = (minStopPos - stopPos) / range;

            if (discrete && i > minStopIdx) {
                grd.addColorStop(pct, prevColor);
            }
            grd.addColorStop(pct, prevColor = s[1]);
        }

        return grd;
    }

    _proximityIndex(self, seriesIdx, hoveredIdx, cursorXVal) {
        let hoverProximityPx = 30;
        let seriesData = self.data[seriesIdx];
        if (seriesData[hoveredIdx] == null) {
            let nonNullLft = null,
                nonNullRgt = null,
                i;

            i = hoveredIdx;
            while (nonNullLft == null && i-- > 0) {
                if (seriesData[i] != null)
                    {nonNullLft = i;}
            }

            i = hoveredIdx;
            while (nonNullRgt == null && i++ < seriesData.length) {
                if (seriesData[i] != null)
                    {nonNullRgt = i;}
            }

            let xVals = self.data[0];

            let curPos = self.valToPos(cursorXVal, 'x');
            let rgtPos = nonNullRgt == null ?  Infinity : self.valToPos(xVals[nonNullRgt], 'x');
            let lftPos = nonNullLft == null ? -Infinity : self.valToPos(xVals[nonNullLft], 'x');

            let lftDelta = curPos - lftPos;
            let rgtDelta = rgtPos - curPos;

            if (lftDelta <= rgtDelta) {
                if (lftDelta <= hoverProximityPx)
                    {hoveredIdx = nonNullLft;}
            }
            else {
                if (rgtDelta <= hoverProximityPx)
                    {hoveredIdx = nonNullRgt;}
            }
        }

        return hoveredIdx;
    }

    touchZoomPlugin(opts) {
        function init(u, opts, data) {
            let over = u.over;
            let rect, oxRange, oyRange, xVal, yVal;
            let fr = {x: 0, y: 0, dx: 0, dy: 0};
            let to = {x: 0, y: 0, dx: 0, dy: 0};

            function storePos(t, e) {
                let ts = e.touches;

                let t0 = ts[0];
                let t0x = t0.clientX - rect.left;
                let t0y = t0.clientY - rect.top;

                if (ts.length == 1) {
                    t.x = t0x;
                    t.y = t0y;
                    t.d = t.dx = t.dy = 1;
                }
                else {
                    let t1 = e.touches[1];
                    let t1x = t1.clientX - rect.left;
                    let t1y = t1.clientY - rect.top;

                    let xMin = Math.min(t0x, t1x);
                    let yMin = Math.min(t0y, t1y);
                    let xMax = Math.max(t0x, t1x);
                    let yMax = Math.max(t0y, t1y);

                    // midpts
                    t.y = (yMin+yMax)/2;
                    t.x = (xMin+xMax)/2;

                    t.dx = xMax - xMin;
                    t.dy = yMax - yMin;

                    // dist
                    t.d = Math.sqrt(t.dx * t.dx + t.dy * t.dy);
                }
            }

            let rafPending = false;

            function zoom() {
                rafPending = false;

                let left = to.x;
                let top = to.y;

                // non-uniform scaling
            //	let xFactor = fr.dx / to.dx;
            //	let yFactor = fr.dy / to.dy;

                // uniform x/y scaling
                let xFactor = fr.dx / to.dx;
                let yFactor = fr.dy / to.dy;

                let leftPct = left/rect.width;
                let btmPct = 1 - top/rect.height;

                let nxRange = oxRange * xFactor;
                let nxMin = xVal - leftPct * nxRange;
                let nxMax = nxMin + nxRange;

                let nyRange = oyRange * yFactor;
                let nyMin = yVal - btmPct * nyRange;
                let nyMax = nyMin + nyRange;

                u.batch(() => {
                    u.setScale('x', {
                        min: nxMin,
                        max: nxMax,
                    });

                    u.setScale('y', {
                        min: nyMin,
                        max: nyMax,
                    });
                });
            }

            function touchmove(e) {
                storePos(to, e);

                if (!rafPending) {
                    rafPending = true;
                    requestAnimationFrame(zoom);
                }
            }

            over.addEventListener('touchstart', function(e) {
                rect = over.getBoundingClientRect();

                storePos(fr, e);

                oxRange = u.scales.x.max - u.scales.x.min;
                oyRange = u.scales.y.max - u.scales.y.min;

                let left = fr.x;
                let top = fr.y;

                xVal = u.posToVal(left, 'x');
                yVal = u.posToVal(top, 'y');

                document.addEventListener('touchmove', touchmove, {passive: true});
            });

            over.addEventListener('touchend', function(e) {
                document.removeEventListener('touchmove', touchmove, {});
            });
        }

        return {
            hooks: {
                init
            }
        };
    }
}

export interface NgxOptions extends Options {

    decimalsPrecision?: number;
    tooltip?: Legend;
    dateFormat?: string;
    timeFormat?: string;
    thouchZoom?: boolean;
}

export interface ChartOptions extends NgxOptions {
    /** chart panel size, with from toolbar to legend */
    panel?: { height: number; width: number };
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
    scaleY1min?: number;
    scaleY1max?: number;
    axisLabelY2?: string;
    scaleY2min?: number;
    scaleY2max?: number;
    axisLabelY3?: string;
    scaleY3min?: number;
    scaleY3max?: number;
    axisLabelY4?: string;
    scaleY4min?: number;
    scaleY4max?: number;

    fontFamily?: string;
    legendFontSize?: number;
    colorBackground?: string;
    legendBackground?: string;
    legendMode?: string;
    realtime?: number;
    lastRange?: string;
    hideToolbar?: boolean;
    refreshInterval?: number;
    loadOldValues?: boolean;

    scriptId?: string;
    rawData?: boolean;
}

export interface NgxSeries extends Series {
}
