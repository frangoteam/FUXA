import { Tag } from "./device";

export class Report {
    id: string;
    name: string;
    receiver?: string;
    scheduling: ReportScheduling;
    content?: ReportContent; 
    constructor(_id: string) {
        this.id = _id;
    }    
}

export interface ReportScheduling {
    interval: number;
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
