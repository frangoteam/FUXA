
export class Chart {
    id: string;
    name: string;
    lines: ChartLine[];
}

export class ChartLine {
    device: string;
    id: string;
    name: string;
    label: string;
    color: string;
    fill?: string;
    yaxis: number;
    lineInterpolation?: number;
}

export enum ChartViewType {
    realtime1 = 'realtime1',
    history = 'history',
    custom = 'custom'
}

export enum ChartRangeType {
    last1h = 'chart.rangetype-last1h',  // add by J
    last2h = 'chart.rangetype-last2h',  // add by J
    last4h = 'chart.rangetype-last4h',  // add by J
    last8h = 'chart.rangetype-last8h',
    last1d = 'chart.rangetype-last1d',
    last3d = 'chart.rangetype-last3d',
    last1w = 'chart.rangetype-last1w'
}

export enum ChartLegendMode {
    always = 'chart.legend-always',
    follow = 'chart.legend-follow',
    bottom = 'chart.legend-bottom',
    // onmouseover = 'chart.legend-onmouseover',
    never = 'chart.legend-never'
}

export class ChartRangeConverter {
    static ChartRangeToHours(crt: ChartRangeType) {
        let types = Object.keys(ChartRangeType);
        if (crt === types[0]) {         // ChartRangeType.last1h) {
            return 1;
        } else if (crt === types[1]) {  // ChartRangeType.last2h) {
            return 2;
        } else if (crt === types[2]) {  // ChartRangeType.last4h) {
            return 4;
        } else if (crt === types[3]) {  // ChartRangeType.last8h) {
            return 8;
        } else if (crt === types[4]) {  // ChartRangeType.last1d) {
            return 24;
        } else if (crt === types[5]) {  // ChartRangeType.last3d) {
            return 24 * 3;
        } else if (crt === types[6]) {  // ChartRangeType.last1w) {
            return 24 * 7;
        }
        return 0;
    }
}
