import { Tag } from "./device";

export class Report {
    id: string;
    name: string;
    receiver?: string;
    scheduling: ReportSchedulingType;
    content?: ReportContent; 
    constructor(_id: string) {
        this.id = _id;
        this.content = this.defaultContent();
    }

    defaultContent() {
        return <ReportContent> { 
            paper: 'A4',
            margin: <ReportPageMargin> {
                top: 20,
                bottom: 20,
                left: 40,
                right: 20
            },
            fontName: 'Helvetica',
            items: []
        }
    }
}

export enum ReportSchedulingType {
    day = 'report.scheduling-day',
    week = 'report.scheduling-week',
    month = 'report.scheduling-month',
}

export interface ReportContent {
    paper?: string;
    margin?: ReportPageMargin;
    fontName?: string;
    items?: ReportItem[];
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

export interface ReportItemTable extends ReportItem {
    tags: Tag[],
    from: number,
    to: number,
}

export enum ReportItemType {
    text = 'report.item-type-text',
    table = 'report.item-type-table',
}

export const REPORT_PREFIX = 'r_';
