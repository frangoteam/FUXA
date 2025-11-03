import { Component, Inject } from '@angular/core';
import { TableCell, TableCellType, TableType } from '../../../../../_models/hmi';
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
    devicesValues = { devices: null };
    
    constructor(
        private projectService: ProjectService,
        public dialogRef: MatDialogRef<TableCustomizerCellEditComponent>,
        @Inject(MAT_DIALOG_DATA) public data: TableCustomizerCellType,
        private dialog: MatDialog) {
        this.devicesValues.devices = Object.values(this.projectService.getDevices());
        
        // Initialize odbcTimestampColumns array if not present
        if (!this.data.cell.odbcTimestampColumns) {
            this.data.cell.odbcTimestampColumns = [];
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
}

export enum TableCustomizerCellRowType {
    column,
    row,
}
