import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, Input, Output, EventEmitter, ElementRef } from '@angular/core';

import { ChartLegendMode, ChartRangeType, ChartRangeConverter, ChartLine, ChartViewType, ChartLineZone } from '../../../../_models/chart';
import { NgxUplotComponent, NgxSeries, ChartOptions } from '../../../../gui-helpers/ngx-uplot/ngx-uplot.component';
import { DaqQuery, DateFormatType, TimeFormatType, IDateRange, GaugeChartProperty, DaqChunkType } from '../../../../_models/hmi';
import { Utils } from '../../../../_helpers/utils';
import { TranslateService } from '@ngx-translate/core';

import { DaterangeDialogComponent } from '../../../../gui-helpers/daterange-dialog/daterange-dialog.component';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { Subject, interval, timer } from 'rxjs';
import { delay, takeUntil } from 'rxjs/operators';
import { ScriptService } from '../../../../_services/script.service';
import { ProjectService } from '../../../../_services/project.service';
import { ScriptParam, ScriptParamType } from '../../../../_models/script';
import { HmiService } from '../../../../_services/hmi.service';

@Component({
    selector: 'chart-uplot',
    templateUrl: './chart-uplot.component.html',
    styleUrls: ['./chart-uplot.component.scss']
})
export class ChartUplotComponent implements OnInit, AfterViewInit, OnDestroy {

    @ViewChild('chartPanel', {static: false}) public chartPanel: ElementRef;
    @ViewChild('nguplot', {static: false}) public nguplot: NgxUplotComponent;

    @Input() options: ChartOptions;
    @Output() onTimeRange: EventEmitter<DaqQuery> = new EventEmitter();

    loading = false;
    id: string;
    withToolbar = false;
    isEditor = false;
    reloadActive = false;
    private lastDaqQuery = new DaqQuery();
    rangeTypeValue = Utils.getEnumKey(ChartRangeType, ChartRangeType.last8h);
    rangeType: ChartRangeType;
    range: ZoomRangeType = { from: Date.now(), to: Date.now(), zoomStep: 0 };
    mapData: MapDataDictionary = {};
    pauseMemoryValue: ValueDictionary = {};
    private destroy$ = new Subject<void>();
    property: GaugeChartProperty;
    chartName: string;
    addValueInterval = 0;
    zoomSize = 0;

    constructor(
        private projectService: ProjectService,
        private hmiService: HmiService,
        private scriptService: ScriptService,
        public dialog: MatDialog,
        private translateService: TranslateService) {
    }

    ngOnInit() {
        if (!this.options) {
            this.options = ChartUplotComponent.DefaultOptions();
        }
    }

    ngAfterViewInit() {
        if (!this.isEditor && this.property?.type === ChartViewType.custom) {
            this.getCustomData();
        }
        if (this.nguplot) {
            this.nguplot.languageLabels.serie = this.translateService.instant('chart.labels-serie');
            this.nguplot.languageLabels.time = this.translateService.instant('chart.labels-time');
            this.nguplot.languageLabels.title = this.translateService.instant('chart.labels-title');
        }
    }

    ngOnDestroy() {
        try {
            delete this.chartPanel;
            if (this.nguplot) {
                this.nguplot.ngOnDestroy();
            }
            delete this.nguplot;
            this.destroy$.next(null);
            this.destroy$.unsubscribe();
        } catch (e) {
            console.error(e);
        }
    }

    onClick(evStep: string) {
        if (this.isEditor) {
            return;
        }
        this.lastDaqQuery.gid = this.id;
        let timeStep = ChartRangeConverter.ChartRangeToHours(<ChartRangeType>this.rangeTypeValue) * 60 * 60;
        if (this.zoomSize) {
            timeStep = this.zoomSize;
        }
        if (evStep === 'B') {           // back
            this.range.to = new Date(this.range.from).getTime();
            this.range.from = new Date(this.range.from).setTime(new Date(this.range.from).getTime() - (timeStep * 1000));
        } else if (evStep === 'F') {    // forward
            this.range.from = new Date(this.range.to).getTime();
            this.range.to = new Date(this.range.from).setTime(new Date(this.range.from).getTime() + (timeStep * 1000));
        }
        this.lastDaqQuery.sids = Object.keys(this.mapData);
        this.updateLastDaqQueryRange(this.range);
    }

