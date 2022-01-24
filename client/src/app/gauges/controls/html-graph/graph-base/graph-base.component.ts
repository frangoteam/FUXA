
import { Component } from '@angular/core';
import { GraphType, GraphSource } from '../../../../_models/graph';
import { ChartOptions } from 'chart.js';

@Component({
    template: ''
})
export class GraphBaseComponent {
    id: string;
    isEditor: boolean;

    init? (property: any, sources?: GraphSource[]): void;
    setOptions? (options: any): void;
    addDataSet? (sigid: string, signame: string, source: any): void;
    setValue? (sigid: string, timestamp: any, sigvalue: any): void;
}

export interface GraphOptions extends ChartOptions {
    panel?: { height: number, width: number };
    yAxes?: {
        min: '0'
        max: '100',
    }
}