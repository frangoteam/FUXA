import { Component, Inject } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { Tag } from '../../_models/device';
import { ReportDateRangeType } from '../../_models/report';
import { TableConfig } from './advanced-report-editor.component';

export interface TableConfigDialogData {
    tableField: TableField;
    currentConfig?: TableConfig;
    availableTags: Tag[];
    globalTimeRange: TimeRangeConfig;
    report: any; // The full report object to access template
    onConfigChange?: (config: TableConfig) => void; // Callback for real-time updates
}

export interface TableField {
    name: string;
    type: string;
}

export interface TableColumn {
    tagName: string;
    label: string;
    isTimestamp: boolean;
    timestampFormat?: string;
    valueFormat?: string;
}

export interface TimeRangeConfig {
    from: string;
    to: string;
}

@Component({
    selector: 'app-table-config-dialog',
    templateUrl: './table-config-dialog.component.html',
    styleUrls: ['./table-config-dialog.component.css']
})
export class TableConfigDialogComponent {

    tableConfig: TableConfig;
    availableTags: Tag[];
    globalTimeRange: TimeRangeConfig;
    columnNames: string[] = [];

    // Available alarm columns that users can choose from
    availableAlarmColumns: TableColumn[] = [
        { tagName: 'nametype', label: 'Tag Name', isTimestamp: false },
        { tagName: 'type', label: 'Type', isTimestamp: false },
        { tagName: 'status', label: 'Status', isTimestamp: false },
        { tagName: 'text', label: 'Message', isTimestamp: false },
        { tagName: 'grp', label: 'Group', isTimestamp: false },
        { tagName: 'ontime', label: 'On Time', isTimestamp: true, timestampFormat: 'YYYY-MM-DD HH:mm:ss' },
        { tagName: 'offtime', label: 'Off Time', isTimestamp: true, timestampFormat: 'YYYY-MM-DD HH:mm:ss' },
        { tagName: 'acktime', label: 'Ack Time', isTimestamp: true, timestampFormat: 'YYYY-MM-DD HH:mm:ss' },
        { tagName: 'userack', label: 'User Ack', isTimestamp: false }
    ];

