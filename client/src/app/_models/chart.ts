
export class Chart {
    id: string;
    name: string;
    lines: ChartLine[];
}

export class ChartLine {
    device: string;
    id: string;
    name: string;
    color: string;
}

export enum ChartViewType {
    realtime1 = 'chart.viewtype-realtime1',
    history = 'chart.viewtype-history'
}

export enum ChartRangeType {
    last8h = 'chart.rangetype-last8h',
    last1d = 'chart.rangetype-last1d',
    last3d = 'chart.rangetype-last2d',
    last1w = 'chart.rangetype-last1w'
}