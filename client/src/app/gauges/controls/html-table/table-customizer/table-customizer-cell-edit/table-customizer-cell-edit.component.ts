import { Component, Inject } from '@angular/core';
import { TableCell, TableCellType, TableType } from '../../../../../_models/hmi';
import { ProjectService } from '../../../../../_services/project.service';
import { MatDialogRef as MatDialogRef, MAT_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-table-customizer-cell-edit',
    templateUrl: './table-customizer-cell-edit.component.html',
    styleUrls: ['./table-customizer-cell-edit.component.css']
})
export class TableCustomizerCellEditComponent {

    tableType = TableType;
    cellType = TableCustomizerCellRowType;
    columnType = TableCellType;
    devicesValues = { devices: null };
    dateTimeFormatsLabel = '';

    constructor(
        private projectService: ProjectService,
        private translateService: TranslateService,
        public dialogRef: MatDialogRef<TableCustomizerCellEditComponent>,
        @Inject(MAT_DIALOG_DATA) public data: TableCustomizerCellType) {

        this.devicesValues.devices = Object.values(this.projectService.getDevices());
        this.dateTimeFormatsLabel = this.translateService.instant('table.cell-ts-format');
        if (this.isHistory()) {
            this.dateTimeFormatsLabel += this.translateService.instant('table.cell-ts-interval');
        }
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {

        this.dialogRef.close(this.data);
    }

    onSetVariable(event) {
        this.data.cell.variableId = event.variableId;
        this.data.cell.bitmask = event.bitmask;
        if (this.data.table === TableType.data) {
            if (event.variableRaw) {
                this.data.cell.label = event.variableRaw.name;
                if (this.data.cell.type === TableCellType.device) {
                    let device = this.projectService.getDeviceFromTagId(event.variableId);
                    this.data.cell.label = device ? device.name : '';
                }
            } else {
                this.data.cell.label = null;
            }
        } else if (this.data.table === TableType.history) {
            if (event.variableRaw) {
                if (this.data.cell.type === TableCellType.device) {
                    let device = this.projectService.getDeviceFromTagId(event.variableId);
                    this.data.cell['exname'] = device ? device.name : '';
                }
            }
        }
    }

    isHistory(): boolean {
        return this.data.table === TableType.history;
    }
}

export interface TableCustomizerCellType {
    type: TableCustomizerCellRowType;
    cell: TableCell;
    table: TableType;
}

export enum TableCustomizerCellRowType {
    column,
    row,
}
