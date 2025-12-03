import { Component, Inject } from '@angular/core';
import { TableCell, TableCellType, TableType, InputOptionType } from '../../../../../_models/hmi';
import { ProjectService } from '../../../../../_services/project.service';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { OdbcBrowserComponent } from '../../../../../odbc-browser/odbc-browser.component';

@Component({
    selector: 'app-table-customizer-cell-edit',
    templateUrl: './table-customizer-cell-edit.component.html',
    styleUrls: ['./table-customizer-cell-edit.component.css']
})
export class TableCustomizerCellEditComponent {

    tableType = TableType;
    cellType = TableCustomizerCellRowType;
    columnType = TableCellType;
    inputOptionType = InputOptionType;
    devicesValues = { devices: null };

    constructor(
        private projectService: ProjectService,
        public dialogRef: MatDialogRef<TableCustomizerCellEditComponent>,
        @Inject(MAT_DIALOG_DATA) public data: TableCustomizerCellType,
        private dialog: MatDialog) {
        this.devicesValues.devices = Object.values(this.projectService.getDevices());

        // Filter devices if deviceId is specified (for parameter tables with device selection)
        if (this.data.deviceId) {
            this.devicesValues.devices = this.devicesValues.devices.filter(device => device.id === this.data.deviceId);
        }

        // Initialize odbcTimestampColumns array if not present
        if (!this.data.cell.odbcTimestampColumns) {
            this.data.cell.odbcTimestampColumns = [];
        }
        // Initialize input type if not present
        if (!this.data.cell.inputType) {
            this.data.cell.inputType = InputOptionType.text;
        }
        // Ensure width/align/defaults exist on the cell for editing dialog:
        if (this.data.type === TableCustomizerCellRowType.column) {
            // default width handling: a TableColumn has width and align; TableCell may not
            const cellAny = this.data.cell as any;
            if (cellAny.width === undefined || cellAny.width === null) {
                // Normalize width to numeric only; treat any 'auto' value as 100
                cellAny.width = Number(cellAny.width) || 100;
            }
            if (cellAny.align === undefined || cellAny.align === null) {
                cellAny.align = cellAny.align || 'left';
            }
        }
    }
    
        // Provide an any-typed helper so template bindings don't need inline typecasts
        get cellAny(): any {
            return (this.data && this.data.cell) ? (this.data.cell as any) : {};
        }

    // We no longer support auto width - width is always numeric.

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

    openOdbcBrowser() {
        const dialogRef = this.dialog.open(OdbcBrowserComponent, {
            data: {
                deviceId: this.data.cell['deviceId'], // Store device ID in cell
                query: this.data.cell.variableId
            },
            width: '600px',
            height: '700px'
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.data.cell.variableId = result.query;
                this.data.cell['deviceId'] = result.deviceId; // Store device ID for future reference
            }
        });
    }

    openOdbcTimestampBrowser() {
        // Extract table name from the ODBC query
        const tableNameMatch = this.data.cell.variableId.match(/FROM\s+([`\[\]"'\w]+)/i);
        const tableName = tableNameMatch ? tableNameMatch[1].replace(/[`\[\]"']/g, '') : '';

        const dialogRef = this.dialog.open(OdbcBrowserComponent, {
            data: {
                deviceId: this.data.cell['deviceId'],
                selectColumn: true,
                preselectedTable: tableName // Pass table name to pre-select
            },
            width: '600px',
            height: '700px'
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result && result.column && result.tableName) {
                // For backward compatibility, store in single column as well
                this.data.cell.odbcTimestampColumn = result.column;

                // Also add to the multi-source array if not already present
                if (!this.data.cell.odbcTimestampColumns) {
                    this.data.cell.odbcTimestampColumns = [];
                }

                const existing = this.data.cell.odbcTimestampColumns.find(ts =>
                    ts.table === result.tableName && ts.column === result.column
                );

                if (!existing) {
                    this.data.cell.odbcTimestampColumns.push({
                        table: result.tableName,
                        column: result.column,
                        convertUtcToLocal: false
                    });
                }
            }
        });
    }

    /**
     * Add a new ODBC timestamp column source from a different table
     */
    onAddTimestampSource() {
        const dialogRef = this.dialog.open(OdbcBrowserComponent, {
            data: {
                deviceId: this.data.cell['deviceId'],
                selectColumn: true, // Allow column selection
                selectTable: true   // Allow table selection
            },
            width: '600px',
            height: '700px'
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result && result.column && result.tableName) {
                if (!this.data.cell.odbcTimestampColumns) {
                    this.data.cell.odbcTimestampColumns = [];
                }

                // Check if this table/column combo already exists
                const existing = this.data.cell.odbcTimestampColumns.find(ts =>
                    ts.table === result.tableName && ts.column === result.column
                );

                if (!existing) {
                    this.data.cell.odbcTimestampColumns.push({
                        table: result.tableName,
                        column: result.column,
                        convertUtcToLocal: false
                    });
                }
            }
        });
    }

    /**
     * Remove a timestamp source
     */
    onRemoveTimestampSource(index: number) {
        if (this.data.cell.odbcTimestampColumns) {
            this.data.cell.odbcTimestampColumns.splice(index, 1);
        }
    }


}

export interface TableCustomizerCellType {
    type: TableCustomizerCellRowType;
    cell: TableCell;
    table: TableType;
    deviceId?: string;
}

export enum TableCustomizerCellRowType {
    column,
    row,
}
