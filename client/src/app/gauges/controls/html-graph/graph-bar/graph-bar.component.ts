import { Component, OnInit, AfterViewInit, ViewChild, OnDestroy, ElementRef, Input } from '@angular/core';

// import { ChartOptions } from 'chart.js';
import { GraphBaseComponent, GraphOptions } from '../graph-base/graph-base.component';
import { GraphBarProperty, GraphBarXType, GraphSource } from '../../../../_models/graph';
import { Utils } from '../../../../_helpers/utils';
import { ChartOptions, ChartType, ChartDataSets, ChartTitleOptions } from 'chart.js';
import { Label, BaseChartDirective } from 'ng2-charts';
@Component({
    selector: 'graph-bar',
    templateUrl: './graph-bar.component.html',
    styleUrls: ['./graph-bar.component.css']
})
export class GraphBarComponent extends GraphBaseComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild(BaseChartDirective) public chart?: BaseChartDirective;
    @Input() height = 240;
    @Input() width = 380;

    public barChartOptions: GraphOptions = {
        responsive: true,
        maintainAspectRatio: false,
        title: {
            display: true,
            text: 'asdfasdf'
        }
    };

    public barChartLabels: Label[] = ['2006', '2007', '2008', '2009', '2010', '2011', '2012'];
    public barChartType: ChartType = 'bar';
    public barChartLegend = true;
    public barChartPlugins = [];

    public barChartData: ChartDataSets[] = [
        { data: [65, 59, 80, 81, 56, 55, 40], label: 'Series A' },
        { data: [28, 48, 40, 19, 86, 27, 90], label: 'Series B' }
    ];

    private VerticalType: ChartType = 'bar';

    id = '';
    isEditor = false;
    property: GraphBarProperty;
    sourceMap = {};
    sourceCount = 0;
    xTypeValue = Utils.getEnumKey(GraphBarXType, GraphBarXType.value);

    constructor() {
        super();
    }

    ngOnInit() {
        if (!this.barChartOptions) {
            this.barChartOptions = GraphBarComponent.DefaultOptions();
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
        this.barChartPlugins[0] = { title: { text: title, display: true } };
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
            if (this.isEditor) {
                if (this.property.xtype === this.xTypeValue) {
                    dataset.data = [Utils.rand(10, 100)];
                }
            }
            this.sourceMap[sources[i].id] = dataset;
            this.barChartData.push(dataset);
        }
        this.sourceCount = sources.length;
        if (this.property.xtype === this.xTypeValue) {
            this.barChartLabels = [''];
        } else {
            this.barChartLabels = this.barChartData.map(ds => { return ds.label });
        }
    }

    setOptions(options: GraphOptions): void {
        if (options) {
            if (options.yAxes) {
                if (Utils.isNumeric(options.yAxes.min)) {
                    options.scales.yAxes[0].ticks.min = parseFloat(options.yAxes.min);
                    options.scales.xAxes[0].ticks.min = parseFloat(options.yAxes.min);
                } else {
                    delete options.scales.yAxes[0].ticks.min;
                    delete options.scales.xAxes[0].ticks.min;
                }
                if (Utils.isNumeric(options.yAxes.max)) {
                    options.scales.yAxes[0].ticks.max = parseFloat(options.yAxes.max);
                    options.scales.xAxes[0].ticks.max = parseFloat(options.yAxes.max);
                } else {
                    delete options.scales.yAxes[0].ticks.max;
                    delete options.scales.xAxes[0].ticks.max;
                }
                if (Utils.isNumeric(options.yAxes.stepSize)) {
                    options.scales.yAxes[0].ticks.stepSize = parseFloat(options.yAxes.stepSize);
                    options.scales.xAxes[0].ticks.stepSize = parseFloat(options.yAxes.stepSize);
                } else {
                    delete options.scales.yAxes[0].ticks.stepSize;
                    delete options.scales.xAxes[0].ticks.stepSize;
                }
                if (options.type === this.barChartType) {
                    if (Utils.isNumeric(options.yAxes.fontSize)) {
                        options.scales.yAxes[0].ticks.fontSize = parseInt(options.yAxes.fontSize);
                    } else {
                        delete options.scales.yAxes[0].ticks.fontSize;
                    }
                    if (Utils.isNumeric(options.xAxes.fontSize)) {
                        options.scales.xAxes[0].ticks.fontSize = parseInt(options.xAxes.fontSize);
                    } else {
                        delete options.scales.xAxes[0].ticks.fontSize;
                    }
                } else if (options.type !== this.barChartType) {
                    if (Utils.isNumeric(options.yAxes.fontSize)) {
                        options.scales.xAxes[0].ticks.fontSize = parseInt(options.yAxes.fontSize);
                    } else {
                        delete options.scales.xAxes[0].ticks.fontSize;
                    }
                    if (Utils.isNumeric(options.xAxes.fontSize)) {
                        options.scales.yAxes[0].ticks.fontSize = parseInt(options.xAxes.fontSize);
                    } else {
                        delete options.scales.yAxes[0].ticks.fontSize;
                    }
                }
            }
            if (options.type) {
                this.barChartType = <ChartType>options.type;
            }
            this.barChartOptions = { ...this.barChartOptions, ...options };
            if (this.barChartOptions.panel) {
                this.resize(this.barChartOptions.panel.height, this.barChartOptions.panel.width);
            }
            // if (options.titleDisplay) {
            // }
            this.chart.update();
        }
    }

    resize(height?, width?) {
        if (height && width) {
            this.height = height;
            this.width = width;
            this.barChartOptions.panel.width = width;
            this.barChartOptions.panel.height = height;
            // this.ngchart.nativeElement.clientHeight = height;
            // this.ngchart.update();
        } else {
            // this.ngchart.updateChart('resize');
        }
    }

    setValue(sigid: string, timestamp: any, sigvalue: any) {
        if (this.sourceMap[sigid]) {
            let dataset = this.sourceMap[sigid];
            if (this.property.xtype === this.xTypeValue) {
                dataset.data[0] = sigvalue;
            }
        }
    }

    public static DefaultOptions() {
        let options = <GraphOptions>{
            type: 'bar',                                        // to set in property
            // responsive: true,
            maintainAspectRatio: false,
            titleDisplay: true,
            yAxes: { min: '0', max: '100', stepSize: '20' },    // to set in property
            xAxes: { },
            scales: {
                yAxes: [{
                    display: true,
                    // stacked: true,
                    ticks: {
                        suggestedMin: 0,
                     },
                }],
                xAxes: [{
                    display: true,
                    // stacked: true,
                    ticks: { },
                }]
            },
        };
        return options;
    }
}