import { Injectable } from '@angular/core';

import * as FileSaver from 'file-saver';

@Injectable({
    providedIn: 'root'
})
export class DataConverterService {

    static readonly columnDelimiter = ',';
    static readonly lineDelimiter = '\n';

    constructor() { }

    exportTagsData(data: DataTableContent) {
        let content = '';
        const type = 'csv';
        let filename = `${data.name}.${type}`;
        if (type === 'csv') {
            for (let col = 0; col < data.columns.length; col++) {
                content += `${data.columns[col].header}`;
                if (col < data.columns.length - 1) {
                    content += `${DataConverterService.columnDelimiter}`;
                }
            }
            content += `${DataConverterService.lineDelimiter}`;
            for (let row = 0; row < data.columns[0].values.length; row++) {
                for (let col = 0; col < data.columns.length; col++) {
                    content += `${data.columns[col].values[row]}`;
                    if (col < data.columns.length - 1) {
                        content += `${DataConverterService.columnDelimiter}`;
                    }
                }
                content += `${DataConverterService.lineDelimiter}`;
            }
        }
        let blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        FileSaver.saveAs(blob, filename);
    }
}


export interface DataTableContent {
    name: string;
    columns: DataTableColumn[];
}

export interface DataTableColumn {
    header: string;
    values: string[];
}