    selectedAlarmColumns: boolean[] = [];

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: TableConfigDialogData,
        private dialogRef: MatDialogRef<TableConfigDialogComponent>,
        private snackBar: MatSnackBar
    ) {
        this.availableTags = data.availableTags;
        this.globalTimeRange = data.globalTimeRange;

        // Extract column names from table schema
        this.extractColumnNames();

        // Initialize or load existing config
        if (data.currentConfig) {
            this.tableConfig = { ...data.currentConfig };
            // Ensure we have the right number of columns
            if (!this.tableConfig.isAlarmTable) {
                this.syncColumnsWithTable();
            } else {
                // For alarm tables, initialize column selection
                this.initializeAlarmColumnSelection();
            }
        } else {
            this.initializeColumns();
        }
    }

    private extractColumnNames() {

        // Find the table field in the report template
        if (this.data.report?.template?.schemas) {
            for (const pageSchema of this.data.report.template.schemas) {
                if (pageSchema) {
                    for (const field of pageSchema) {
                        if (field.name === this.data.tableField.name && field.type === 'table' && field.head) {
                            this.columnNames = field.head;
                            return;
                        }
                    }
                }
            }
        }
    }

    private initializeColumns() {
        if (this.tableConfig.isAlarmTable) {
            // For alarm tables, start with all columns selected by default
            this.tableConfig = {
                fieldName: this.data.tableField.name,
                columns: [...this.availableAlarmColumns],
                timeRange: {
                    from: '',
                    to: ''
                },
                useReportTimeRange: true,
                isAlarmTable: true
            };
            this.selectedAlarmColumns = new Array(this.availableAlarmColumns.length).fill(true);
        } else {
            this.tableConfig = {
                fieldName: this.data.tableField.name,
                columns: this.columnNames.map(name => ({
                    tagName: '',
                    label: name,
                    isTimestamp: false,
                    timestampFormat: 'YYYY-MM-DD HH:mm:ss'
                })),
                timeRange: {
                    from: '',
                    to: ''
                },
                useReportTimeRange: true
            };
        }
    }

    private initializeAlarmColumnSelection() {
        // Initialize selection array based on current columns
        this.selectedAlarmColumns = this.availableAlarmColumns.map(availableCol =>
            this.tableConfig.columns.some(col => col.tagName === availableCol.tagName)
        );
    }

    private syncColumnsWithTable() {
        // Ensure the number of columns matches the table schema
        if (this.tableConfig.columns.length !== this.columnNames.length) {
            // Reinitialize if mismatch
            this.initializeColumns();
        } else {
            // Update labels to match table schema
            this.tableConfig.columns.forEach((column, index) => {
                column.label = this.columnNames[index];
            });
        }
    }

    onSave() {
        // For alarm tables, validate that at least one column is selected
        if (this.tableConfig.isAlarmTable) {
            if (this.tableConfig.columns.length === 0) {
                this.snackBar.open('Please select at least one alarm column', 'OK', { duration: 3000 });
                return;
            }
        } else {
            // Validate configuration for regular tables
            for (const column of this.tableConfig.columns) {
                const valueToCheck = column.isTimestamp ? column.timestampFormat : column.tagName;
                if (!valueToCheck || !valueToCheck.trim()) {
                    this.snackBar.open('All columns must have a tag name or timestamp format', 'OK', { duration: 3000 });
                    return;
                }
            }
        }

        // Send message to parent window (report settings dialog) about the table config update
        if (window.parent && window.parent !== window) {

            window.parent.postMessage({
                type: 'TABLE_CONFIG_UPDATED',
                fieldName: this.data.tableField.name,
                tableConfig: this.tableConfig
            }, '*');
        }

        this.dialogRef.close(this.tableConfig);
    }

    onCancel() {
        this.dialogRef.close();
    }

    onTimestampChange(column: TableColumn) {
        if (column.isTimestamp) {
            // Switching to timestamp column - move current tagName to timestampFormat if empty
            if (!column.timestampFormat) {
                column.timestampFormat = 'YYYY-MM-DD HH:mm:ss';
            }
            // Clear tagName when switching to timestamp
            column.tagName = '';
        } else {
            // Switching back to regular column - clear timestamp format
            column.timestampFormat = undefined;
        }
    }

    onTimeRangeChange() {
        if (!this.tableConfig.useReportTimeRange) {
            // Set dynamic time range: last 10 minutes
            this.tableConfig.timeRange.from = 'now - 10 minutes';
            this.tableConfig.timeRange.to = 'now';
        } else {
            // Use global time range from report settings
            this.tableConfig.timeRange.from = this.globalTimeRange.from;
            this.tableConfig.timeRange.to = this.globalTimeRange.to;
        }
    }

    onAlarmTableChange() {
        if (this.tableConfig.isAlarmTable) {
            // Switching to alarm table - initialize with all columns selected
            this.initializeColumns();
        } else {
            // Switching back to regular table - reinitialize with template columns
            this.initializeColumns();
        }
    }

    onAlarmColumnSelectionChange(index: number) {
        if (this.tableConfig.isAlarmTable) {
            // Update the columns array based on selection
            this.tableConfig.columns = this.availableAlarmColumns.filter((_, i) => this.selectedAlarmColumns[i]);
            // Mark template as needing update
            this.tableConfig.templateInitialized = false;

            // Call the callback for real-time updates if provided
            if (this.data.onConfigChange) {
                this.data.onConfigChange(this.tableConfig);
            }
        }
    }

    removeAlarmColumn(index: number) {
        if (this.tableConfig.isAlarmTable && this.selectedAlarmColumns[index]) {
            this.selectedAlarmColumns[index] = false;
            this.onAlarmColumnSelectionChange(index);
        }
    }
}