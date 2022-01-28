import { Component, OnInit, AfterViewInit, ViewChild, OnDestroy, Input } from '@angular/core';

import { GraphBaseComponent, GraphOptions, GraphThemeType } from '../graph-base/graph-base.component';
import { GraphBarProperty, GraphBarXType, GraphSource } from '../../../../_models/graph';
import { Utils } from '../../../../_helpers/utils';
import { ChartOptions, ChartType, ChartDataSets } from 'chart.js';
import { Label, BaseChartDirective } from 'ng2-charts';
import * as pluginDataLabels from 'chartjs-plugin-datalabels';

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
            this.barChartOptions.title = GraphBaseComponent.getTitle(options, this.title);
            this.chart.update();
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
                dataset.data[0] = sigvalue;
                this.chart.update(400);
            }
        }
    }

    public static DefaultOptions() {
        let options = <GraphOptions>{
            type: 'bar',                        // to set in property
            theme: GraphThemeType.light,
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
                max: '100', 
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