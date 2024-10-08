import { Component, Inject, OnInit } from '@angular/core';
import { TableColumn, TableRow, TableType } from '../../../../_models/hmi';
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialog as MatDialog, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';

@Component({
    selector: 'app-table-alarms',
    templateUrl: './table-alarms.component.html',
    styleUrls: ['./table-alarms.component.css']
})
export class TableAlarmsComponent implements OnInit {

    constructor(
        private dialog: MatDialog,
        public dialogRef: MatDialogRef<TableAlarmsComponent>,
        @Inject(MAT_DIALOG_DATA) public data: TableAlarmsType) { }

    ngOnInit() {
    }

}

export interface TableAlarmsType {
    columns: TableColumn[];
    rows: TableRow[];
    type: TableType;
}
