import { Component, ViewChild, OnDestroy, Input, OnInit, AfterViewInit } from '@angular/core';

import { GraphBaseComponent, GraphOptions } from '../graph-base/graph-base.component';
import { BaseChartDirective } from 'ng2-charts';
import { GraphPieProperty, GraphSource } from '../../../../_models/graph';
import { ChartData, ChartType } from 'chart.js';
import DataLabelsPlugin from 'chartjs-plugin-datalabels';

@Component({
    selector: 'app-graph-pie',
    templateUrl: './graph-pie.component.html',
    styleUrls: ['./graph-pie.component.css']
})
export class GraphPieComponent extends GraphBaseComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild(BaseChartDirective, {static: false}) public chart?: BaseChartDirective;
    @Input() height = 380;
    @Input() width = 380;

    pieChartOptions: GraphOptions = {
        responsive: true,
        maintainAspectRatio: false,
    };

    pieChartType: ChartType = 'pie';
    barChartPlugins = [
        DataLabelsPlugin
    ];

    pieData = [300, 500, 100];
    pieChartData: ChartData<'pie', number[], string | string[]> = {
        labels: ['Download Sales', 'In Store Sales', 'Mail Sales'],
        datasets: [
          {
            data: this.pieData,
            backgroundColor: [
                'rgb(154, 162, 235)',
                'rgb(63, 73, 100)',
                'rgb(255, 105, 86)'
            ],
          },
        ],
    };


    id = '';
    isEditor = false;
    title = '';
    property: GraphPieProperty;
    sourceMap = {};

    constructor() {
        super();
    }

    ngOnInit() {
        if (!this.pieChartOptions) {
            this.pieChartOptions = GraphPieComponent.DefaultOptions();
        }
    }

    ngAfterViewInit() {
        if (this.pieChartOptions.panel) {
            this.resize(this.pieChartOptions.panel.height, this.pieChartOptions.panel.width);
        }
    }

    ngOnDestroy() {
        try {
        } catch (e) {
            console.error(e);
        }
    }

    init(title: string, property: any, sources?: GraphSource[]) {
        this.title = title;
        this.property = property;
        if (sources) {
            this.setSources(sources);
        }
    }

    setSources(sources: GraphSource[]) {
        this.sourceMap = {};
        let labels = [];
        this.pieData = [];
        let backgroundColor = [];

        for (let i = 0; i < sources.length; i++) {
            labels.push(sources[i].label || sources[i].name);
            this.pieData.push((i + 1) * 10);
            backgroundColor.push(sources[i].fill);
            this.sourceMap[sources[i].id] = i;
        }
        this.pieChartData.labels = labels;
        this.pieChartData.datasets = [{
            data: this.pieData,
            backgroundColor: backgroundColor,
        }];
    }

    resize(height?, width?) {
        if (height && width) {
            this.height = height;
            this.width = width;
            this.pieChartOptions.panel.width = width;
            this.pieChartOptions.panel.height = height;
        }
    }

    setValue(sigid: string, timestamp: any, sigvalue: any) {
        this.pieData[this.sourceMap[sigid]] = sigvalue;
        this.chart.update(400);
    }

    setOptions(options: GraphOptions): void {
        if (options) {
            this.pieChartOptions = { ...this.pieChartOptions, ...options };
            if (this.pieChartOptions.panel) {
                this.resize(this.pieChartOptions.panel.height, this.pieChartOptions.panel.width);
            }
            this.pieChartOptions.plugins.title.text = GraphBaseComponent.getTitle(options, this.title);
        }
    }

    public static DefaultOptions() {
        let options = <GraphOptions>{
            type: 'pie',
            plugins: {
                title: {
                    display: true,
                    text: 'Title',
                    font: {
                        size: 12
                    }
                },
                tooltip: {
                    enabled: true,
                    intersect: false
                },
                legend: {
                    display: true,
                    position: 'top',
                    align: 'center',
                    labels: {
                        font: {
                            size: 12
                        },
                        color: ''
                    }
                },
                datalabels: {
                    display: true,
                    anchor: 'end',
                    align: 'end',
                    font: {
                        size: 12,
                    }
                }
            }
        };
        return options;
    }
}
