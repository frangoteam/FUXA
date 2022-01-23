import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';

import { ChartOptions } from 'chart.js';
import { NgxChartjsComponent } from './../../../../gui-helpers/ngx-chartjs/ngx-chartjs.component';
import { GraphBaseComponent } from '../graph-base/graph-base.component';
import { GraphBarProperty, GraphBarXType, GraphSource } from '../../../../_models/graph';
import { Utils } from '../../../../_helpers/utils';

@Component({
    selector: 'graph-bar',
    templateUrl: './graph-bar.component.html',
    styleUrls: ['./graph-bar.component.css']
})
export class GraphBarComponent extends GraphBaseComponent implements OnInit, OnDestroy {

    @ViewChild('ngchart') public ngchart: NgxChartjsComponent;

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
                ['rgb(54, 162, 235)', 'rgb(54, 162, 235)', 'rgb(54, 162, 235)', 'rgb(54, 162, 235)', 'rgb(54, 162, 235)'])]};

    data: ChartData = this.datademo;

    options: ChartOptions = {
        // responsive: true,
        // maintainAspectRatio: false,
        scales: {  
            yAxes: [{
                display: true,
                // stacked: true,
                ticks: {
                    // beginAtZero: true,
                    suggestedMin: 0,
                    // min: 0, // minimum value
                    max: 260, // maximum value
                    stepSize: 20,
                },
            }] 
        },
    };

    constructor() { 
        super();
    }

    ngOnInit() {
        this.update();
    }

    ngOnDestroy() {
        try {
            if (this.ngchart) {
                this.ngchart.ngOnDestroy();
            }
            delete this.ngchart;
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
        this.data = new ChartData();
        for (let i = 0; i < sources.length; i++) {
            let dataset = new DataSet(sources[i].label, [], [sources[i].fill], [sources[i].color]);
            if (this.isEditor) {
                if (this.property.xtype === this.xTypeValue) {
                    dataset.data.push(Utils.rand(10, 100));
                }
            }
            this.sourceMap[sources[i].id] = dataset;
            this.data.datasets.push(dataset);
        }
        this.sourceCount = sources.length;
        if (this.property.xtype === this.xTypeValue) {
            this.data.labels = [];
        } else {
            this.data.labels = this.data.datasets.map(ds => {return ds.label});
        }
    }

    addDataSet(sigid: string, signame: string, source: any) {
        this.update();
    }

    update() {
        this.ngchart.data = this.data;
        this.ngchart.updateChart();
    }

    resize(height?, width?) {
        if (height && width) {
            this.ngchart.resize(width, height);
            this.ngchart.updateChart();
        } else {
            this.ngchart.updateChart('resize');
        }
    }

    setValue (sigid: string, timestamp: any, sigvalue: any) {
        if (this.sourceMap[sigid]) {
            let dataset = this.sourceMap[sigid];
            if (this.property.xtype === this.xTypeValue) {
                dataset.data[0] = sigvalue;
            }
            this.ngchart.updateChart();
        }
    }
}

export class ChartData {
    labels: string[];
    datasets: DataSet[];

    constructor () {
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
