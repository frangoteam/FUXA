import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';

import { ChartData, ChartOptions } from 'chart.js';
import { NgxChartjsComponent } from './../../../../gui-helpers/ngx-chartjs/ngx-chartjs.component';

@Component({
    selector: 'app-graph-pie',
    templateUrl: './graph-pie.component.html',
    styleUrls: ['./graph-pie.component.css']
})
export class GraphPieComponent implements OnInit, OnDestroy {
    @ViewChild('ngchart') public ngchart: NgxChartjsComponent;

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
    constructor() { }

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
}
