import { Utils } from '../_helpers/utils';
import { Tag } from './device';
import { Chart } from './chart';
export class Report {
    id: string;
    name: string;
    receiver?: string;
    scheduling: string;
    docproperty: ReportDocProperty;
    content?: ReportContent;
    constructor(_id: string) {
        this.id = _id;
        this.docproperty = this.defaultDocProperty();
        this.scheduling = Utils.getEnumKey(ReportSchedulingType, ReportSchedulingType.week);
        this.content = <ReportContent> { items: [] };
    }

    defaultDocProperty() {
        return <ReportDocProperty> {
            pageSize: 'A4',
            pageOrientation: 'portrait',        // landscape
            pageMargins: [ 60, 40, 40, 40 ],    // [left, top, right, bottom] or [horizontal, vertical] or just a number for equal margins
            fontName: 'Helvetica',
        };
    }
}

export enum ReportSchedulingType {
    none = 'report.scheduling-none',
    day = 'report.scheduling-day',
    week = 'report.scheduling-week',
    month = 'report.scheduling-month',
}

export interface ReportContent {
    items?: ReportItem[];
}

export interface ReportDocProperty {
    pageSize: string;
    pageOrientation: string;
    pageMargins: number[];
    fontName: string;
}

export interface ReportPageMargin {
    top: number;
    bottom: number;
    left: number;
    right: number;
}

export interface ReportItem {
    type: ReportItemType;
    align?: string;
    width?: number;
    size?: number;
}

export interface ReportItemText extends ReportItem {
    text: string;
}
export interface ReportItemTable extends ReportItem {
    columns: ReportTableColumn[];
    range: ReportDateRangeType;
    interval: ReportIntervalType;
}

export interface ReportTableColumn {
    type: ReportTableColumnType;
    tag: Tag;
    label: string;
    align: string;
    width: string;
    function: ReportFunctionType;
}

export enum ReportTableColumnType {
    timestamp = 0,
    tag = 1,
}

export interface ReportItemAlarms extends ReportItem {
    priority: {};
    priorityText: {};
    property: {};
    propertyText: {};
    statusText: {};
    range: ReportDateRangeType;
    alarmFilter: string[];
}

export interface ReportItemChart extends ReportItem {
    chart: Chart;
    range: ReportDateRangeType;
    width?: number;
    height?: number;
}

export enum ReportItemType {
    text = 'report.item-type-text',
    table = 'report.item-type-table',
    alarms = 'report.item-type-alarms',
    chart = 'report.item-type-chart',
}

export enum ReportDateRangeType {
    one = 'report.item-daterange-none',
    day = 'report.item-daterange-day',
    week = 'report.item-daterange-week',
    month = 'report.item-daterange-month',
}

export enum ReportIntervalType {
    min5 = 'report.item-interval-min5',
    min10 = 'report.item-interval-min10',
    min30 = 'report.item-interval-min30',
    hour = 'report.item-interval-hour',
    day = 'report.item-interval-day',
}

export enum ReportFunctionType {
    min = 'report.item-function-min',
    max = 'report.item-function-max',
    average = 'report.item-function-average',
    sum = 'report.item-function-sum',
}

export const REPORT_PREFIX = 'r_';
