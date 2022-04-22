import { Component, OnInit, AfterViewInit, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material';
import { MatTable, MatTableDataSource, MatPaginator, MatSort, MatMenuTrigger } from '@angular/material';
import { initDomAdapter } from '@angular/platform-browser/src/browser';
import { TableType, TableColumn, TableRow, TableCell, TableColumnType } from '../../../../_models/hmi';

import { ProjectService } from '../../../../_services/project.service';

@Component({
    selector: 'app-table-customizer',
    templateUrl: './table-customizer.component.html',
    styleUrls: ['./table-customizer.component.css']
})
export class TableCustomizerComponent implements OnInit, AfterViewInit {

    tableType = TableType;
    displayedColumns = [];
    dataSource = new MatTableDataSource([]);

    constructor(
        private dialog: MatDialog,
        public dialogRef: MatDialogRef<TableCustomizerComponent>,
        @Inject(MAT_DIALOG_DATA) public data: ITableCustom) {

    }

    ngOnInit() {
        this.dataSource.data = [];//{ name: 'pippo', adr: '233'}, { name: 'ciccio', adr: 2344 }, { name: 'pippo', adr: 233 }, { name: 'pippo', adr: 33}];
        this.displayedColumns = this.data.columns.map(c => c.name);
    }

    ngAfterViewInit() {
    }

    onAddColumn() {
        this.onEditColumn();
    }

    onEditColumn(column?: string) {
        let cell = this.data.columns.find(c => c.name === column);
        if (!column) {
            cell = new TableColumn('[colName]', TableColumnType.label);
        }
        let dialogRef = this.dialog.open(DialogTableCell, {
            data: <ITableCell> { 
                type: TableCellType.column, 
                cell: JSON.parse(JSON.stringify(cell))
            },
            position: { top: '60px' }
        });

        dialogRef.afterClosed().subscribe((result: ITableCell) => {    
            if (result) {
                this.data.columns.push(<TableColumn>result.cell);
                this.ngOnInit();
            } 
        });   
    }

    onRemove(column: string) {
        this.data.columns.splice(this.data.columns.findIndex(c => c.name === column), 1);
        this.ngOnInit();
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close(this.data);
    }
}

@Component({
    selector: 'table-cell-dialog',
    templateUrl: 'table-cell.dialog.html',
})
export class DialogTableCell {
    cellType = TableCellType;
    columnType = TableColumnType;
    devicesValues = { devices: null };
    constructor(
        private projectService: ProjectService,
        public dialogRef: MatDialogRef<DialogTableCell>,
        @Inject(MAT_DIALOG_DATA) public data: ITableCell) { 
            this.devicesValues.devices = Object.values(this.projectService.getDevices())
        }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close(this.data);
    }
}

export interface ITableCustom {
    columns: TableColumn[],
    rows: TableRow[],
    type: TableType,
}

export interface ITableCell {
    type: TableCellType,
    cell: TableCell,
}

export enum TableCellType {
    column,
    row,
}