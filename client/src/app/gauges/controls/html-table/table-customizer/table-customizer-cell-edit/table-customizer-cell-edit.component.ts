import { Component, Inject } from '@angular/core';
import { TableCell, TableCellType, TableType } from '../../../../../_models/hmi';
import { ProjectService } from '../../../../../_services/project.service';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';

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
    constructor(
        private projectService: ProjectService,
        public dialogRef: MatDialogRef<TableCustomizerCellEditComponent>,
        @Inject(MAT_DIALOG_DATA) public data: TableCustomizerCellType) {
        this.devicesValues.devices = Object.values(this.projectService.getDevices());
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {

        this.dialogRef.close(this.data);
    }

    onSetVariable(event) {
        this.data.cell.variableId = event.variableId;
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
