
import { Component, Output, EventEmitter } from '@angular/core';
import { GraphType, GraphSource, GraphRangeType, GraphDateGroupType } from '../../../../_models/graph';
import { ChartOptions, GridLineOptions, ChartType, ChartColor, ChartYAxe } from 'chart.js';
import { Utils } from '../../../../_helpers/utils';
import { DaqQuery } from '../../../../_models/hmi';
@Component({
    template: ''
})
export class GraphBaseComponent {
    @Output() onReload: EventEmitter<DaqQuery> = new EventEmitter();

    id: string;
    isEditor: boolean;
    public static VerticalBarChartType: ChartType = 'bar';

    init? (title: string, property: any, sources?: GraphSource[]): void;
    setOptions? (options: any): void;
    setValue?(sigid: string, timestamp: any, sigvalue: any): void;
    setValues?(sigsid: string[], sigsvalues: any): void;
    isOffline(): boolean { return false; }

    public static getGridLines(options: GraphOptions): GridLineOptions {
        let result = <GridLineOptions>{ display: options.gridLinesShow };
        if (options.gridLinesColor) {
            result.color = options.gridLinesColor;
            result.zeroLineColor = options.gridLinesColor;
        }
        return result;
    }

    public static getTitle(options: GraphOptions, title: string): GridLineOptions {
        if (title) {
            options.title.text = title;
        }
        return options.title;
    }

    public static getAxes(axesres: any): ChartYAxe {
        let result = <ChartYAxe>{ display: axesres.display, ticks: { } };
        if (Utils.isNumeric(axesres.fontSize)) {
            result.ticks.fontSize = axesres.fontSize;
        }
        if (Utils.isNumeric(axesres.stepSize)) {
            result.ticks.stepSize = axesres.stepSize;
        }
        if (Utils.isNumeric(axesres.min)) {
            result.ticks.min = parseFloat(axesres.min);
        }
        if (Utils.isNumeric(axesres.max)) {
            result.ticks.max = parseFloat(axesres.max);
        }
        if (axesres.fontColor) {
            result.ticks.fontColor = axesres.fontColor;
        }
        return result;
    }
}

export enum GraphThemeType {
    customise = 'customise',
    dark = 'dark',
    light = 'light'
}

export interface GraphOptions extends ChartOptions {
    panel?: { height: number; width: number };
    type?: ChartType;
    theme?: string;
    offline?: boolean;
    decimals?: number;
    lastRange?: GraphRangeType;
    dateGroup?: GraphDateGroupType;
    borderWidth?: number;
    gridLinesShow?: boolean;
    gridLinesColor?: string;
    yAxes?: {
        display?: boolean;
        min: string;
        max: string;
        stepSize: number;
        fontSize: number;
        fontColor: string;
    };
    xAxes?: {
        display?: boolean;
        fontSize: number;
        fontColor: string;
    };
    legend?: {
        display?: boolean;
        position?: any;
        align?: any;
        labels?: {
            fontColor?: ChartColor;
            fontSize?: number;
        };
    };
}
