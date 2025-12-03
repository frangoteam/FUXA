/* eslint-disable @angular-eslint/component-class-suffix */
import { Component, OnInit, Inject } from '@angular/core';
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialog as MatDialog, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { MatLegacyTableDataSource as MatTableDataSource } from '@angular/material/legacy-table';
import { TableType, TableColumn, TableRow, TableCell, TableCellType, TableRowType, ParameterRow, TableCellAlignType } from '../../../../_models/hmi';
import { DeviceType } from '../../../../_models/device';

import { Utils } from '../../../../_helpers/utils';
import { ProjectService } from '../../../../_services/project.service';
import { ToastNotifierService } from '../../../../_services/toast-notifier.service';
import { HttpClient } from '@angular/common/http';
import { ParameterType } from '../../../../_models/hmi';
import { TableCustomizerCellEditComponent, TableCustomizerCellRowType, TableCustomizerCellType } from './table-customizer-cell-edit/table-customizer-cell-edit.component';
import { TableCustomizerTypeEditComponent, TableCustomizerTypeEditDialogData } from './table-customizer-type-edit/table-customizer-type-edit.component';
import { TableCustomizerTextRowEditComponent } from './table-customizer-text-row-edit/table-customizer-text-row-edit.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../gui-helpers/confirm-dialog/confirm-dialog.component';

@Component({
    selector: 'app-table-customizer',
    templateUrl: './table-customizer.component.html',
    styleUrls: ['./table-customizer.component.scss']
})
export class TableCustomizerComponent implements OnInit {

    tableType = TableType;
    tableRowType = TableRowType;
    displayedColumns = [];
    dataSource = new MatTableDataSource([]);

    constructor(
        private dialog: MatDialog,
        public dialogRef: MatDialogRef<TableCustomizerComponent>,
        @Inject(MAT_DIALOG_DATA) public data: TableCustomizerType,
    private projectService: ProjectService,
    private http: HttpClient,
    private toastNotifier: ToastNotifierService) {

    }

    get isParametersTable() {
        return this.data.type === TableType.parameter;
    }

    private isSavingType: boolean = false;
    private pendingSaveNeeded: boolean = false;

    private async saveSelectedType(showToast: boolean = false) {
        if (this.data.type !== TableType.parameter || !this.selectedTypeId) return;
        if (this.isSavingType) {
            this.pendingSaveNeeded = true;
            return;
        }
        this.isSavingType = true;
        try {
            const found = this.parameterTypes.find(t => t.id === this.selectedTypeId);
            const type = found || this.selectedType || new ParameterType(this.selectedTypeId);
            type.rows = JSON.parse(JSON.stringify(this.data.rows || []));
            type.columns = JSON.parse(JSON.stringify(this.data.columns || []));
            if (this.selectedType && this.selectedType.columnStyles) {
                (type as any).columnStyles = JSON.parse(JSON.stringify(this.selectedType.columnStyles));
            }
            // Ensure id exists
            if (!type.id) type.id = Utils.getShortGUID('pt_');
            await this.http.post('/api/parameters-table/types', { type, storage: {storageType: this.data.storageType, odbcDeviceId: this.data.odbcDeviceId} }).toPromise();
            await this.loadParameterTypes();
            // maintain selection
            this.selectedTypeId = type.id;
            this.selectedType = this.parameterTypes.find(t => t.id === this.selectedTypeId) || null;
            if (showToast) this.toastNotifier.notifySuccess('msg.parameter-type-saved');
    } catch (err) {
            console.error('Failed to save parameter type', err);
            this.toastNotifier.notifyError('msg.failed-save-parameter-type', err.message || '');
        } finally {
            this.isSavingType = false;
            if (this.pendingSaveNeeded) {
                this.pendingSaveNeeded = false;
                setTimeout(() => this.saveSelectedType(showToast), 50);
            }
        }
    }

