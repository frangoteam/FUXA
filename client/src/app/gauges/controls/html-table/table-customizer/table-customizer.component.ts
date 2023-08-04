/* eslint-disable @angular-eslint/component-class-suffix */
import { Component, OnInit, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { TableType, TableColumn, TableRow, TableCell, TableCellType } from '../../../../_models/hmi';

import { ProjectService } from '../../../../_services/project.service';
import { Utils } from '../../../../_helpers/utils';

@Component({
    selector: 'app-table-customizer',
    templateUrl: './table-customizer.component.html',
    styleUrls: ['./table-customizer.component.css']
})
export class TableCustomizerComponent implements OnInit {

    tableType = TableType;
    displayedColumns = [];
    dataSource = new MatTableDataSource([]);

    constructor(
        private dialog: MatDialog,
        public dialogRef: MatDialogRef<TableCustomizerComponent>,
        @Inject(MAT_DIALOG_DATA) public data: ITableCustom) {

    }

    ngOnInit() {
        this.loadData();
    }

    private loadData() {
        this.displayedColumns = this.data.columns.map(c => c.id);
        let data = [];
        this.data.rows.forEach(r => {
            let row = {};
            r.cells.forEach(c => {
                if (c) {
                    row[c.id] = c;
                }
            });
            data.push(row);
        });
        if (this.data.type === TableType.data) {
            this.dataSource.data = data;
        }
    }

    onAddColumn() {
        this.onEditColumn();
    }

    onAddRow() {
        let cells = [];
        this.data.columns.forEach(c => {
                cells.push(new TableCell(c.id, c.type));
        });
        this.data.rows.push(new TableRow(cells));
        this.loadData();
    }

    onEditColumn(columnId?: string) {
        let colIndex = this.data.columns.findIndex(c => c.id === columnId);
        let cell = new TableColumn(Utils.getShortGUID('c_'), TableCellType.label);
        if (colIndex >= 0) {
            cell = this.data.columns[colIndex];
        }
        let dialogRef = this.dialog.open(DialogTableCell, {
            data: <ITableCell> {
                table: this.data.type,
                type: CellType.column,
                cell: JSON.parse(JSON.stringify(cell))
            },
            position: { top: '60px' }
        });

        dialogRef.afterClosed().subscribe((result: ITableCell) => {
            if (result) {
                let colIndex = this.data.columns.findIndex(c => c.id === (<TableColumn>result.cell).id);
                if (colIndex >= 0) {
                    this.data.columns[colIndex] = <TableColumn>result.cell;
                } else {
                    this.data.columns.push(<TableColumn>result.cell);
                }
                this.loadData();
            }
        });
    }

    onEditCell(row, columnId: string) {
        const rowIndex = this.dataSource.data.indexOf(row, 0);
        let colIndex = this.data.columns.findIndex(c => c.id === columnId);
        let cell = this.data.rows[rowIndex].cells[colIndex];
        if (!cell) {
            cell = new TableCell(columnId, TableCellType.label);
        }
        let dialogRef = this.dialog.open(DialogTableCell, {
            data: <ITableCell> {
                table: this.data.type,
                type: CellType.row,
                cell: JSON.parse(JSON.stringify(cell))
            },
            position: { top: '60px' }
        });

        dialogRef.afterClosed().subscribe((result: ITableCell) => {
            if (result) {
                this.data.rows[rowIndex].cells[colIndex] = <TableCell>result.cell;
                this.loadData();
            }
        });
    }

    onRemoveColumn(column: string) {
        this.data.columns.splice(this.data.columns.findIndex(c => c.id === column), 1);
        this.ngOnInit();
    }

    onRemoveRow(row) {
        const index = this.dataSource.data.indexOf(row, 0);
        this.data.rows.splice(index, 1);
        this.ngOnInit();
    }

    getColumnType(colIndex: number) {
        return this.getCellType(this.data.columns[colIndex]);
    }

    getColumnSetting(colIndex: number) {
        return this.data.columns[colIndex].label || '';
    }

    getCellType(cell: TableCell) {
        if (cell) {
            return `${(cell.type) ? cell.type : ''}`;
        }
        return '';
    }

    getCellSetting(cell: TableCell) {
        if (cell) {
            if (cell.type === TableCellType.label) {
                return cell.label || '';
            } else if (cell.type === TableCellType.timestamp) {
                return cell.valueFormat ? cell.valueFormat : '';
            } else if (cell.type === TableCellType.variable) {
                return (cell.label || '') + ((cell.valueFormat) ? ` (${cell.valueFormat})` : '');
            } else if (cell.type === TableCellType.device) {
                return (cell.label || '');
            }
        }
        return '';
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.data.rows.forEach(row => {
            // check missing cell, happens if you add a column and do not set it in the rows
            // or remove cells of deleted columns
            if (row.cells.length < this.data.columns.length) {
                for (let i = row.cells.length; i < this.data.columns.length; i++) {
                    row.cells.push(new TableCell(this.data.columns[i].id, TableCellType.label, ''));
                }
            } else if (row.cells.length > this.data.columns.length) {
                let columnIds = this.data.columns.map(column => column.id);
                let cells = row.cells.filter(cell => columnIds.indexOf(cell.id) >= 0);
                row.cells = cells;
            }
        });

        this.dialogRef.close(this.data);
    }
}

@Component({
    selector: 'table-cell-dialog',
    templateUrl: 'table-cell.dialog.html',
    styleUrls: ['./table-customizer.component.css']
})
export class DialogTableCell {
    tableType = TableType;
    cellType = CellType;
    columnType = TableCellType;
    devicesValues = { devices: null };
    constructor(
        private projectService: ProjectService,
        public dialogRef: MatDialogRef<DialogTableCell>,
        @Inject(MAT_DIALOG_DATA) public data: ITableCell) {
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

export interface ITableCustom {
    columns: TableColumn[];
    rows: TableRow[];
    type: TableType;
}

export interface ITableCell {
    type: CellType;
    cell: TableCell;
    table: TableType;
}

export enum CellType {
    column,
    row,
}
