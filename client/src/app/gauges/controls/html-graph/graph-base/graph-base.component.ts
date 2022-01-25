
import { Component } from '@angular/core';
import { GraphType, GraphSource } from '../../../../_models/graph';
import { ChartOptions } from 'chart.js';

@Component({
    template: ''
})
export class GraphBaseComponent {
    id: string;
    isEditor: boolean;

    init? (title: string, property: any, sources?: GraphSource[]): void;
    setOptions? (options: any): void;
    setValue? (sigid: string, timestamp: any, sigvalue: any): void;
}

export interface GraphOptions extends ChartOptions {
    panel?: { height: number, width: number };
    titleDisplay?: boolean,
    type?: string,
    yAxes?: {
        min: string
        max: string,
        stepSize: string,
        fontSize: string,
        fontColor: string
    },
    xAxes?: {
        fontSize: string,
        fontColor: string
    },
    gridLines?: {
        display: boolean,
        color: string,
    },
    legend?: {
        display: boolean,
        labels: {
            fontColor: string
        }
    }
}