    ngOnInit() {
        if (this.data.odbcDeviceId) {
            const devices = this.projectService.getDevices();
            if (!devices[this.data.odbcDeviceId] || devices[this.data.odbcDeviceId].type !== DeviceType.ODBC) {
                this.data.odbcDeviceId = null;
            }
        }
        this.loadData();
        if (this.data.type === this.tableType.parameter) {
            this.loadParameterTypes();
            this.devices = Object.values(this.projectService.getDevices());
        }
    }

    parameterTypes: ParameterType[] = [];
    devices: any[] = [];
    selectedTypeId: string = null;
    selectedType: ParameterType = null;
    assignedTypeIds: string[] = [];

    isTextRow(element: any) {
        const ri = this.dataSource.data.indexOf(element);
        if (ri < 0) return false;
        return (this.data.type === TableType.parameter && (this.data.rows[ri] as any)?.type === TableRowType.text);
    }

    private loadData() {
        try {
            if (this.data.type === this.tableType.parameter) {
                this.displayedColumns = (this.data.columns || []).map(c => c.id);
            } else {
                this.displayedColumns = (this.data && this.data.columns) ? this.data.columns.map(c => c.id) : [];
            }
        } catch (err) {
            console.error('loadData: failed to compute displayedColumns', err, this.data);
            this.displayedColumns = [];
        }
        let data = [];
        (this.data.rows || []).forEach((r, originalIndex) => {
            let row = { originalIndex: originalIndex };
            r.cells.forEach(c => {
                if (c) {
                    row[c.id] = c;
                }
            });
            data.push(row);
        });
        if (this.data.type === TableType.data || this.data.type === TableType.parameter) {
            this.dataSource.data = data;
        }
    }

    private async loadParameterTypes() {
        try {
            if (this.data.storageType === 'odbc' && this.data.odbcDeviceId) {
                const devices = this.projectService.getDevices();
                if (!devices[this.data.odbcDeviceId] || devices[this.data.odbcDeviceId].type !== DeviceType.ODBC) {
                    this.parameterTypes = [];
                    return;
                }
            }
            if (this.data.storageType === 'odbc' && !this.data.odbcDeviceId) {
                this.parameterTypes = [];
                return;
            }
            const params = new URLSearchParams();
            params.append('storageType', this.data.storageType || 'sqlite');
            params.append('odbcDeviceId', this.data.odbcDeviceId || '');
            const response = await this.http.get<{ types: ParameterType[] }>(`/api/parameters-table/types?${params.toString()}`).toPromise();
            if (!this.selectedTypeId && (this.data as any)?.parameterTypeId) {
                this.selectedTypeId = (this.data as any).parameterTypeId;
            }
            if (!this.selectedTypeId && this.parameterTypes.length > 0) {
                const hasExistingRows = this.data?.rows && this.data.rows.length > 0;
                const hasExistingColumns = this.data?.columns && this.data.columns.length > 0;
                if (!hasExistingRows && !hasExistingColumns) {
                    this.selectedTypeId = this.parameterTypes[0].id;
                }
            }
            this.parameterTypes = (this.data && (this.data as any).types) ? (this.data as any).types : (response?.types || []);

            const incomingAssigned = (this.data as any)?.parameterTypeIds;
            if (incomingAssigned && incomingAssigned.length) {
                this.assignedTypeIds = [...incomingAssigned];
            } else if ((this.data as any)?.parameterTypeId) {
                this.assignedTypeIds = [(this.data as any).parameterTypeId];
            } else {
                this.assignedTypeIds = [];
            }
            
            this.selectedType = this.parameterTypes.find(t => t.id === this.selectedTypeId) || null;
            if (this.selectedTypeId) {
                try {
                    this.onSelectType(this.selectedTypeId);
                } catch (err) {
                    console.error('loadParameterTypes: failed applying selected type', err, this.selectedTypeId);
                }
            } else {
                this.data.rows = [];
                this.data.columns = [];
                this.loadData();
            }
        } catch (err) {
            console.error('Failed to load parameter types', err);
            this.toastNotifier.notifyError('msg.failed-load-parameter-types', err.message || '');
            this.parameterTypes = (this.data && (this.data as any).types) ? (this.data as any).types : [];
            if (err.status === 400) {
                this.data.odbcDeviceId = null;
            }
        }
    }

