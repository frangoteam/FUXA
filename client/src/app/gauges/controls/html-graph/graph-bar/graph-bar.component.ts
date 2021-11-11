import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';

import { ChartData, ChartOptions } from 'chart.js';
import { NgxChartjsComponent } from './../../../../gui-helpers/ngx-chartjs/ngx-chartjs.component';

@Component({
    selector: 'app-graph-bar',
    templateUrl: './graph-bar.component.html',
    styleUrls: ['./graph-bar.component.css']
})
export class GraphBarComponent implements OnInit, OnDestroy {

    @ViewChild('ngchart') public ngchart: NgxChartjsComponent;

    data: ChartData = {
        labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
        datasets: [
            {
                label: 'My First Dataset',
                data: [65, 59, 80, 81, 56, 55, 40],
                fill: false,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.2)',
                    'rgba(255, 159, 64, 0.2)',
                    'rgba(255, 205, 86, 0.2)',
                    'rgba(75, 192, 192, 0.2)',
                    'rgba(54, 162, 235, 0.2)',
                    'rgba(153, 102, 255, 0.2)',
                    'rgba(201, 203, 207, 0.2)',
                ],
                borderColor: [
                    'rgb(255, 99, 132)',
                    'rgb(255, 159, 64)',
                    'rgb(255, 205, 86)',
                    'rgb(75, 192, 192)',
                    'rgb(54, 162, 235)',
                    'rgb(153, 102, 255)',
                    'rgb(201, 203, 207)',
                ],
                borderWidth: 1,
            },
        ],
    };

    options: ChartOptions = {
        // responsive: true,
        // maintainAspectRatio: false,
        // scales: { y: { beginAtZero: true } },
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
