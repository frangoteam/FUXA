
import { Component, Output, EventEmitter } from '@angular/core';
import { GraphSource, GraphRangeType, GraphDateGroupType } from '../../../../_models/graph';
import { ChartOptions, GridLineOptions, ChartType } from 'chart.js';
import { DaqQuery } from '../../../../_models/hmi';
@Component({
    template: ''
})
export class GraphBaseComponent {
    @Output() onReload: EventEmitter<DaqQuery> = new EventEmitter();

    id: string;
    isEditor: boolean;
    public static VerticalBarChartType: ChartType = 'bar';
    public static PieChartType: ChartType = 'pie';

    init? (title: string, property: any, sources?: GraphSource[]): void;
    setOptions? (options: any): void;
    setValue?(sigid: string, timestamp: any, sigvalue: any): void;
    setValues?(sigsid: string[], sigsvalues: any): void;
    isOffline(): boolean { return false; }

    public static getGridLines(options: GraphOptions): GridLineOptions {
        let result = <GridLineOptions>{ display: options.gridLinesShow };
        if (options.gridLinesColor) {
            result.color = options.gridLinesColor;
            //result.zeroLineColor = options.gridLinesColor;
        }
        return result;
    }

    public static getTitle(options: GraphOptions, title: string): string | string[] {
        if (title) {
            options.plugins.title.text = title;
        }
        return options.plugins.title.text;
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
    plugins?: any;
    scales?: any;
    backgroundColor?: string;
}