    onAddType() {
        this.openTypeDialog();
    }

    onEditType() {
        const t = this.parameterTypes.find(p => p.id === this.selectedTypeId);
        if (!t) return;
        this.openTypeDialog(t);
    }

    async onCopyType() {
        if (!this.selectedTypeId) return;
        const t = this.parameterTypes.find(p => p.id === this.selectedTypeId);
        if (!t) return;
    const copy = JSON.parse(JSON.stringify(t));
    copy.id = Utils.getShortGUID('pt_');
    copy.userId = '';
        copy.name = `${copy.name} - copy`;
        try {
            await this.http.post('/api/parameters-table/types', { type: copy, storage: {storageType: this.data.storageType, odbcDeviceId: this.data.odbcDeviceId} }).toPromise();
            this.toastNotifier.notifySuccess('msg.parameter-type-copied');
            await this.loadParameterTypes();
            this.selectedTypeId = copy.id;
            this.onSelectType(copy.id);
        } catch (err) {
            console.error('Failed to copy parameter type', err);
            this.toastNotifier.notifyError('msg.failed-copy-parameter-type', err.message || '');
        }
    }

    onSelectType(typeId: string) {
        this.selectedTypeId = typeId;
        this.selectedType = this.parameterTypes.find(t => t.id === typeId) || null;
        const type = this.parameterTypes.find(p => p.id === typeId);
        if (!type) return;
        try {
            this.data.rows = JSON.parse(JSON.stringify(type.rows || []));
            this.data.columns = JSON.parse(JSON.stringify(type.columns || []));
        } catch (err) {
            console.error('onSelectType: failed to clone type rows/columns', err, type);
            this.data.rows = [];
            this.data.columns = [];
        }
        this.loadData();
    }

    isTypeAssigned(typeId: string): boolean {
        return !!typeId && this.assignedTypeIds.includes(typeId);
    }

    onTypeAssignmentChange(typeId: string, checked: boolean) {
        if (!typeId) return;
        if (checked) {
            if (!this.assignedTypeIds.includes(typeId)) {
                this.assignedTypeIds.push(typeId);
            }
        } else {
            const index = this.assignedTypeIds.indexOf(typeId);
            if (index >= 0) {
                this.assignedTypeIds.splice(index, 1);
            }
        }
    }

