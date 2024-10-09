/* eslint-disable @angular-eslint/component-class-suffix */
import { Component, OnInit, Inject } from '@angular/core';
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialog as MatDialog, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { MatLegacyTableDataSource as MatTableDataSource } from '@angular/material/legacy-table';
import { TableType, TableColumn, TableRow, TableCell, TableCellType } from '../../../../_models/hmi';

import { Utils } from '../../../../_helpers/utils';
import { TableCustomizerCellEditComponent, TableCustomizerCellRowType, TableCustomizerCellType } from './table-customizer-cell-edit/table-customizer-cell-edit.component';

@Component({
    selector: 'app-table-customizer',
    templateUrl: './table-customizer.component.html',
    styleUrls: ['./table-customizer.component.scss']
})
export class TableCustomizerComponent implements OnInit {

    tableType = TableType;
    displayedColumns = [];
    dataSource = new MatTableDataSource([]);

    constructor(
        private dialog: MatDialog,
        public dialogRef: MatDialogRef<TableCustomizerComponent>,
        @Inject(MAT_DIALOG_DATA) public data: TableCustomizerType) {

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
        let dialogRef = this.dialog.open(TableCustomizerCellEditComponent, {
            data: <TableCustomizerCellType> {
                table: this.data.type,
                type: TableCustomizerCellRowType.column,
                cell: JSON.parse(JSON.stringify(cell))
            },
            position: { top: '60px' }
        });

        dialogRef.afterClosed().subscribe((result: TableCustomizerCellType) => {
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
        let dialogRef = this.dialog.open(TableCustomizerCellEditComponent, {
            data: <TableCustomizerCellType> {
                table: this.data.type,
                type: TableCustomizerCellRowType.row,
                cell: JSON.parse(JSON.stringify(cell))
            },
            position: { top: '60px' }
        });

        dialogRef.afterClosed().subscribe((result: TableCustomizerCellType) => {
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

export interface TableCustomizerType {
    columns: TableColumn[];
    rows: TableRow[];
    type: TableType;
}
