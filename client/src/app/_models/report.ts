import { Tag } from "./device";

export class Report {
    id: string;
    name: string;
    receiver?: string;
    scheduling: ReportSchedulingType;
    docproperty: ReportDocProperty;
    content?: ReportContent; 
    constructor(_id: string) {
        this.id = _id;
        this.docproperty = this.defaultDocProperty();
        this.content = <ReportContent> { items: [] };
    }

    defaultDocProperty() {
        return <ReportDocProperty> { 
            pageSize: 'A4',
            pageOrientation: 'portrait',        // landscape 
            pageMargins: [ 60, 60, 40, 60 ],    // [left, top, right, bottom] or [horizontal, vertical] or just a number for equal margins
            fontName: 'Helvetica',
        }
    }
}

export enum ReportSchedulingType {
    day = 'report.scheduling-day',
    week = 'report.scheduling-week',
    month = 'report.scheduling-month',
}

export interface ReportContent {
    items?: ReportItem[];
}

export interface ReportDocProperty {
    paper?: string;
    margin?: ReportPageMargin;
    fontName?: string;
}

export interface ReportPageMargin {
    top: number,
    bottom: number,
    left: number,
    right: number
}

export interface ReportItem {
    type: ReportItemType,
    align?: string,
    width?: number,
    size?: number,
}

export interface ReportItemText extends ReportItem {
    text: string;
}
export interface ReportItemTable extends ReportItem {
    tags: Tag[],
    range: ReportDateRangeType,
}

export enum ReportItemType {
    text = 'report.item-type-text',
    table = 'report.item-type-table',
}

export enum ReportDateRangeType {
    one = 'report.item-daterange-one',
    day = 'report.item-daterange-day',
    week = 'report.item-daterange-week',
    month = 'report.item-daterange-month',
}

export const REPORT_PREFIX = 'r_';