    onRangeChanged(ev, fromRefresh?: boolean) {
        if (this.isEditor) {
            return;
        }
        if (!fromRefresh) {
            this.zoomSize = 0;
        }
        if (ev) {
            this.range.from = Date.now();
            this.range.to = Date.now();
            let timeStep = ChartRangeConverter.ChartRangeToHours(ev) * 60 * 60;
            if (this.zoomSize) {
                timeStep = this.zoomSize;
            }
            this.range.from = new Date(this.range.from).setTime(new Date(this.range.from).getTime() - (timeStep * 1000));

            this.lastDaqQuery.event = ev;
            this.lastDaqQuery.gid = this.id;
            this.lastDaqQuery.sids = Object.keys(this.mapData);
            this.updateLastDaqQueryRange(this.range);
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
                this.lastDaqQuery.gid = this.id;
                this.lastDaqQuery.sids = Object.keys(this.mapData);
                this.updateLastDaqQueryRange(this.range);
            }
        });
    }

    onDaqQuery(daqQuery?: DaqQuery) {
        if (daqQuery) {
            this.lastDaqQuery = <DaqQuery>Utils.mergeDeep(this.lastDaqQuery, daqQuery);
        }
        this.lastDaqQuery.chunked = true;
        this.onTimeRange.emit(this.lastDaqQuery);
        if (this.withToolbar) {
            this.setLoading(true);
        }
    }

    onRefresh(fromRefresh?: boolean) {
        if (this.property?.type === ChartViewType.custom) {
            this.getCustomData();
        } else {
            this.onRangeChanged(this.lastDaqQuery.event, fromRefresh);
            this.reloadActive = true;
        }
    }

    onExportData() {
        // let data = <DataTableContent>{ name: 'data', columns: [] };
        // let columns = {};
        // Object.values(this.columnsStyle).forEach((column: TableColumn) => {
        //     columns[column.id] = <DataTableColumn>{ header: `${column.label}`, values: [] };
        // });
        // this.dataSource.data.forEach(row => {
        //     Object.keys(row).forEach(id => {
        //         columns[id].values.push(<TableCellData>row[id].stringValue);
        //     });
        // });
        // data.columns = Object.values(columns);
        // this.dataService.exportTagsData(data);
    }

    public resize(height?: number, width?: number) {
        if (!this.chartPanel) {
            return;
        }
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
            if (this.withToolbar && !this.options.hideToolbar) {
                this.options.height -= 34;  // toolbar
            }
            let size = Utils.getDomTextHeight(this.options.titleHeight, this.options.fontFamily);
            this.options.height -= size;    // title

            size = Utils.getDomTextHeight(this.options.axisLabelFontSize, this.options.fontFamily);
            if (size < 10) {size = 10;}
            this.options.height -= size;    // axis
            this.nguplot.resize(this.options.height, this.options.width);
        }
    }

    public init(options: ChartOptions = null, reset = true) {
        if (reset) {
            this.mapData = {};
        }
        if (options) {
            this.options = options;
        }
        this.destroy$.next(null);
        if (this.property?.type === ChartViewType.history && this.options.refreshInterval) {
            interval(this.options.refreshInterval * 60000).pipe(
                takeUntil(this.destroy$)
            ).subscribe((res) => {
                this.onRefresh();
            });
        }
        this.updateCanvasOptions(this.nguplot);
        if (this.options.panel) {
            this.resize(this.options.panel.height, this.options.panel.width);
        }
        this.nguplot.init(this.options, (this.property?.type === ChartViewType.custom) ? true : false);
        this.updateDomOptions(this.nguplot);
    }

    public setInitRange(startRange?: string) {
        if (this.withToolbar) {
            if (startRange) {
                this.rangeTypeValue = this.options.lastRange;
            } else if (this.options.lastRange) {
                this.rangeTypeValue = this.options.lastRange;
            }
        }
        if (this.property?.type === ChartViewType.history) {
            this.onRangeChanged(this.rangeTypeValue);
        } else if (this.options.loadOldValues && this.options.realtime) {
            this.lastDaqQuery.gid = this.id;
            this.lastDaqQuery.sids = Object.keys(this.mapData);
            var now = new Date();
            this.range.from = new Date(now.getTime() - this.options.realtime * 60000).getTime();
            this.range.to = Date.now();
            this.updateLastDaqQueryRange(this.range);
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

    public updateOptions(options: ChartOptions) {
        this.options = { ...this.options, ...options };
        this.init(this.options, false);
        Object.keys(this.mapData).forEach(key => {
            this.nguplot.addSerie(this.mapData[key].index, this.mapData[key].attribute);
        });
        this.setInitRange();
        this.redraw();
    }

    public getOptions(): ChartOptions {
        return this.options;
    }

    public addLine(id: string, name: string, line: ChartLine, addYaxisToLabel: boolean) {
        if (!this.mapData[id]) {
            let linelabel = line.label || name;
            if (addYaxisToLabel)
                {linelabel = `Y${line.yaxis} - ${linelabel}`;}
            let serie = <NgxSeries>{ label: linelabel, stroke: line.color, spanGaps: true };
            if (line.yaxis > 1) {
                serie.scale = line.yaxis.toString();
            } else {
                serie.scale = '1';
            }
            serie.spanGaps = Utils.isNullOrUndefined(line.spanGaps) ? true : line.spanGaps;

            if (line.lineWidth) {
                serie.width = line.lineWidth;
            }

            const fallbackFill = line.fill || 'rgba(0,0,0,0)';

            const fallbackStroke = line.color || 'rgb(0,0,0)';

            if (line.zones?.some(zone => zone.fill)) {
                const zones = this.generateZones(line.zones, 'fill', fallbackFill);
                if (zones) {
                    serie.fill = (self, seriesIndex) => this.nguplot.scaleGradient(self, line.yaxis, 1, zones, true) || fallbackFill;
                }
            } else if (line.fill) {
                serie.fill = line.fill;
            }

            if (line.zones?.some(zone => zone.stroke)) {
                const zones = this.generateZones(line.zones, 'stroke', fallbackStroke);
                if (zones) {
                    serie.stroke = (self, seriesIndex) => this.nguplot.scaleGradient(self, line.yaxis, 1, zones, true) || fallbackStroke;
                }
            } else if (line.color) {
                serie.stroke = line.color;
            }

            serie.lineInterpolation = line.lineInterpolation;
            this.mapData[id] = <MapDataType>{
                index: Object.keys(this.mapData).length + 1,
                attribute: serie,
                lastValueTime: 0
            };
            this.nguplot.addSerie(this.mapData[id].index, this.mapData[id].attribute);
        }
        if (this.isEditor) {
            this.nguplot.setSample();
        }
    }

    private generateZones(ranges: ChartLineZone[], attribute: 'stroke' | 'fill', baseColor: string): Zone[] {

        const result: Zone[] = [];
        const sorted = ranges.sort((a, b) => a.min - b.min);

        // ── 1. Color for –∞ comes from the first zone ───────────────
        const firstColor = sorted[0]?.[attribute] || baseColor;
        result.push([-Infinity, firstColor]);

        // ── 2. Mid‑zone stops (same as before) ──────────────────────
        sorted.forEach((r, i) => {
            const color = r[attribute] || baseColor;
            result.push([r.min, color]);

            const nextMin = sorted[i + 1]?.min;
            if (nextMin !== undefined && r.max < nextMin) {
            result.push([r.max, color]);
            } else if (nextMin === undefined) {
            // last zone – we’ll add +∞ after the loop
            result.push([r.max, color]);
            }
        });

        // ── 3. Color for +∞ comes from the last zone ────────────────
        const lastColor = sorted[sorted.length - 1]?.[attribute] || baseColor;
        result.push([Infinity, lastColor]);

        return result;
        }

    /**
     * add value to a realtime chart
     * @param id
     * @param x
     * @param y
     */
    public addValue(id: string, x, y) {
        const property = this.mapData[id];
        if (property) {
            if (this.addValueInterval && Utils.getTimeDifferenceInSeconds(property.lastValueTime) < this.addValueInterval) {
                return;
            }
            if (this.range?.zoomStep) {
                // save value in pause to if zoom will be resetted
                if (!this.pauseMemoryValue[id]) {
                    this.pauseMemoryValue[id] = [];
                }
                this.pauseMemoryValue[id].push({ x, y });
                return;
            }
            this.nguplot.addValue(property.index, x, y, this.zoomSize || this.options.realtime * 60);
            property.lastValueTime = Date.now();
            this.range.to = Date.now();
        }
    }

    private chunkBuffer = new Map<number, any[]>();  // Buffer for received chunks
    private processedChunks = new Set<number>();     // Prevent duplicates
    private totalChunks = 0;

    public setValues(values: any[][], chunk: DaqChunkType) {
        const missingOrInvalidChunk = !chunk || !chunk.index || !chunk.of;
        if (missingOrInvalidChunk) {
            try {
                const first = values?.[0]?.[0];
                // Case A: data unified -> [timestamps[], serie1[], serie2[], ...]
                if (Array.isArray(values) && Array.isArray(values[0]) && typeof first === 'number') {
                    this.nguplot.setData(values);
                    this.nguplot.setXScala(this.range.from / 1e3, this.range.to / 1e3);
                    setTimeout(() => this.setLoading(false), 300);
                    return;
                }
                // Case B: array of object -> [[{dt,value|v}, ...], ...] -> normalize e unified
                if (first && typeof first === 'object') {
                    const normalized = values.map(serie =>
                        serie.map(p => ({
                            dt: (p.dt ?? p.time),                           // tollera 'time'
                            value: (p.value !== undefined ? p.value : p.v)  // tollera 'v'
                        }))
                    );
                    const mergedData = this.buildUnifiedData([normalized]);
                    this.nguplot.setData(mergedData);
                    this.nguplot.setXScala(this.range.from / 1e3, this.range.to / 1e3);
                    setTimeout(() => this.setLoading(false), 300);
                    return;
                }
                console.warn('setValues (not-chunk): format unknow', values);
            } catch (err) {
                console.error('setValues (not-chunk): error parsing/application', err);
            }
            return;
        }

        // Reset if this is the first chunk of a new series
        if (chunk.index === 1) {
            this.chunkBuffer.clear();
            this.processedChunks.clear();
            this.totalChunks = chunk.of;
        }

        // Skip duplicate chunks
        if (this.processedChunks.has(chunk.index)) {
            // console.warn(`⚠️ Duplicate chunk ignored: ${chunk.index}`);
            return;
        }

        // Store chunk
        this.chunkBuffer.set(chunk.index, values);
        this.processedChunks.add(chunk.index);

        // If all expected chunks have been received
        if (this.chunkBuffer.size === this.totalChunks) {
            const sortedChunks = Array.from(this.chunkBuffer.entries())
                .sort((a, b) => a[0] - b[0])
                .map(entry => entry[1]);

            const mergedData = this.buildUnifiedData(sortedChunks);

            this.nguplot.setData(mergedData);
            this.nguplot.setXScala(this.range.from / 1e3, this.range.to / 1e3);

            setTimeout(() => this.setLoading(false), 300);
        }
    }

    // Converts chunks into format: [timestamps[], line1[], line2[], ...]
    private buildUnifiedData(chunks: any[][][]): any[] {
        const timestampsSet = new Set<number>();
        const xmap = new Map<number, Record<number, any>>();

        for (let chunk of chunks) {
            for (let i = 0; i < chunk.length; i++) {
                for (const v of chunk[i]) {
                    const t = Math.floor(v.dt / 1000);
                    timestampsSet.add(t);
                    if (!xmap.has(t)) {
                        xmap.set(t, {});
                    }
                    xmap.get(t)[i] = v.value;
                }
            }
        }
        const sortedTimestamps = Array.from(timestampsSet).sort((a, b) => a - b);
        const result = [sortedTimestamps];
        const seriesCount = chunks[0].length;

        for (let i = 0; i < seriesCount; i++) {
            const line = [];
            for (const t of sortedTimestamps) {
                const val = xmap.get(t)?.[i];
                line.push(val !== undefined ? val : null);
            }
            result.push(line);
        }
        return result;
    }

    public redraw() {
        this.nguplot.redraw();
    }

    setZoom(range: ZoomRangeType) {
        this.range = range;
        this.nguplot.setXScala(this.range.from / 1e3, this.range.to / 1e3);
        this.zoomSize = this.range.to / 1e3 - this.range.from / 1e3;
        // if zoom resetted then add values in saved in pause
        if (!range.zoomStep) {
            Object.keys(this.pauseMemoryValue).forEach((id) => {
                const data = this.pauseMemoryValue[id];
                if (data) {
                    Object.values(data).forEach((value) => {
                        this.addValue(id, value.x, value.y);
                    });
                }
            });
            this.pauseMemoryValue = {};
        }
        this.updateLastDaqQueryRange(this.range);
    }

    private updateLastDaqQueryRange(range: DaqRangeType) {
        this.lastDaqQuery.from = range.from;
        this.lastDaqQuery.to = range.to;
        this.onDaqQuery();
    }

    getZoomStatus() {
        return this.range;
    }

    public setProperty(property: any, value: any): boolean {
        if (Utils.isNullOrUndefined(this[property])) {
            return false;
        }
        this[property] = value;
        return true;
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

    private setLoading(load: boolean) {
        if (load) {
            timer(10000).pipe(
                takeUntil(this.destroy$)
            ).subscribe((res) => {
                this.loading = false;
            });
        }
        this.loading = load;
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
            if (this.options.fontFamily) {font += ' ' + this.options.fontFamily;}
            this.options.axes[i].font = font;
            this.options.axes[i].labelFont = font;
            this.options.axes[i].ticks = { width: 1 / devicePixelRatio };
            if (this.options.gridLineColor) {
                this.options.axes[i].grid.stroke = this.options.gridLineColor;
                this.options.axes[i].ticks.stroke = this.options.gridLineColor;
            }
            if (this.options.axisLabelColor) {this.options.axes[i].stroke = this.options.axisLabelColor;}
        }

        let always = Utils.getEnumKey(ChartLegendMode, ChartLegendMode.always);
        let bottom = Utils.getEnumKey(ChartLegendMode, ChartLegendMode.bottom);
        let follow = Utils.getEnumKey(ChartLegendMode, ChartLegendMode.follow);
        this.options.legend = { show: (this.options.legendMode === always || this.options.legendMode === bottom), width: 1 };
        this.options.tooltip = { show: (this.options.legendMode === always || this.options.legendMode === follow) };
        // Axes label
        if (this.options.axisLabelX) {this.options.axes[0].label = this.options.axisLabelX;}
        if (this.options.axisLabelY1) {this.options.axes[1].label = this.options.axisLabelY1;}
        if (this.options.axisLabelY2) {this.options.axes[2].label = this.options.axisLabelY2;}
        if (this.options.axisLabelY3) {this.options.axes[3].label = this.options.axisLabelY3;}
        if (this.options.axisLabelY4) {this.options.axes[4].label = this.options.axisLabelY4;}
    }

    private updateDomOptions(ngup: NgxUplotComponent) {
        let ele = this.chartPanel.nativeElement.getElementsByClassName('u-title');
        if (ele) {
            let title = ele[0];
            if (this.options.titleHeight) {
                if (this.options.axisLabelColor) {title.style.color = this.options.axisLabelColor;}
                if (this.options.titleHeight) {title.style.fontSize = this.options.titleHeight + 'px';}
                if (this.options.fontFamily) {title.style.fontFamily = this.options.fontFamily;}
            } else {
                title.style.display = 'none';
            }
        }
        let legend = this.chartPanel.nativeElement.querySelector('.u-legend');
        if (legend) {
            if (this.options.axisLabelColor) {legend.style.color = this.options.axisLabelColor;}
            legend.style.lineHeight = 0;
        }
        this.chartPanel.nativeElement.style.backgroundColor = this.options.colorBackground;
    }

    private getCustomData() {
        const script = this.projectService.getScripts()?.find(script => script.id === this.property?.options?.scriptId);
        if (script) {
            let scriptToRun = Utils.clone(script);
            let chart = this.hmiService.getChart(this.property.id);
            this.reloadActive = true;
            scriptToRun.parameters = [<ScriptParam>{
                type: ScriptParamType.chart,
                value: chart?.lines,
                name: script.parameters[0]?.name
            }];
            this.scriptService.runScript(scriptToRun).pipe(
                delay(200)
            ).subscribe(customData => {
                this.setCustomValues(customData);
            }, err => {
                console.error(err);
            }, () => {
                this.reloadActive = false;
            });
        }
    }

    /**
     * set custom values to a chart
     * the values is composed of a matrix of array, array of lines[<x[], y[]>]
     * the have to be transform in uplot format. a matrix with array of datetime and arrays of values [x[value], lineN[value]]
     * @param values
     */
    public setCustomValues(lines) {
        let result = [];
        result.push([]);    // timestamp, index 0
        let xmap = {};
        for (var i = 0; i < lines?.length; i++) {
            result.push([]);    // line
            for (var xPos = 0; xPos < lines[i]?.x.length; xPos++) {
                let xValue = lines[i].x[xPos];
                if (result[0].indexOf(xValue) === -1) {
                    result[0].push(xValue);
                    xmap[xValue] = {};
                }
                const yValue = lines[i].y[xPos];
                xmap[xValue][i] = yValue;
            }
        }
        result[0].sort(function(a, b) { return a - b; });
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
        this.nguplot?.setData(result);
        setTimeout(() => {
            this.setLoading(false);
        }, 500);
    }
}

interface MapDataType {
    index: number;
    attribute: NgxSeries;
    lastValueTime: number;
}

interface MapDataDictionary {
    [key: string]: MapDataType;
}

interface DaqRangeType {
    from: number;
    to: number;
}

interface ZoomRangeType {
    from: number;
    to: number;
    zoomStep: number;
}

interface ValueType {
    x: any;
    y: any;
}

interface ValueDictionary {
    [key: string]: ValueType[];
}

type Zone = [number, string];
