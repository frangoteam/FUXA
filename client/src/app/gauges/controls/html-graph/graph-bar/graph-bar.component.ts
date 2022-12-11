import { Component, OnInit, AfterViewInit, ViewChild, OnDestroy, Input, Output, EventEmitter } from '@angular/core';

import { GraphBaseComponent, GraphOptions, GraphThemeType } from '../graph-base/graph-base.component';
import { GraphBarProperty, GraphBarXType, GraphSource, GraphRangeType, GraphBarFunction, GraphBarDateFunctionType, GraphDateGroupType } from '../../../../_models/graph';
import { Utils } from '../../../../_helpers/utils';
import { Calc, TimeValue, CollectionType } from '../../../../_helpers/calc';
import { ChartType, ChartDataSets, ChartPoint } from 'chart.js';
import { Label, BaseChartDirective } from 'ng2-charts';
import { DaqQuery, DaqValue } from '../../../../_models/hmi';
import * as pluginDataLabels from 'chartjs-plugin-datalabels';

@Component({
    selector: 'graph-bar',
    templateUrl: './graph-bar.component.html',
    styleUrls: ['./graph-bar.component.scss']
})
export class GraphBarComponent extends GraphBaseComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild(BaseChartDirective, {static: false}) public chart?: BaseChartDirective;
    @Input() height = 240;
    @Input() width = 380;
    @Output() onReload: EventEmitter<DaqQuery> = new EventEmitter();

    public barChartOptions: GraphOptions = {
        responsive: true,
        maintainAspectRatio: false,
    };

    public barChartLabels: Label[] = ['2006', '2007', '2008', '2009', '2010', '2011', '2012'];
    public barChartType: ChartType = 'bar';
    public barChartLegend = true;
    public barChartPlugins = [pluginDataLabels];

    public barChartData: ChartDataSets[] = [
        { data: [65, 59, 80, 81, 56, 55, 40], label: 'Series A' },
        { data: [28, 48, 40, 19, 86, 27, 90], label: 'Series B' }
    ];

    id = '';
    isEditor = false;
    title = '';
    property: GraphBarProperty;
    sourceMap = {};
    sourceCount = 0;
    xTypeValue = Utils.getEnumKey(GraphBarXType, GraphBarXType.value);
    xTypeDate = Utils.getEnumKey(GraphBarXType, GraphBarXType.date);

    fncSumHourIntegral = Utils.getEnumKey(GraphBarDateFunctionType, GraphBarDateFunctionType.sumHourIntegral);
    fncValueIntegral = Utils.getEnumKey(GraphBarDateFunctionType, GraphBarDateFunctionType.sumValueIntegral);

    hoursDateGroup = Utils.getEnumKey(GraphDateGroupType, GraphDateGroupType.hours);
    daysDateGroup = Utils.getEnumKey(GraphDateGroupType, GraphDateGroupType.days);
    dateGroupTemplate;

    currentQuery: DaqQuery;
    reloadActive = false;
    static demoValues = [];

    constructor() {
        super();
    }

    ngOnInit() {
        if (!this.barChartOptions) {
            this.barChartOptions = GraphBarComponent.DefaultOptions();
        }
        if (this.isEditor && !GraphBarComponent.demoValues.length) {
            for (let i = 0; i < 100; i++) {
                GraphBarComponent.demoValues[i] = Utils.rand(10, 100);
            }
        }
    }

    ngAfterViewInit() {
        if (this.barChartOptions.panel) {
            this.resize(this.barChartOptions.panel.height, this.barChartOptions.panel.width);
        }
    }

    ngOnDestroy() {
        try {
        } catch (e) {
            console.error(e);
        }
    }

    init(title: string, property: GraphBarProperty, sources?: GraphSource[]) {
        this.title = title;
        this.property = property;
        if (sources) {
            this.setSources(sources);
        }
    }

    setSources(sources: GraphSource[]) {
        this.sourceMap = {};
        this.barChartData = [];
        for (let i = 0; i < sources.length; i++) {
            let dataset = <ChartDataSets>{ label: sources[i].label, data: [], backgroundColor: [sources[i].fill], borderColor: [sources[i].color],
                hoverBackgroundColor: [sources[i].fill], hoverBorderColor: [sources[i].color] };
            this.sourceMap[sources[i].id] = dataset;
            this.barChartData.push(dataset);
        }
        this.sourceCount = sources.length;
    }

    setOptions(options: GraphOptions): void {
        if (options) {
            options.scales.yAxes = [GraphBaseComponent.getAxes((options.type === this.barChartType) ? options.yAxes : options.xAxes)];
            options.scales.xAxes = [GraphBaseComponent.getAxes((options.type === this.barChartType) ? options.xAxes : options.yAxes)];
            // check axes grids property
            for (let i = 0; i < options.scales.xAxes.length; i++) {
                options.scales.xAxes[i].gridLines = GraphBaseComponent.getGridLines(options);
            }
            for (let i = 0; i < options.scales.yAxes.length; i++) {
                options.scales.yAxes[i].gridLines = GraphBaseComponent.getGridLines(options);
            }
            if (options.type) {
                this.barChartType = <ChartType>options.type;
            }
            this.barChartOptions = { ...this.barChartOptions, ...options };
            if (this.barChartOptions.panel) {
                this.resize(this.barChartOptions.panel.height, this.barChartOptions.panel.width);
            }
            if (options.borderWidth) {
                for (let i = 0; i < this.barChartData.length; i++) {
                    this.barChartData[i].borderWidth = options.borderWidth;
                }
            }
            // check labels x axes
            if (this.property) {
                if (this.property.xtype === this.xTypeValue) {
                    this.barChartLabels = [''];
                } else if (this.property.xtype === this.xTypeDate) {
                    this.currentQuery = this.getQuery();
                    this.dateGroupTemplate = this.getFunctionValues(this.property.function, [<TimeValue>{dt: this.currentQuery.from, value: 0}, <TimeValue>{dt: this.currentQuery.to, value: 0}]);
                    this.barChartLabels = this.getDateLabels(this.dateGroupTemplate);
                } else {
                    this.barChartLabels = this.barChartData.map(ds => ds.label);
                }
            }

            this.barChartOptions.title = GraphBaseComponent.getTitle(options, this.title);
            this.chart.update();
            if (!this.isEditor) {
                setTimeout(() => {
                    this.onRefresh();
                }, 500);
            }
            this.setDemo();
        }
    }

    onRefresh(user?: boolean) {
        if (this.isEditor || !this.property) {return false;}
        this.currentQuery = this.getQuery();
        this.onReload.emit(this.currentQuery);
        if (user) {
            this.reloadActive = true;
        }
    }

    resize(height?, width?) {
        if (height && width) {
            this.height = height;
            this.width = width;
            this.barChartOptions.panel.width = width;
            this.barChartOptions.panel.height = height;
        }
    }

    setValue(sigid: string, timestamp: any, sigvalue: any) {
        if (this.sourceMap[sigid]) {
            let dataset = this.sourceMap[sigid];
            if (this.property.xtype === this.xTypeValue) {
                dataset.data[0] = parseFloat(sigvalue).toFixed(this.barChartOptions.decimals);
                this.chart.update(400);
            }
        }
    }

    setValues(sigsid: string[], sigsvalues: any) {
        try {
            if (sigsvalues && this.property) {
                if (this.property.xtype === this.xTypeValue) {
                    for (let i = 0; i < sigsvalues.length; i++) {
                        sigsvalues[i].forEach((v: DaqValue) => {
                            this.setValue(v.id, v.ts, v.value.toFixed(this.barChartOptions.decimals));
                        });
                    }
                } else if (this.property.xtype === this.xTypeDate) {
                    for (let i = 0; i < sigsvalues.length; i++) {
                        let data = [];
                        let fncvalues = this.getFunctionValues(this.property.function, sigsvalues[i]);
                        for (let key in this.dateGroupTemplate) {
                            let k = parseInt(key);
                            if (!fncvalues[k]) {
                                data.push(<ChartPoint>this.dateGroupTemplate[k]);
                            } else {
                                data.push(fncvalues[k].toFixed(this.barChartOptions.decimals));
                            }
                        }
                        let dataset = <ChartDataSets>this.sourceMap[sigsid[i]];
                        dataset.data = data;
                        this.fullDataSetAttribute(dataset);
                    }
                }
            }
        } catch (err) {
            console.error(err);
        }
        this.reloadActive = false;
    }

    isOffline() {
        return this.barChartOptions.offline;
    }

    private setDemo() {
        if (!this.isEditor) {return false;}
        this.barChartData = [];
        for (let key in this.sourceMap) {
            let dataset = this.sourceMap[key];
            if (this.property.xtype === this.xTypeValue) {
                dataset.data = [Utils.rand(10, 100)];
            } else if (this.dateGroupTemplate && this.property.xtype === this.xTypeDate) {
                let datacount = Object.keys(this.dateGroupTemplate).length;
                if (datacount === dataset.data.length) {return false;}
                dataset.data = GraphBarComponent.demoValues.slice(0, datacount);
                this.fullDataSetAttribute(dataset);
            }
            this.barChartData.push(dataset);
        }
    }

    private fullDataSetAttribute(dataset: ChartDataSets) {
        dataset.backgroundColor = Array(dataset.data.length).fill(dataset.backgroundColor[0]);
        dataset.borderColor = Array(dataset.data.length).fill(dataset.borderColor[0]);
        dataset.hoverBackgroundColor = Array(dataset.data.length).fill(dataset.hoverBackgroundColor[0]);
        dataset.hoverBorderColor = Array(dataset.data.length).fill(dataset.hoverBorderColor[0]);
    }

    private getDateLabels(dtlist: any[]): string[] {
        let result = [];
        for (let dt in dtlist) {
            let date = new Date(parseInt(dt));
            result.push(`${date.toLocaleDateString()} ${Utils.formatDate(date, 'HH:mm')}`);
        }
        return result;
    }

    private getFunctionValues(fnc: GraphBarFunction, values: TimeValue[]) {
        if (fnc.type === this.fncSumHourIntegral) {
            if (this.barChartOptions.dateGroup === this.hoursDateGroup) {
                return Calc.integralForHour(values, CollectionType.Hour);
            } else if (this.barChartOptions.dateGroup === this.daysDateGroup) {
                return Calc.integralForHour(values, CollectionType.Day);
            }
        } else if (fnc.type === this.fncValueIntegral) {
            if (this.barChartOptions.dateGroup === this.hoursDateGroup) {
                return Calc.integral(values, CollectionType.Hour);
            } else if (this.barChartOptions.dateGroup === this.daysDateGroup) {
                return Calc.integral(values, CollectionType.Day);
            }
        }
    }

    private getQuery(): DaqQuery {
        let query = new DaqQuery();
        query.gid = this.id;
        if (this.property.xtype === this.xTypeValue) {
            // last value
            query.to = Date.now();
            query.from = query.to;
        } else if (this.property.xtype === this.xTypeDate) {
            query.to = Date.now();
            if (this.barChartOptions.lastRange === Utils.getEnumKey(GraphRangeType, GraphRangeType.last1h)) {
                query.from = new Date(query.to);// - (1 *  60 * 60 * 1000));
                query.from = new Date(query.from.getFullYear(), query.from.getMonth(), query.from.getDate(), query.from.getHours(), 0, 0).getTime();
            } else if (this.barChartOptions.lastRange === Utils.getEnumKey(GraphRangeType, GraphRangeType.last1d)) {
                query.from = new Date(query.to);// - (24 * 60 * 60 * 1000));
                query.from = new Date(query.from.getFullYear(), query.from.getMonth(), query.from.getDate(), 0, 0, 0).getTime();
            } else if (this.barChartOptions.lastRange === Utils.getEnumKey(GraphRangeType, GraphRangeType.last3d)) {
                query.from = new Date(query.to - (3 * 24 * 60 * 60 * 1000));
                query.from = new Date(query.from.getFullYear(), query.from.getMonth(), query.from.getDate(), 0, 0, 0).getTime();
            } else if (this.barChartOptions.lastRange === Utils.getEnumKey(GraphRangeType, GraphRangeType.last1w)) {
                query.from = new Date(query.to - (7 * 24 * 60 * 60 * 1000));
                query.from = new Date(query.from.getFullYear(), query.from.getMonth(), query.from.getDate(), 0, 0, 0).getTime();
            }
        }
        query.sids = Object.keys(this.sourceMap);
        return query;
    }

    public static DefaultOptions() {
        let options = <GraphOptions>{
            type: 'bar',                        // to set in property
            theme: GraphThemeType.light,
            offline: false,
            decimals: 0,
            responsive: true,
            maintainAspectRatio: false,
            tooltips: { enabled: true, intersect: false, },
            title: {
                display: true,
                text: 'Title',
                fontSize: 12,
            },
            gridLinesShow: true,                // to set in property
            yAxes: {                            // to set in property
                display: true,
                min: '0',
                // max: '100',
                stepSize: 20,
                fontSize: 12,
            },
            xAxes: {                            // to set in property
                display: true,
                fontSize: 12,
            },
            scales: {
                yAxes: [{
                    display: true,
                    // stacked: true,
                    ticks: {
                        // suggestedMin: 0
                     },
                }],
                xAxes: [{
                    display: true,
                    // stacked: true,
                    ticks: { },
                }]
            },
            plugins: {
                datalabels: {
                    display: true,
                    anchor: 'end',
                    align: 'end',
                    font: {
                        size: 12,
                    }
                }
            },
            legend: {
                display: true,
                position: 'top',
                align: 'center',
                labels: {
                    fontSize: 12,
                    fontColor: ''
                }
            }
        };
        return options;
    }
}
