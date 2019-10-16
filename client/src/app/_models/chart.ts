
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