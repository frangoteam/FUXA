import { Component, ViewChild, OnDestroy, Input } from '@angular/core';

import { GraphBaseComponent } from '../graph-base/graph-base.component';
import { BaseChartDirective } from 'ng2-charts';
import { GraphSource } from '../../../../_models/graph';

@Component({
    selector: 'app-graph-pie',
    templateUrl: './graph-pie.component.html',
    styleUrls: ['./graph-pie.component.css']
})
export class GraphPieComponent extends GraphBaseComponent implements OnDestroy {
    @ViewChild(BaseChartDirective, {static: false}) public chart?: BaseChartDirective;
    @Input() height = 240;
    @Input() width = 380;

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

    ngOnDestroy() {
        try {
        } catch (e) {
            console.error(e);
        }
    }

    init(title: string, property: any, sources?: GraphSource[]) {

    }

    setValue(sigid: string, timestamp: any, sigvalue: any) {

    }
}
