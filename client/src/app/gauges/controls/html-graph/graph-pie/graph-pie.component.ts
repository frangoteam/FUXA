import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';

import { ChartData, ChartOptions } from 'chart.js';
import { GraphBaseComponent } from '../graph-base/graph-base.component';
import { Label, BaseChartDirective } from 'ng2-charts';

@Component({
    selector: 'app-graph-pie',
    templateUrl: './graph-pie.component.html',
    styleUrls: ['./graph-pie.component.css']
})
export class GraphPieComponent extends GraphBaseComponent implements OnInit, OnDestroy {
    @ViewChild('ngchart') public ngchart: BaseChartDirective;

    id = '';
    isEditor = false;

    data = {
        labels: ['Red', 'Green', 'Yellow'],
        datasets: [
            {
                data: [300, 50, 100],
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56'],
                hoverBackgroundColor: ['#FF6384', '#36A2EB', '#FFCE56'],
            },
        ],
    };
    constructor() {
        super();
    }

    ngOnInit() {
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

    init(property: any) {

    }

    addDataSet(sigid: string, signame: string, source: any) {
        
    }

    setValue (sigid: string, timestamp: any, sigvalue: any) {
        
    }
}