    async onDeleteType() {
        if (!this.selectedTypeId) return;
        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
            data: { msg: 'Are you sure you want to delete this type?' } as ConfirmDialogData,
            position: { top: '60px' }
        });
        dialogRef.afterClosed().subscribe(async (result: boolean) => {
            if (!result) return;
            try {
                const params = new URLSearchParams();
                params.append('id', this.selectedTypeId);
                params.append('storageType', this.data.storageType || 'sqlite');
                params.append('odbcDeviceId', this.data.odbcDeviceId || '');
                await this.http.delete(`/api/parameters-table/types?${params.toString()}`).toPromise();
                this.toastNotifier.notifySuccess('msg.parameter-type-deleted');
            } catch (err) {
                console.error('Failed to delete type', err);
                this.toastNotifier.notifyError('msg.failed-delete-parameter-type', err.message || '');
            }
            const idx = this.parameterTypes.findIndex(p => p.id === this.selectedTypeId);
            if (idx >= 0) {
                this.parameterTypes.splice(idx, 1);
                this.selectedTypeId = this.parameterTypes.length ? this.parameterTypes[0].id : null;
            }
        });
    }

    /**
     * Open the edit/add dialog for a parameter type.
     * If an existing type is passed, edit mode is used; otherwise add.
     */
    openTypeDialog(type?: ParameterType) {
        const preType = (type ? JSON.parse(JSON.stringify(type)) : new ParameterType());
        const isNew = !type;
        if (isNew) {
            preType.rows = [];
            preType.columns = [];
        }
        const dialogRef = this.dialog.open(TableCustomizerTypeEditComponent, {
            data: { type: preType, devices: this.devices } as TableCustomizerTypeEditDialogData,
            position: { top: '60px' },
            width: '520px',
            maxWidth: '90%'
        });
        dialogRef.afterClosed().subscribe(async (result: ParameterType) => {
            if (!result) return;
            try {
                if (!result.id) result.id = Utils.getShortGUID('pt_');
                if (isNew) {
                    result.rows = [];
                    result.columns = [];
                } else {
                    try { result.rows = JSON.parse(JSON.stringify(this.data.rows)); } catch {}
                    try { result.columns = JSON.parse(JSON.stringify(this.data.columns)); } catch {}
                }
                await this.http.post('/api/parameters-table/types', { type: result, storage: {storageType: this.data.storageType, odbcDeviceId: this.data.odbcDeviceId} }).toPromise();
                this.toastNotifier.notifySuccess('msg.parameter-type-saved');
                await this.loadParameterTypes();
                this.selectedTypeId = result.id;
                this.onSelectType(result.id);
            } catch (err) {
                console.error('Failed to save parameter type', err);
                this.toastNotifier.notifyError('msg.failed-save-parameter-type', err.message || '');
                const idx = this.parameterTypes.findIndex(p => p.id === result.id);
                if (idx >= 0) this.parameterTypes[idx] = result;
                else this.parameterTypes.push(result);
            }
        });
    }

    onAddColumn() {
        this.onEditColumn();
    }

    onAddRow() {
        this.onAddRowOfType(TableRowType.column);
        this.loadData();
        this.saveSelectedType();
    }

    /**
     * Add a row of specific type. For parameter tables we support text or column rows.
     */
    onAddRowOfType(type: TableRowType | string) {
        // Normalize string to enum
        if (typeof type === 'string') {
            type = (type === 'text') ? TableRowType.text : TableRowType.column;
        }
    if (this.data.type === TableType.parameter) {
            const r = new ParameterRow(type as TableRowType);
            if (type === TableRowType.column) {
                this.displayedColumns.forEach(colId => {
                    const cell = new TableCell(colId, TableCellType.label, `Cell ${r.cells.length + 1}`);
                    r.cells.push(cell);
                });
            } else if (type === TableRowType.text) {
                r.textContent = '';
                r.textAlign = TableCellAlignType.left;
                r.textSize = 12;
                r.textBold = false;
            } else {
                this.displayedColumns.forEach(colId => {
                    r.cells.push(new TableCell(colId, TableCellType.label, `Cell ${r.cells.length + 1}`));
                });
            }
            this.data.rows.push(r as unknown as TableRow);
        } else {
            let cells = [];
            (this.data.columns || []).forEach(c => {
                cells.push(new TableCell(c.id, c.type));
            });
            this.data.rows.push(new TableRow(cells));
        }
        this.loadData();
        this.saveSelectedType();
    }

    onEditColumn(columnId?: string) {
        if (this.data.type === this.tableType.parameter) {
            let column = (this.data.columns || []).find(c => c.id === columnId);
            if (!column) {
                column = new TableColumn(columnId || Utils.getShortGUID('c_'), TableCellType.label, 'New Column');
                this.data.columns.push(column);
            }
            if (this.selectedType && this.selectedType.columnStyles && this.selectedType.columnStyles[column.id]) {
                const style = (this.selectedType.columnStyles[column.id] as any);
                const w = (style && style.width) ? Number(style.width) || 100 : 100;
                (column as any).width = w;
                (column as any).align = style && style.align ? style.align : (column as any).align || 'left';
            }

            let dialogRef = this.dialog.open(TableCustomizerCellEditComponent, {
                data: <TableCustomizerCellType> {
                    table: this.data.type,
                    type: TableCustomizerCellRowType.column,
                    cell: JSON.parse(JSON.stringify(column)),
                    deviceId: this.selectedType.deviceId
                },
                position: { top: '60px' }
            });

            dialogRef.afterClosed().subscribe((result: TableCustomizerCellType) => {
                if (result) {
                    const colIndex = (this.data.columns || []).findIndex(c => c.id === result.cell.id);
                    if (colIndex >= 0) {
                        this.data.columns[colIndex].label = result.cell.label;
                        this.data.columns[colIndex].inputType = result.cell.inputType;
                        this.data.columns[colIndex].inputMin = result.cell.inputMin;
                        this.data.columns[colIndex].inputMax = result.cell.inputMax;
                        this.data.columns[colIndex].valueFormat = result.cell.valueFormat;
                    }
                    if (!this.selectedType.columnStyles) this.selectedType.columnStyles = {};
                    const w: number = Number((result.cell as any).width) || 100;
                    this.selectedType.columnStyles[result.cell.id] = { width: w, align: (result.cell as any).align };
                    this.loadData();
                }
            });
        } else {
            let colIndex = (this.data.columns || []).findIndex(c => c.id === columnId);
            let cell = new TableColumn(Utils.getShortGUID('c_'), TableCellType.label);
            if (colIndex >= 0) {
                cell = this.data.columns[colIndex];
            }
            let dialogRef = this.dialog.open(TableCustomizerCellEditComponent, {
                data: <TableCustomizerCellType> {
                    table: this.data.type,
                    type: TableCustomizerCellRowType.column,
                    cell: JSON.parse(JSON.stringify(cell)),
                    deviceId: this.selectedType?.deviceId
                },
                position: { top: '60px' }
            });

            dialogRef.afterClosed().subscribe((result: TableCustomizerCellType) => {
                if (result) {
                    let colIndex = (this.data.columns || []).findIndex(c => c.id === (<TableColumn>result.cell).id);
                    if (colIndex >= 0) {
                        this.data.columns[colIndex] = <TableColumn>result.cell;
                    } else {
                        this.data.columns.push(<TableColumn>result.cell);
                        this.data.rows = this.data.rows || [];
                        if (this.data.rows.length === 0) {
                            try {
                                const initialRow = new ParameterRow(TableRowType.column);
                                (this.data.columns || []).forEach((col: TableColumn) => {
                                    initialRow.cells.push(new TableCell(col.id, col.type));
                                });
                                this.data.rows.push(initialRow as unknown as TableRow);
                            } catch (err) {
                                console.error('onEditColumn: failed creating initial row', err);
                            }
                        } else {
                            this.data.rows.forEach((row: any) => {
                                row.cells = row.cells || [];
                                if (row.cells.length < this.data.columns.length) {
                                    for (let i = row.cells.length; i < this.data.columns.length; i++) {
                                        const col = this.data.columns[i];
                                        row.cells.push(new TableCell(col.id, col.type));
                                    }
                                }
                            });
                        }
                    }
                    this.loadData();
                    this.saveSelectedType();
                }
            });
        }
    }    onEditCell(row, columnId: string) {
        const rowIndex = row.originalIndex;
        let cell = null;
        let cellIndex = -1;
        if (this.data.type === this.tableType.parameter) {
            if (this.data.rows[rowIndex] && this.data.rows[rowIndex].cells) {
                cellIndex = this.data.rows[rowIndex].cells.findIndex(c => c && c.id === columnId);
                if (cellIndex >= 0) {
                    cell = this.data.rows[rowIndex].cells[cellIndex];
                }
            }
        } else {
            let colIndex = (this.data.columns || []).findIndex(c => c.id === columnId);
            cell = (this.data.rows[rowIndex] && this.data.rows[rowIndex].cells) ? this.data.rows[rowIndex].cells[colIndex] : null;
            cellIndex = colIndex;
        }
        if (!cell) {
            cell = new TableCell(columnId, TableCellType.label);
            cellIndex = -1; 
        }
        let dialogRef = this.dialog.open(TableCustomizerCellEditComponent, {
            data: <TableCustomizerCellType> {
                table: this.data.type,
                type: TableCustomizerCellRowType.row,
                cell: JSON.parse(JSON.stringify(cell)),
                deviceId: this.selectedType?.deviceId
            },
            position: { top: '60px' }
        });

        dialogRef.afterClosed().subscribe((result: TableCustomizerCellType) => {
            if (result) {
                if (this.data.type === this.tableType.parameter) {
                    if (cellIndex >= 0) {
                        this.data.rows[rowIndex].cells[cellIndex] = <TableCell>result.cell;
                    } else {
                        this.data.rows[rowIndex].cells.push(<TableCell>result.cell);
                    }
                } else {
                    this.data.rows[rowIndex].cells[cellIndex] = <TableCell>result.cell;
                }
                const currentData = this.dataSource.data.slice(); 
                const rowInData = currentData.find(r => r.originalIndex === rowIndex);
                if (rowInData) {
                    rowInData[columnId] = result.cell;
                    this.dataSource.data = currentData;
                }
            }
        });
    }

    onCopyRow(row) {
        const originalIndex = row.originalIndex;
        if (originalIndex >= 0) {
            const copiedRow = JSON.parse(JSON.stringify(this.data.rows[originalIndex]));
            if (copiedRow.id) copiedRow.id = '';
            this.data.rows.splice(originalIndex + 1, 0, copiedRow);
            this.loadData();
            if (this.data.type !== this.tableType.parameter) this.saveSelectedType();
        }
    }

    onRemoveCell(row, columnId: string) {
        const rowIndex = row.originalIndex;
        if (rowIndex < 0) {
            return;
        }
        let colIndex = -1;
        if (this.data.type === this.tableType.parameter) {
            const cells = this.data.rows[rowIndex].cells || [];
            colIndex = cells.findIndex(c => c && c.id === columnId);
        } else {
            colIndex = (this.data.columns || []).findIndex(c => c.id === columnId);
        }
        if (colIndex < 0) {
            return;
        }
        const cells = this.data.rows[rowIndex].cells || [];
        if (cells[colIndex]) {
            cells.splice(colIndex, 1);
        }
        this.loadData();
        this.saveSelectedType();
    }

    onEditTextRow(row) {
        const ri = row.originalIndex;
        if (ri < 0) return;
        const pRow = (this.data.rows[ri] as any);
        const dialogRef = this.dialog.open(TableCustomizerTextRowEditComponent, {
            data: { row: JSON.parse(JSON.stringify(pRow)) },
            position: { top: '60px' },
            width: '450px',
            height: 'auto',
            maxWidth: '80%'
        });
        dialogRef.afterClosed().subscribe((result) => {
            if (result) {
                pRow.textContent = result.textContent;
                pRow.textAlign = result.textAlign;
                pRow.textSize = result.textSize;
                pRow.textBold = result.textBold;
                pRow.modified = result.modified || new Date();
                this.loadData();
                if (this.data.type !== this.tableType.parameter) this.saveSelectedType();
            }
        });
    }

    onRemoveColumn(column: string) {
        if (this.data.type === this.tableType.parameter) {
            const idx = this.displayedColumns.indexOf(column);
            if (idx >= 0) {
                (this.data.rows || []).forEach((row: any) => {
                    if (row && row.cells && row.cells.length > idx) {
                        row.cells.splice(idx, 1);
                    }
                });
            }
        } else {
            const idx = (this.data.columns || []).findIndex(c => c.id === column);
            if (idx >= 0) {
                this.data.columns.splice(idx, 1);
                (this.data.rows || []).forEach((row: any) => {
                    if (row && row.cells && row.cells.length > idx) {
                        row.cells.splice(idx, 1);
                    }
                });
            }
        }
        this.loadData();
        this.saveSelectedType();
    }

    onRemoveRow(row) {
        const originalIndex = row.originalIndex;
        if (originalIndex >= 0 && originalIndex < this.data.rows.length) {
            this.data.rows.splice(originalIndex, 1);
            this.loadData();
            if (this.data.type !== this.tableType.parameter) this.saveSelectedType();
        }
    }

    getColumnType(colIndex: number) {
        if (this.data.type === this.tableType.parameter) {
            const column = (this.data.columns || [])[colIndex];
            return this.getCellType(column);
        } else {
            return this.getCellType((this.data?.columns || [])[colIndex]);
        }
    }

    getColumnSetting(colIndex: number) {
        if (this.data.type === this.tableType.parameter) {
            const column = (this.data.columns || [])[colIndex];
            return column ? (column.label || '') : '';
        } else {
            if (!this.data || !this.data.columns || !this.data.columns[colIndex]) return '';
            return this.data.columns[colIndex].label || '';
        }
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
            } else if (cell.type === TableCellType.odbc) {
                const deviceName = cell['deviceId'] ? this.projectService.getDeviceFromId(cell['deviceId'])?.name : '';
                return `${cell.variableId || ''}${deviceName ? ` (${deviceName})` : ''}`;
            }
        }
        return '';
    }

    onMoveColumnLeft(index: number) {
        if (this.data.type === this.tableType.parameter) {
            this.data.rows.forEach(row => {
                if (row.cells && row.cells.length > index && index > 0) {
                    [row.cells[index - 1], row.cells[index]] = [row.cells[index], row.cells[index - 1]];
                }
            });
        } else {
            if (index > 0) {
                [this.data.columns[index - 1], this.data.columns[index]] = [this.data.columns[index], this.data.columns[index - 1]];
                this.data.rows.forEach(row => {
                    [row.cells[index - 1], row.cells[index]] =
                        [row.cells[index], row.cells[index - 1]];
                });
            }
        }
        this.loadData();
        if (this.data.type !== this.tableType.parameter) this.saveSelectedType();
    }

    onMoveColumnRight(index: number) {
        if (this.data.type === this.tableType.parameter) {
            this.data.rows.forEach(row => {
                if (row.cells && row.cells.length > index + 1) {
                    [row.cells[index + 1], row.cells[index]] = [row.cells[index], row.cells[index + 1]];
                }
            });
        } else {
            if (index < this.data.columns.length - 1) {
                [this.data.columns[index + 1], this.data.columns[index]] = [this.data.columns[index], this.data.columns[index + 1]];
                this.data.rows.forEach(row => {
                    [row.cells[index + 1], row.cells[index]] =
                        [row.cells[index], row.cells[index + 1]];
                });
            }
        }
        this.loadData();
        this.saveSelectedType();
    }

    onMoveRowUp(row) {
        const index = this.dataSource.data.indexOf(row);
        if (index > 0) {
            const temp = this.data.rows[index];
            this.data.rows[index] = this.data.rows[index - 1];
            this.data.rows[index - 1] = temp;
            const currentData = this.dataSource.data.slice();
            const tempRow = currentData[index];
            currentData[index] = currentData[index - 1];
            currentData[index - 1] = tempRow;
            this.dataSource.data = currentData;
            this.saveSelectedType();
        }
    }

    onMoveRowDown(row) {
        const index = this.dataSource.data.indexOf(row);
        if (index < this.data.rows.length - 1) {
            const temp = this.data.rows[index];
            this.data.rows[index] = this.data.rows[index + 1];
            this.data.rows[index + 1] = temp;
            const currentData = this.dataSource.data.slice();
            const tempRow = currentData[index];
            currentData[index] = currentData[index + 1];
            currentData[index + 1] = tempRow;
            this.dataSource.data = currentData;
            this.saveSelectedType();
        }
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    async onOkClick(): Promise<void> {
        if (this.data.type === this.tableType.parameter) {
            (this.data as any).types = this.parameterTypes;
            (this.data as any).parameterTypeId = this.selectedTypeId;
            (this.data as any).parameterTypeIds = [...this.assignedTypeIds];
            // Save the type before closing
            await this.saveSelectedType(true);
        }
        this.data.rows.forEach(row => {

            if (this.data.type === TableType.parameter && (row as any).type === TableRowType.text) {
                row.cells = [];
                return;
            }
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
    types?: ParameterType[];
    parameterTypeId?: string;
    parameterTypeIds?: string[];
    storageType?: string;
    odbcDeviceId?: string;
}
