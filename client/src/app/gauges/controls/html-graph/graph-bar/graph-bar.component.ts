import { Component, OnInit, AfterViewInit, ViewChild, OnDestroy, ElementRef, Input } from '@angular/core';

// import { ChartOptions } from 'chart.js';
import { GraphBaseComponent, GraphOptions } from '../graph-base/graph-base.component';
import { GraphBarProperty, GraphBarXType, GraphSource } from '../../../../_models/graph';
import { Utils } from '../../../../_helpers/utils';
import { ChartOptions, ChartType, ChartDataSets } from 'chart.js';
import { Label, BaseChartDirective } from 'ng2-charts';
@Component({
    selector: 'graph-bar',
    templateUrl: './graph-bar.component.html',
    styleUrls: ['./graph-bar.component.css']
})
export class GraphBarComponent extends GraphBaseComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('ngchart') public ngchart: BaseChartDirective;
    @Input() height = 240;
    @Input() width = 380;

    public barChartOptions: GraphOptions = {
        // responsive: true,
        maintainAspectRatio: false,
        // panel: { height: 240, width: 380 }
    };
    public barChartLabels: Label[] = ['2006', '2007', '2008', '2009', '2010', '2011', '2012'];
    public barChartType: ChartType = 'bar';
    public barChartLegend = true;
    public barChartPlugins = [];

    public barChartData: ChartDataSets[] = [
        { data: [65, 59, 80, 81, 56, 55, 40], label: 'Series A' },
        { data: [28, 48, 40, 19, 86, 27, 90], label: 'Series B' }
    ];

    id = '';
    isEditor = false;
    property: GraphBarProperty;
    sourceMap = {};
    sourceCount = 0;
    xTypeValue = Utils.getEnumKey(GraphBarXType, GraphBarXType.value);

    datademo: ChartData = {
        labels: ['January', 'February', 'March', 'April', 'May'],
        datasets: [new DataSet('A', [65, 35, 12, 33, 54],
            ['rgba(255, 99, 132, 0.2)', 'rgba(255, 99, 132, 0.2)', 'rgba(255, 99, 132, 0.2)', 'rgba(255, 99, 132, 0.2)', 'rgba(255, 99, 132, 0.2)'],
            ['rgb(255, 99, 132)', 'rgb(255, 99, 132)', 'rgb(255, 99, 132)', 'rgb(255, 99, 132)', 'rgb(255, 99, 132)']),
        new DataSet('B', [59, 12, 80, 81, 56],
            ['rgba(54, 162, 235, 0.2)', 'rgba(54, 162, 235, 0.2)', 'rgba(54, 162, 235, 0.2)', 'rgba(54, 162, 235, 0.2)', 'rgba(54, 162, 235, 0.2)'],
            ['rgb(54, 162, 235)', 'rgb(54, 162, 235)', 'rgb(54, 162, 235)', 'rgb(54, 162, 235)', 'rgb(54, 162, 235)'])]
    };

    data: ChartData = this.datademo;

    constructor() {
        super();
    }

    ngOnInit() {
        if (!this.barChartOptions) {
            this.barChartOptions = GraphBarComponent.DefaultOptions();
        }
        this.update();
    }
    
    ngAfterViewInit() {
        if (this.barChartOptions.panel) {
            this.resize(this.barChartOptions.panel.height, this.barChartOptions.panel.width);
        }
    }

    ngOnDestroy() {
        try {
            // if (this.ngchart) {
            //     this.ngchart.ngOnDestroy();
            // }
            // delete this.ngchart;
        } catch (e) {
            console.error(e);
        }
    }

    init(property: GraphBarProperty, sources?: GraphSource[]) {
        this.property = property;
        if (sources) {
            this.setSources(sources);
        }
        this.update();
    }

    setSources(sources: GraphSource[]) {
        this.sourceMap = {};
        this.barChartData = [];
        for (let i = 0; i < sources.length; i++) {
            let dataset = new DataSet(sources[i].label, [], [sources[i].fill], [sources[i].color]);
            if (this.isEditor) {
                if (this.property.xtype === this.xTypeValue) {
                    dataset.data.push(Utils.rand(10, 100));
                }
            }
            this.sourceMap[sources[i].id] = dataset;
            this.barChartData.push(dataset);
        }
        this.sourceCount = sources.length;
        if (this.property.xtype === this.xTypeValue) {
            this.barChartLabels = [];
        } else {
            this.barChartLabels = this.data.datasets.map(ds => { return ds.label });
        }
    }

    setOptions(options: GraphOptions): void {
        if (options) {
            if (options.yAxes) {
                if (Utils.isNumeric(options.yAxes.min)) {
                    options.scales.yAxes[0].ticks.min = parseFloat(options.yAxes.min);
                } else {
                    delete options['scales']['yAxes'][0]['ticks'].min;
                }
                if (Utils.isNumeric(options.yAxes.max)) {
                    options['scales']['yAxes'][0]['ticks'].max = parseFloat(options.yAxes.max);
                } else {
                    delete options['scales']['yAxes'][0]['ticks'].max;
                }
            }
            this.barChartOptions = { ...this.barChartOptions, ...options };
            if (this.barChartOptions.panel) {
                this.resize(this.barChartOptions.panel.height, this.barChartOptions.panel.width);
            }
        }
    }


    addDataSet(sigid: string, signame: string, source: any) {
        this.update();
    }

    update() {
        // this.ngchart.data = this.data;
        // this.ngchart.updateChart();
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
            // this.ngchart.updateChart();
        }
    }

    public static DefaultOptions() {
        let options = <GraphOptions>{
            // responsive: true,
            maintainAspectRatio: false,
            yAxes: { min: '0', max: '100' },
            scales: {
                yAxes: [{
                    display: true,
                    // stacked: true,
                    ticks: {
                        // beginAtZero: true,
                        suggestedMin: 0,
                        // max: 260, // maximum value
                        stepSize: 20,
                    },
                }]
            },
        };
        return options;
    }
}

export class ChartData {
    labels: string[];
    datasets: DataSet[];

    constructor() {
        this.labels = [];
        this.datasets = [];
    }
}
export class DataSet {
    label: string;
    data: number[];
    fill?: boolean = true;
    backgroundColor: string[];
    borderColor?: string[];
    borderWidth?: number = 1;

    constructor(label: string, data: number[], backgroundColor: string[], borderColor: string[]) {
        this.label = label;
        this.data = data;
        this.backgroundColor = backgroundColor;
        this.borderColor = borderColor;
    }
}