import { Component, OnInit, AfterViewInit, OnChanges, SimpleChanges, ViewChild, OnDestroy, ChangeDetectorRef, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { MatLegacyRow as MatRow, MatLegacyTable as MatTable, MatLegacyTableDataSource as MatTableDataSource } from '@angular/material/legacy-table';
import { MatLegacyPaginator as MatPaginator } from '@angular/material/legacy-paginator';
import { MatLegacyMenuTrigger as MatMenuTrigger } from '@angular/material/legacy-menu';
import { MatSort } from '@angular/material/sort';
import { ToastNotifierService } from '../../../../_services/toast-notifier.service';

import { TranslateService } from '@ngx-translate/core';

import { TableType, ParameterTableOptions, ParameterType, ParameterSet, TableRowType, TableCellAlignType, ParameterRow, TableCell, TableCellType, InputOptionType, GaugeEvent, GaugeEventType, GaugeEventActionType } from '../../../../_models/hmi';
import { DeviceType } from '../../../../_models/device';
import { Utils } from '../../../../_helpers/utils';
import { Subject, Subscription } from 'rxjs';
import { DataConverterService } from '../../../../_services/data-converter.service';
import { ScriptService } from '../../../../_services/script.service';
import { ProjectService } from '../../../../_services/project.service';
import { SCRIPT_PARAMS_MAP, ScriptParam } from '../../../../_models/script';
import { HmiService } from '../../../../_services/hmi.service';
import { ReportsService } from '../../../../_services/reports.service';
import { CommandService } from '../../../../_services/command.service';
import { LanguageService } from '../../../../_services/language.service';
import { ParameterSetDialogComponent } from './parameter-set-dialog.component';
import { ParameterDeleteConfirmDialogComponent, ParameterDeleteConfirmDialogData } from './parameter-delete-confirm-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../gui-helpers/confirm-dialog/confirm-dialog.component';
import { HttpClient } from '@angular/common/http';

@Component({
    selector: 'app-parameter-table',
    templateUrl: './parameter-table.component.html',
    styleUrls: ['./parameter-table.component.scss'],
})
export class ParameterTableComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {

    @ViewChild(MatTable, { static: false }) table: MatTable<any>;
    @ViewChild(MatSort, { static: false }) sort: MatSort;
    @ViewChild(MatMenuTrigger, { static: false }) trigger: MatMenuTrigger;
    @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;

    settings: any;
    @Input() property: any;
    @Output() propertyChange = new EventEmitter<any>();

    private pollingSubscription: Subscription;
    loading = false;
    id: string;
    type: TableType;
    isEditor: boolean;
    displayedColumns = [];
    columnsStyle = {};

    private invalidOdbcDevices = new Set<string>();
    dataSource = new MatTableDataSource([]);
    tagsMap = {};
    timestampMap = {};
    private isAutoRefreshRunning = false;
    executedQueries = new Set<string>();
    tagsColumnMap = {};

    parameterTypes: ParameterType[] = [];
    parameterSets: ParameterSet[] = [];
    selectedParameterType: ParameterType = null;
    selectedParameterSet: ParameterSet = null;
    tableData: any[] = [];
    currentTableDataHash = '';
    private lastDataHash = '';
    private tagsFetched = false;
    private editingCellId: string = null;

    cellErrors: Map<string, string> = new Map();

    isTypeDropdownOpen = false;
    isSetDropdownOpen = false;
    isPageSizeDropdownOpen = false;

    selectedPageSize = 25;
    pageSizeOptions = [10, 25, 100];

    withToolbar = true;

    enableEdit = false;

    selectedRow: any = null;
    debugMessage: string = 'No row selected';
    events: GaugeEvent[];
    eventSelectionType = Utils.getEnumKey(GaugeEventType, GaugeEventType.select);

    editingRowIndex: number = -1;
    editingColumn: string = '';

    emptyStateMessage: string = null;
    emptyStateActionLabel = 'Add Parameter Set';
    @Input()
    get options(): ParameterTableOptions {
        return this.tableOptions;
    }
    set options(value: ParameterTableOptions) {
        this.setOptions(value);
    }
    tableOptions = ParameterTableComponent.DefaultOptions();

    // Dialog properties
    showParameterSetDialog = false;
    parameterSetDialogData: any = null;
    showParameterDeleteDialog = false;
    parameterDeleteDialogData: any = null;

    private destroy$ = new Subject<void>();

    constructor(
        private dataService: DataConverterService,
        private projectService: ProjectService,
        private hmiService: HmiService,
        private scriptService: ScriptService,
        private reportsService: ReportsService,
        private languageService: LanguageService,
        private commandService: CommandService,
        private translateService: TranslateService,
        private cdr: ChangeDetectorRef,
        private http: HttpClient,
        private toastNotifier: ToastNotifierService) { }

    async ngOnInit() {
        if (this.property) {
            this.setOptions(this.property);
        }
        
        await this.initializeFromOptions();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes.options && !changes.options.firstChange) {
            // Options changed, reload parameter types to get updated data
            this.loadParameterTypes();
        }
        if (changes.property && !changes.property.firstChange) {
            // Property changed, load options from property and initialize
            if (this.property) {
                this.setOptions(this.property);
                this.initializeFromOptions();
            }
        }
    }

    ngAfterViewInit() {
        if (this.table) {
            this.table.dataSource = this.dataSource;
        }
        if (this.sort) {
            this.dataSource.sort = this.sort;
        }
        if (this.paginator && this.tableOptions?.paginator?.show) {
            this.dataSource.paginator = this.paginator;
        }
        }

    ngOnDestroy() {
        this.destroy$.next(null);
        this.destroy$.complete();
        if (this.pollingSubscription) {
            this.pollingSubscription.unsubscribe();
        }
    }

    private onVariableChanged(variable: any) {
        if (this.selectedParameterType && variable && variable.id) {
            let hasChanges = false;
            this.tableData.forEach(row => {
                Object.keys(row).forEach(key => {
                    const cell = row[key];
                    const uniqueCellId = `${row.id}_${cell?.cell?.id}`;
                    const boundTagId = (this.selectedParameterSet && this.selectedParameterSet.tagBindings) ? this.selectedParameterSet.tagBindings[uniqueCellId] : null;
                    const effectiveTagId = boundTagId || (cell && cell.cell && cell.cell.variableId);
                    if (cell && effectiveTagId === variable.id && cell?.cell?.id !== this.editingCellId) {
                        const newValue = variable.value !== undefined ? String(variable.value) : '';
                        if (cell.value !== newValue) {
                            cell.value = newValue;
                            hasChanges = true;
                        }
                    }
                });
            });
            if (hasChanges) {
                this.dataSource.data = this.tableData;
            }
        }
    }

    private async fetchTagValues(tagIds: string[]) {
        try {
            const values = await this.projectService.getTagsValues(tagIds);
            values.forEach((value, index) => {
                const tagId = tagIds[index];
                if (!this.hmiService.variables[tagId]) {
                    this.hmiService.addSignal(tagId);
                }
                if (value) {
                    this.hmiService.variables[tagId].value = value.value;
                    this.hmiService.setSignalValue(this.hmiService.variables[tagId]);
                }
            });
            this.tableData.forEach(row => {
                Object.keys(row).forEach(key => {
                    const cell = row[key];
                    const uniqueCellId = `${row.id}_${cell?.cell?.id}`;
                    const boundTagId = (this.selectedParameterSet && this.selectedParameterSet.tagBindings) ? this.selectedParameterSet.tagBindings[uniqueCellId] : null;
                    const effectiveTagId = boundTagId || (cell && cell.cell && cell.cell.variableId);
                    if (cell && effectiveTagId && tagIds.includes(effectiveTagId)) {
                        const tagValue = this.hmiService.variables[effectiveTagId]?.value;
                        cell.value = tagValue !== undefined ? String(tagValue) : '';
                    }
                });
            });
            this.dataSource.data = this.tableData;
        } catch (error) {
            console.error('Failed to fetch tag values:', error);
        }
    }

    private async loadParameterTypes() {
        try {
            if (this.tableOptions.storageType === 'odbc' && this.tableOptions.odbcDeviceId) {
                const devices = this.projectService.getDevices();
                if (!devices[this.tableOptions.odbcDeviceId] || devices[this.tableOptions.odbcDeviceId].type !== DeviceType.ODBC) {
                    this.parameterTypes = [];
                    return;
                }
            }
            if (this.tableOptions.storageType === 'odbc' && !this.tableOptions.odbcDeviceId) {
                this.parameterTypes = [];
                return;
            }
            const params = new URLSearchParams();
            params.append('storageType', this.tableOptions.storageType || 'sqlite');
            params.append('odbcDeviceId', this.tableOptions.odbcDeviceId || '');
            const response = await this.http.get<{ types: ParameterType[] }>(`/api/parameters-table/types?${params.toString()}`).toPromise();
            const allTypes = response.types || [];
            const assignedTypeIds = this.tableOptions.parameterTypeIds || (this.tableOptions.parameterTypeId ? [this.tableOptions.parameterTypeId] : []);
            if (assignedTypeIds.length > 0) {
                this.parameterTypes = allTypes.filter(type => assignedTypeIds.includes(type.id));
            } else {
                this.parameterTypes = allTypes;
            }
        } catch (error) {
            console.error('Failed to load parameter types:', error);
            this.toastNotifier.notifyError('msg.failed-load-parameter-types', error.message || '');
            this.parameterTypes = [];
            if (error.status === 400) {
                this.tableOptions.odbcDeviceId = null;
                if (this.property) {
                    this.property.odbcDeviceId = null;
                }
            }
        }
    }

    private async saveParameterType(type: ParameterType) {
        try {
            const body = { type, storage: {storageType: this.tableOptions.storageType, odbcDeviceId: this.tableOptions.odbcDeviceId} };
            await this.http.post('/api/parameters-table/types', body).toPromise();
        } catch (error) {
            console.error('Failed to save parameter type:', error);
            this.toastNotifier.notifyError('msg.failed-save-parameter-type', error.message || '');
        }
    }

    async onParameterTypeChange(type: ParameterType) {
        await this.loadParameterTypes();
        const updatedType = this.parameterTypes.find(t => t.id === type.id);
        if (updatedType) {
            this.selectedParameterType = updatedType;
        } else {
            this.selectedParameterType = type; 
        }

        this.selectedParameterType.rows.forEach((row, rowIndex) => {
            if (!row.id) {
                row.id = `${this.selectedParameterType.id}_row_${rowIndex}`;
            }
        });

        this.tagsFetched = false;  
        
        if (!this.selectedParameterType.columnStyles) {
            this.selectedParameterType.columnStyles = {};
        }
        
        this.tableOptions.parameterTypeId = type.id;
        this.syncPropertyOptions();  
        await this.loadParameterSetsForType(type.id);
        let setToSelect = null;
        if (this.selectedParameterType.lastWrittenSetId) {
            setToSelect = this.parameterSets.find(s => s.id === this.selectedParameterType.lastWrittenSetId);
        }
        if (!setToSelect && this.tableOptions.lastSelectedSetsByType && this.tableOptions.lastSelectedSetsByType[type.id]) {
            setToSelect = this.parameterSets.find(s => s.id === this.tableOptions.lastSelectedSetsByType[type.id]);
        }
        if (!setToSelect && this.parameterSets.length > 0) {
            setToSelect = this.parameterSets[0];
        }
        if (setToSelect) {
            this.onParameterSetChange(setToSelect);
        } else {
            this.selectedParameterSet = null;
            this.buildTableData();
        }}

    onParameterSetChange(set: ParameterSet) {
        this.selectedParameterSet = set;
        if (this.selectedParameterType && this.selectedParameterType.id) {
            this.tableOptions.lastSelectedSetsByType[this.selectedParameterType.id] = set.id;
        }
        this.syncPropertyOptions();  
        this.tagsFetched = false;  


        this.buildTableData();
    }

    private async loadParameterSetsForType(typeId: string) {
        if (!typeId) {
            this.parameterSets = [];
            return;
        }
        try {
            const params = new URLSearchParams();
            params.append('typeId', typeId);
            params.append('storageType', this.tableOptions.storageType || 'sqlite');
            params.append('odbcDeviceId', this.tableOptions.odbcDeviceId || '');
            const response = await this.http.get<{ sets: ParameterSet[] }>(`/api/parameters-table/sets?${params.toString()}`).toPromise();
            this.parameterSets = (response.sets || []).map(set => {
                if (!set.values) set.values = {};
                if (!set.labels) set.labels = {};
                if (!set.tagBindings) set.tagBindings = {};
                
                return set;
            });
        } catch (error) {
            console.error('Failed to load parameter sets:', error);
            this.toastNotifier.notifyError('msg.failed-load-parameter-sets', error.message || '');
            this.parameterSets = [];
        }
    }

    private buildTableData() {
        this.emptyStateMessage = null;
        this.emptyStateActionLabel = null;
        if (!this.selectedParameterType) {
            this.tableData = [];
            this.displayedColumns = [];
            this.columnsStyle = {};
            this.emptyStateMessage = this.translateService.instant('parameter.empty-type-message');
            this.updateTableIfChanged();
            return;
        }

        if (!this.selectedParameterSet) {
            this.tableData = [];
            this.displayedColumns = [];
            this.columnsStyle = {};
            this.emptyStateMessage = this.translateService.instant('parameter.empty-state-message');
            this.emptyStateActionLabel = this.translateService.instant('parameter.empty-state-action');
            this.updateTableIfChanged();
            return;
        }

        this.tableData = [];
        this.displayedColumns = [];
        this.columnsStyle = {};

        const tagIdsToFetch: string[] = [];

        const allCells = new Map<string, TableCell>();
        this.selectedParameterType.columns.forEach(column => {
            if (column && column.id) {
                allCells.set(column.id, column);
            }
        });

        if (!this.tagsFetched) {
            this.selectedParameterType.rows.forEach((row, rowIndex) => {
                if (row.cells) {
                    row.cells.forEach(cell => {
                        if (cell && cell.id && cell.type === TableCellType.variable) {
                            const uniqueCellId = `${row.id}_${cell.id}`;
                            const boundTagId = (this.selectedParameterSet && this.selectedParameterSet.tagBindings) ? this.selectedParameterSet.tagBindings[uniqueCellId] : null;
                            const effectiveTagId = boundTagId || cell.variableId;
                            if (effectiveTagId && (!this.selectedParameterType.deviceId || !this.getDeviceIdFromTag(effectiveTagId) || this.getDeviceIdFromTag(effectiveTagId) === this.selectedParameterType.deviceId)) {
                                tagIdsToFetch.push(effectiveTagId);
                            }
                        }
                    });
                }
            });
            if (tagIdsToFetch.length > 0) {
                this.fetchTagValues(tagIdsToFetch);
            }
            this.tagsFetched = true;
        }


        allCells.forEach(cell => {
                if (!this.displayedColumns.includes(cell.id)) {
                    this.displayedColumns.push(cell.id);
                    const typeStyle = (this.selectedParameterType && this.selectedParameterType.columnStyles) ? this.selectedParameterType.columnStyles[cell.id] : null;
                    const widthVal = typeStyle && typeStyle.width ? Number(typeStyle.width) : 100;
                    const alignVal = typeStyle && typeStyle.align ? typeStyle.align : TableCellAlignType.left;
                    const headerLabel = cell.label || '';
                    this.columnsStyle[cell.id] = {
                        id: cell.id,
                        label: headerLabel || `Column ${this.displayedColumns.length}`,
                        width: widthVal,
                        align: alignVal,
                        color: this.tableOptions.header.color,
                        fontSize: this.tableOptions.header.fontSize,
                        type: cell.type
                    };
                }
        });

        this.selectedParameterType.rows.forEach((row, rowIndex) => {
            const rowData: any = {
                id: row.id,
                type: row.type,
                rowIndex: rowIndex
            };

            if (row.type === TableRowType.text) {
                rowData.textContent = row.textContent || '';
                rowData.textAlign = row.textAlign || TableCellAlignType.left;
                rowData.textSize = row.textSize;
                rowData.textBold = row.textBold;
            } else {
                this.displayedColumns.forEach(columnId => {
                    const cell = row.cells?.find(c => c.id === columnId);
                    if (cell) {
                        let value = '';
                        let label = cell.label || '';

                        if (this.selectedParameterSet) {
                            if (!this.selectedParameterSet.values) {
                                this.selectedParameterSet.values = {};
                            }
                            if (!this.selectedParameterSet.labels) {
                                this.selectedParameterSet.labels = {};
                            }
                            

                            const uniqueCellId = `${row.id}_${cell.id}`;
                            if (cell.isEditable) {
                                const storedValue = this.selectedParameterSet.values[uniqueCellId];
                                value = storedValue !== undefined ? String(storedValue) : '';
                            } else if (cell.type === TableCellType.variable) {
                                let boundTagId = this.selectedParameterSet && this.selectedParameterSet.tagBindings && this.selectedParameterSet.tagBindings[uniqueCellId] ? this.selectedParameterSet.tagBindings[uniqueCellId] : cell.variableId;
                                if (boundTagId && this.hmiService.variables[boundTagId]) {
                                    if (!this.hmiService.variables[boundTagId]) {
                                        this.hmiService.addSignal(boundTagId);
                                    }
                                    const tagValue = this.hmiService.variables[boundTagId].value;
                                    value = tagValue !== undefined ? String(tagValue) : '';
                                } else {
                                    const storedValue = this.selectedParameterSet.values[uniqueCellId];
                                    value = storedValue !== undefined ? String(storedValue) : '';
                                }
                            } else {
                                value = this.selectedParameterSet.values[uniqueCellId];
                                if (value === undefined || value === '') {
                                    value = cell.label || '';
                                }
                            }
                            label = this.selectedParameterSet.labels[uniqueCellId] || label;
                        } else {
                            if (cell.type === TableCellType.variable && cell.variableId) {
                                if (!this.hmiService.variables[cell.variableId]) {
                                    this.hmiService.addSignal(cell.variableId);
                                }
                                const tagValue = this.hmiService.variables[cell.variableId]?.value;
                                value = tagValue !== undefined ? String(tagValue) : '';
                            } else {
                                value = cell.isEditable ? (cell.label || '') : '';
                            }
                        }

                        rowData[cell.id] = {
                            value: value,
                            label: label,
                                cell: {
                                id: cell.id,
                                label: cell.label,
                                variableId: cell.variableId,
                                type: cell.type,
                                isEditable: cell.isEditable,
                                inputType: cell.inputType,
                                inputMin: cell.inputMin,
                                inputMax: cell.inputMax,
                                valueFormat: cell.valueFormat
                            }, 
                isEditable: cell.isEditable || false
                        };
                    } else {
                        rowData[columnId] = {
                            value: '',
                            label: '',
                            cell: null,
                            isEditable: false
                        };
                    }
                });
            }

            this.tableData.push(rowData);
        });

        this.updateTableIfChanged();
    }

    private updateTableIfChanged() {
        const currentHash = JSON.stringify(this.tableData);
        if (currentHash !== this.lastDataHash) {
            this.lastDataHash = currentHash;
            this.dataSource.data = this.tableData;
        }
    }

    onSaveSetToDB() {
        if (!this.selectedParameterSet) return;

        if (this.hasValidationErrors()) {
            this.toastNotifier.notifyError('msg.save-parameter-set-failed', 'Resolve validation errors before saving');
            return;
        }
        
        this.saveParameterSet();
    }

    async onSaveToTags() {
        if (!this.selectedParameterSet || !this.selectedParameterType) {
            this.toastNotifier.notifyError('msg.write-to-device-failed', 'No parameter set or type selected');
            return;
        }

        if (this.hasValidationErrors()) {
            this.toastNotifier.notifyError('msg.write-to-device-failed', 'Resolve validation errors before writing');
            return;
        }

        try {
            const params = new URLSearchParams();
            params.append('storageType', this.tableOptions.storageType || 'sqlite');
            params.append('odbcDeviceId', this.tableOptions.odbcDeviceId || '');
            const response = await this.http.get<{ set: ParameterSet }>(`/api/parameters-table/set/${this.selectedParameterSet.id}?${params.toString()}`).toPromise();
            const savedParameterSet = response.set;

            if (!savedParameterSet || !savedParameterSet.values) {
                this.toastNotifier.notifyError('msg.write-to-device-failed', 'No saved parameter set data found');
                return;
            }

            let writeCount = 0;
            this.selectedParameterType.rows.forEach((row, rowIndex) => {
                if (!row.id) {
                    row.id = `${this.selectedParameterType.id}_row_${rowIndex}`;
                }
            });
            this.selectedParameterType.rows.forEach((row, rowIndex) => {
                if (row.type === TableRowType.column && row.cells) {
                    row.cells.forEach(cell => {
                        if (cell.type === TableCellType.variable && cell.enableWrite) {
                            const uniqueCellId = `${row.id}_${cell.id}`;
                            const tagId = (savedParameterSet.tagBindings && savedParameterSet.tagBindings[uniqueCellId]) || cell.variableId;
                            if (tagId && (!this.selectedParameterType.deviceId || !this.getDeviceIdFromTag(tagId) || this.getDeviceIdFromTag(tagId) === this.selectedParameterType.deviceId)) {
                                const value = savedParameterSet.values[uniqueCellId];
                                if (value !== undefined && value !== '' && tagId) {
                                    this.hmiService.putSignalValue(tagId, String(value));
                                    writeCount++;
                                }
                            }
                        }
                    });
                }
            });

            if (writeCount > 0) {
                this.toastNotifier.notifySuccess('msg.write-to-device-success');
                this.selectedParameterType.lastWrittenSetId = this.selectedParameterSet.id;
                this.saveParameterType(this.selectedParameterType);  
            } else {
                this.toastNotifier.notifyError('msg.write-to-device-failed', 'No writable cells found');
            }
        } catch (error) {
            console.error('Failed to reload parameter set for writing:', error);
            this.toastNotifier.notifyError('msg.write-to-device-failed', 'Failed to load saved parameter data');
        }

    }

    onReadFromTags() {
        if (!this.selectedParameterSet || !this.selectedParameterType) {
            this.toastNotifier.notifyError('msg.read-from-device-failed', 'No parameter set or type selected');
            return;
        }

        let readCount = 0;
        this.selectedParameterType.rows.forEach((row, rowIndex) => {
            if (!row.id) {
                row.id = `${this.selectedParameterType.id}_row_${rowIndex}`;
            }
        });
        this.selectedParameterType.rows.forEach((row, rowIndex) => {
            if (row.type === TableRowType.column && row.cells) {
                row.cells.forEach(cell => {
                    if (cell.type === TableCellType.variable && cell.enableWrite) {
                        if (!this.selectedParameterType.deviceId || !cell.deviceId || cell.deviceId === this.selectedParameterType.deviceId) {
                            const uniqueCellId = `${row.id}_${cell.id}`;
                            const tagId = (this.selectedParameterSet.tagBindings && this.selectedParameterSet.tagBindings[uniqueCellId]) || cell.variableId;
                            
                            if (tagId && this.hmiService.variables[tagId]) {
                                const value = this.hmiService.variables[tagId].value;
                                if (value !== undefined) {
                                    const uniqueCellId = `${row.id}_${cell.id}`;
                                    this.selectedParameterSet.values[uniqueCellId] = value;
                                    this.selectedParameterSet.modified = new Date();
                                    readCount++;
                                }
                            }
                        }
                    }
                });
            }
        });

        if (readCount > 0) {
            this.toastNotifier.notifySuccess('msg.read-from-device-success');
        } else {
            this.toastNotifier.notifyError('msg.read-from-device-failed', 'No readable cells found');
        }

        this.buildTableData();

        this.saveParameterSet();
    }

    private async saveParameterSet() {
        if (!this.selectedParameterSet || !this.selectedParameterSet.id) {
            console.error('Cannot save parameter set: missing parameter set or ID');
            this.toastNotifier.notifyError('msg.save-parameter-set-failed', 'Missing parameter set or ID');
            return;
        }

        try {
            const body = { set: this.selectedParameterSet, storage: {storageType: this.tableOptions.storageType, odbcDeviceId: this.tableOptions.odbcDeviceId} };
            const response = await this.http.put(`/api/parameters-table/sets/${this.selectedParameterSet.id}`, body).toPromise();
            this.toastNotifier.notifySuccess('msg.save-parameter-set-success');
        } catch (error) {
            console.error('Error saving parameter set:', error);
            this.toastNotifier.notifyError('msg.save-parameter-set-failed', error.message || 'Unknown error');
        }
    }

    onExportData() {
        if (!this.selectedParameterType) return;

        const exportData = {
            parameterType: this.selectedParameterType,
            parameterSets: this.parameterSets,
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const url = window.URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `parameter-table-${this.selectedParameterType.name}-${new Date().toISOString().split('T')[0]}.json`;
        link.click();

        window.URL.revokeObjectURL(url);
    }

    onImportData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (event) => this.handleFileImport(event);
        input.click();
    }

    private async handleFileImport(event: any) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const importData = JSON.parse(text);

            if (importData.parameterType && importData.parameterSets) {
                if (!importData.parameterType.id) importData.parameterType.id = Utils.getShortGUID('pt_');
                const body = { type: importData.parameterType, storage: {storageType: this.tableOptions.storageType, odbcDeviceId: this.tableOptions.odbcDeviceId} };
                await this.http.post('/api/parameters-table/types', body).toPromise();
                await this.loadParameterTypes();
                const newType = this.parameterTypes.find(t => t.id === importData.parameterType.id);

                for (const set of importData.parameterSets) {
                    set.typeId = newType.id; 
                    const setBody = { set: set, storage: {storageType: this.tableOptions.storageType, odbcDeviceId: this.tableOptions.odbcDeviceId} };
                    await this.http.post('/api/parameters-table/sets', setBody).toPromise();
                }

                await this.loadParameterTypes();
                this.onParameterTypeChange(newType);
                this.toastNotifier.notifySuccess('msg.parameter-type-imported');
            } else {
                console.error('Invalid import file format');
                this.toastNotifier.notifyError('msg.invalid-import-file-format');
            }
        } catch (error) {
            console.error('Error importing data:', error);
            this.toastNotifier.notifyError('msg.failed-to-import-parameter-data', error.message || '');
        }
    }

    // Parameter Set Management Methods
    addParameterSet() {
        if (!this.selectedParameterType) return;

        this.parameterSetDialogData = { mode: 'add', parameterType: this.selectedParameterType, tableOptions: this.tableOptions };
        this.showParameterSetDialog = true;
    }

    copyParameterSet() {
        if (!this.selectedParameterSet) return;

        this.parameterSetDialogData = { mode: 'copy', parameterSet: this.selectedParameterSet, tableOptions: this.tableOptions };
        this.showParameterSetDialog = true;
    }

    renameParameterSet() {
        if (!this.selectedParameterSet) return;

        this.parameterSetDialogData = { mode: 'rename', parameterSet: this.selectedParameterSet, tableOptions: this.tableOptions };
        this.showParameterSetDialog = true;
    }

    deleteParameterSet() {
        if (!this.selectedParameterSet) return;

        this.parameterDeleteDialogData = { msg: `Are you sure you want to delete parameter set "${this.selectedParameterSet.name}"?`, tableOptions: this.tableOptions };
        this.showParameterDeleteDialog = true;
    }

    onCellValueChange(row: any, cellId: string, newValue: any) {
        if (!this.selectedParameterSet) return;

        const cellData = row[cellId];
        const cell = cellData?.cell;
        if (!cell) return;

        const uniqueCellId = `${row.id}_${cellId}`;
        let validatedValue = newValue;
        let errorMessage = '';

        if (cell.inputType === InputOptionType.number) {
            const numValue = parseFloat(newValue);
            
            if (newValue !== '' && newValue !== null && newValue !== undefined && isNaN(numValue)) {
                errorMessage = 'Invalid number format';
                validatedValue = newValue; 
            } else if (!isNaN(numValue)) {
                const minValue = cell.inputMin != null ? parseFloat(String(cell.inputMin)) : null;
                const maxValue = cell.inputMax != null ? parseFloat(String(cell.inputMax)) : null;
                
                if (minValue !== null && !isNaN(minValue) && maxValue !== null && !isNaN(maxValue)) {
                    if (numValue < minValue) {
                        errorMessage = `Value must be >= ${minValue} (max: ${maxValue})`;
                        validatedValue = newValue;
                    } else if (numValue > maxValue) {
                        errorMessage = `Value must be <= ${maxValue} (min: ${minValue})`;
                        validatedValue = newValue;
                    } else {
                        validatedValue = numValue;
                        this.cellErrors.delete(uniqueCellId);
                    }
                } else if (minValue !== null && !isNaN(minValue) && numValue < minValue) {
                    errorMessage = `Value must be >= ${minValue}`;
                    validatedValue = newValue;
                } else if (maxValue !== null && !isNaN(maxValue) && numValue > maxValue) {
                    errorMessage = `Value must be <= ${maxValue}`;
                    validatedValue = newValue;
                } else {
                    validatedValue = numValue;
                    this.cellErrors.delete(uniqueCellId);
                }
            } else {
                this.cellErrors.delete(uniqueCellId);
            }
        } else {
            this.cellErrors.delete(uniqueCellId);
        }

        if (errorMessage) {
            this.cellErrors.set(uniqueCellId, errorMessage);
        }

        if (!errorMessage) {
            this.selectedParameterSet.values[uniqueCellId] = validatedValue;
            this.selectedParameterSet.modified = new Date();
        }
        
    }

    onCellEditStart(cellId: string) {
        this.editingCellId = cellId;
    }

    onCellEditEnd(row: any, cellId: string) {
        this.editingCellId = null;
        
        const error = this.getCellError(row, cellId);
        if (error) {
            return;
        }
        
        const columnRow = this.selectedParameterType?.rows?.find(r => r.type === TableRowType.column);
        const cell = columnRow?.cells?.find(c => c.id === cellId);
        if (cell && cell.isEditable && cell.type === TableCellType.variable) {
            if (cell.autoSave) {
                this.saveParameterSet();
            }
            
            if (cell.autoWrite) {
                const uniqueCellId = `${row.id}_${cellId}`;
                const value = this.selectedParameterSet.values[uniqueCellId];
                const tagId = (this.selectedParameterSet.tagBindings && this.selectedParameterSet.tagBindings[uniqueCellId]) || cell.variableId;
                
                if (value !== undefined && value !== '' && tagId) {
                    this.hmiService.putSignalValue(tagId, String(value));
                    this.toastNotifier.notifySuccess('msg.auto-write-success');
                }
            }
        }
    }

    getCellValue(row: any, cellId: string): string {
        if (!this.selectedParameterSet) return '';
        
        const uniqueCellId = `${row.id}_${cellId}`;
        const value = this.selectedParameterSet.values[uniqueCellId];
        return value !== undefined ? String(value) : '';
    }

    getCellDisplayValue(row: any, cellId: string): string {
        const cellData = row[cellId];
        if (!cellData) return '';
        
        if (cellData.cell?.isEditable && this.selectedParameterSet) {
            const uniqueCellId = `${row.id}_${cellId}`;
            const storedValue = this.selectedParameterSet.values?.[uniqueCellId];
            if (storedValue !== undefined) {
                return this.formatCellValue(storedValue, cellData.cell);
            }
        }

        if (cellData.cell?.type === 'variable') {
            return this.formatCellValue(cellData.value || '', cellData.cell);
        } else {
            return cellData.label || cellData.cell?.label || '';
        }
    }

    private formatCellValue(value: any, cell: any): string {
        if (!cell || !cell.valueFormat) return String(value);
        
        return Utils.formatValue(String(value), cell.valueFormat);
    }

    getCellInputType(row: any, cellId: string): string {
        const cellData = row[cellId];
        if (!cellData?.cell) return 'text';
        
        if (cellData.cell.inputType === InputOptionType.number) {
            return 'number';
        }
        return 'text';
    }

    getCellMin(row: any, cellId: string): number | null {
        const cellData = row[cellId];
        const cell = cellData?.cell;
        if (!cell?.inputMin) return null;
        
        const minValue = parseFloat(String(cell.inputMin));
        return isNaN(minValue) ? null : minValue;
    }

    getCellMax(row: any, cellId: string): number | null {
        const cellData = row[cellId];
        const cell = cellData?.cell;
        if (!cell?.inputMax) return null;
        
        const maxValue = parseFloat(String(cell.inputMax));
        return isNaN(maxValue) ? null : maxValue;
    }

    getCellError(row: any, cellId: string): string | null {
        const uniqueCellId = `${row.id}_${cellId}`;
        return this.cellErrors.get(uniqueCellId) || null;
    }

    private hasValidationErrors(): boolean {
        return this.cellErrors.size > 0;
    }

    onCellLabelChange(row: any, cellId: string, newLabel: string) {
        if (!this.selectedParameterSet) return;

        const uniqueCellId = `${row.id}_${cellId}`;
        this.selectedParameterSet.labels[uniqueCellId] = newLabel;
        this.selectedParameterSet.modified = new Date();
        this.saveParameterSet();
    }

    // Custom dropdown methods
    toggleTypeDropdown() {
        this.isTypeDropdownOpen = !this.isTypeDropdownOpen;
        this.isSetDropdownOpen = false;
    }

    toggleSetDropdown() {
        this.isSetDropdownOpen = !this.isSetDropdownOpen;
        this.isTypeDropdownOpen = false;
    }

    selectParameterType(type: ParameterType) {
        this.onParameterTypeChange(type);
        this.isTypeDropdownOpen = false;
    }

    selectParameterSet(set: ParameterSet) {
        this.onParameterSetChange(set);
        this.isSetDropdownOpen = false;
    }

    get selectedTypeLabel(): string {
        return this.selectedParameterType ? this.selectedParameterType.name : this.translateService.instant('parameter.type-select');
    }

    get selectedSetLabel(): string {
        return this.selectedParameterSet ? this.selectedParameterSet.name : this.translateService.instant('parameter.set-select');
    }

    getSelectStyles(isOpen: boolean = false): { [key: string]: string } {
        return {
            backgroundColor: this.tableOptions.toolbar?.buttonColor || this.tableOptions.header.background,
            color: this.tableOptions.toolbar?.color || this.tableOptions.header.color,
            borderRadius: '3px',
            padding: '0px 8px',
            height: '26px',
            display: 'flex',
            alignItems: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        };
    }

    getDropdownStyles(): { [key: string]: string } {
        return {
            backgroundColor: this.tableOptions.toolbar?.background || this.tableOptions.header.background,
            color: this.tableOptions.toolbar?.color || this.tableOptions.header.color
        };
    }

    getOptionStyle(isSelected: boolean): { [key: string]: string } {
        if (isSelected) {
            return {
                backgroundColor: this.tableOptions.toolbar?.buttonColor || this.tableOptions.header.background,
                color: this.tableOptions.toolbar?.color || this.tableOptions.header.color,
                fontWeight: 'bold'
            };
        }
        return {
            color: this.tableOptions.toolbar?.color || this.tableOptions.header.color
        };
    }

    getCellTextAlign(element: any, columnId: string): string {
        if (element.type === 'text') {
            return element.textAlign || 'left';
        } else {
            const columnStyle = this.columnsStyle[columnId] || {} as any;
            return columnStyle.align || 'left';
        }
    }

    getHeaderClass(align: string): string {
        switch (align) {
            case 'center':
                return 'center';
            case 'right':
                return 'right';
            case 'left':
            default:
                return 'left';
        }
    }

    // Paginator methods
    togglePageSizeDropdown() {
        this.isPageSizeDropdownOpen = !this.isPageSizeDropdownOpen;
    }

    canGoPrevious(): boolean {
        return this.paginator && this.paginator.pageIndex > 0;
    }

    canGoNext(): boolean {
        return this.paginator && (this.paginator.pageIndex < this.paginator.getNumberOfPages() - 1);
    }

    previousPage() {
        if (this.canGoPrevious()) {
            this.paginator.previousPage();
        }
    }

    nextPage() {
        if (this.canGoNext()) {
            this.paginator.nextPage();
        }
    }

    selectPageSize(value: number) {
        this.selectedPageSize = value;
        this.paginator.pageSize = value;
        this.isPageSizeDropdownOpen = false;
    }

    get selectedPageSizeLabel(): string {
        return this.selectedPageSize.toString();
    }

    // Editing methods
    startEditing(rowIndex: number, column: string) {
        if (!this.enableEdit) return;
        this.editingRowIndex = rowIndex;
        this.editingColumn = column;
        this.editingCellId = this.tableData[rowIndex][column]?.cell?.id;
    }

    onCellInputEnter(event: KeyboardEvent) {
        event.preventDefault();
        event.stopPropagation();
        const target = event.target as HTMLInputElement;
        
        if (this.editingRowIndex >= 0 && this.editingColumn) {
            const row = this.tableData[this.editingRowIndex];
            if (row) {
                const error = this.getCellError(row, this.editingColumn);
                if (error) {
                    return;
                }
            }
        }
        
        this.confirmEdit();
        target.blur();
    }

    @HostListener('document:click', ['$event'])
    handleDocumentClick(event: MouseEvent) {
        if (this.editingRowIndex < 0 || !this.editingColumn) {
            return;
        }

        const target = event.target as Node;
        const selector = `[data-editing-row="${this.editingRowIndex}"][data-editing-column="${this.editingColumn}"]`;
        const editingContainer = document.querySelector(selector);

        if (editingContainer && !editingContainer.contains(target)) {
            this.cancelEdit();
        }
    }

    confirmEdit() {
        if (this.editingRowIndex >= 0 && this.editingColumn) {
            const row = this.tableData[this.editingRowIndex];
            if (row) {
                const error = this.getCellError(row, this.editingColumn);
                if (error) {
                    return;
                }
            }
        }
        
        this.editingRowIndex = -1;
        this.editingColumn = '';
        this.editingCellId = null;
    }

    cancelEdit() {
        this.editingRowIndex = -1;
        this.editingColumn = '';
        this.editingCellId = null;
    }

    isEditingCell(rowIndex: number, column: string): boolean {
        return this.editingRowIndex === rowIndex && this.editingColumn === column;
    }

    public static DefaultOptions(): ParameterTableOptions {
        let options = <ParameterTableOptions>{
            paginator: {
                show: true
            },
            filter: {
                show: false
            },
            daterange: {
                show: false
            },
            realtime: false,
            refreshInterval: 5,
            lastRange: null,
            gridColor: '#E0E0E0',
            header: {
                show: true,
                height: 30,
                fontSize: 12,
                background: '#F0F0F0',
                color: '#757575',
            },
            toolbar: {
                background: '#F0F0F0',
                color: '#757575',
                buttonColor: '#F0F0F0',
            },
            row: {
                height: 30,
                fontSize: 10,
                background: '#F9F9F9',
                color: '#757575ff',
            },
            selection: {
                background: '#e0e0e0ff',
                color: '#757575ff',
                fontBold: true,
            },
            columns: [],
            alarmsColumns: [],
            alarmFilter: { filterA: [], filterB: [], filterC: [] },
            reportsColumns: [],
            reportFilter: { filterA: [] },
            parameterTypeIds: [],
            showEnableEditInFooter: false,
            rows: [],
            parameterTypeId: null,
            lastSelectedSetsByType: {},
            storageType: 'sqlite',
            odbcDeviceId: null,
        };
        return options;
    }

    private syncPropertyOptions() {
        if (this.property) {
            Object.assign(this.property, this.tableOptions);
            this.propertyChange.emit(this.property);
        }
    }

    private async initializeFromOptions() {
        await this.loadParameterTypes();
        
        const assignedTypeIds = this.tableOptions.parameterTypeIds || (this.tableOptions.parameterTypeId ? [this.tableOptions.parameterTypeId] : []);
        if (assignedTypeIds.length > 0) {
            const typeToSelect = this.parameterTypes.find(t => t.id === assignedTypeIds[0]);
            if (typeToSelect) {
                setTimeout(() => this.onParameterTypeChange(typeToSelect), 100);
            }
        } else {
            this.buildTableData();
        }
        
        this.hmiService.onVariableChanged.subscribe((variable) => {
            this.onVariableChanged(variable);
        });
    }

    setOptions(options: ParameterTableOptions) {
        let defaultOptions = ParameterTableComponent.DefaultOptions();
        this.tableOptions = Object.assign({}, defaultOptions, options);
        if (this.tableOptions.odbcDeviceId) {
            const devices = this.projectService.getDevices();
            if (!devices[this.tableOptions.odbcDeviceId] || devices[this.tableOptions.odbcDeviceId].type !== DeviceType.ODBC) {
                this.tableOptions.odbcDeviceId = null;
            }
        }
        this.events = this.property?.events || [];
        if (!this.tableOptions.parameterTypeIds) {
            this.tableOptions.parameterTypeIds = [];
        }
        if (this.property) {
            Object.assign(this.property, this.tableOptions);
        }
        if (!this.tableOptions.paginator) {
            this.tableOptions.paginator = { show: true };
        } else if (this.tableOptions.paginator.show === undefined) {
            this.tableOptions.paginator.show = true;
        }
        const assignedTypeIds = this.tableOptions.parameterTypeIds || (this.tableOptions.parameterTypeId ? [this.tableOptions.parameterTypeId] : []);
        if (assignedTypeIds.length > 0) {
            this.loadParameterTypes().then(() => {
                const type = this.parameterTypes.find(t => t.id === assignedTypeIds[0]);
                if (type) {
                    this.onParameterTypeChange(type);
                }
            });
        }
        if (this.paginator) {
            if (this.tableOptions?.paginator?.show) {
                this.dataSource.paginator = this.paginator;
            } else {
                this.dataSource.paginator = null;
            }
        }
    }

    private getDeviceIdFromTag(tagId: string): string | null {
        const device = this.projectService.getDeviceFromTagId(tagId);
        return device ? device.id : null;
    }

    isSelectable(): boolean {
        return true;
    }

    selectRow(row: any) {
        if (this.isSelectable()) {
            if (this.selectedRow === row) {
                this.selectedRow = null;
            } else {
                this.selectedRow = row;
            }
            
            if (this.events && this.events.length > 0) {
                this.events.forEach(event => {
                    if (event.action === Utils.getEnumKey(GaugeEventActionType, GaugeEventActionType.onSetTag)) {
                        this.setTagValue(event, this.selectedRow);
                    } else {
                        this.runScript(event, this.selectedRow);
                    }
                });
            }
        }
    }

    isSelected(row: any) {
        return this.selectedRow === row;
    }



    private setTagValue(event: GaugeEvent, selected: any) {
        if (!event.actparam) {
            return;
        }
        const tagId = event.actparam;
        const tag = this.projectService.getTagFromId(tagId);
        if (!tag) {
            return;
        }
        let value: any;
        const type = tag.type.toLowerCase();
        if (type.includes('bool')) {
            value = selected ? true : false;
        } else if (type.includes('number') || type.includes('int') || type.includes('word') || type.includes('real')) {
            value = selected ? this.dataSource.data.indexOf(selected) + 1 : 0; 
        } else if (type.includes('string') || type.includes('char')) {
            if (selected) {
                const rowData = {};
                this.displayedColumns.forEach(col => {
                    const cell = selected[col];
                    if (cell) {
                        const columnName = this.columnsStyle[col] && this.columnsStyle[col].label && this.columnsStyle[col].label !== 'undefined' ? this.columnsStyle[col].label : col;
                        let value: any;
                        
                        if (cell.cell?.isEditable && this.selectedParameterSet) {
                            const uniqueCellId = `${selected.id}_${col}`;
                            const storedValue = this.selectedParameterSet.values?.[uniqueCellId];
                            if (storedValue !== undefined) {
                                value = storedValue;
                            } else {
                                value = cell.value || '';
                            }
                        } else {
                            value = cell.value || '';
                        }
                        
                        if (typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value)) && !isNaN(parseFloat(value))) {
                            value = Number(value);
                        }
                        rowData[columnName] = value;
                    }
                });
                value = JSON.stringify(rowData);
            } else {
                value = '';
            }
        } else {
            return;
        }
        this.scriptService.$setTag(tagId, value);
    }

    private runScript(event: GaugeEvent, selected: any) {
        if (event.actparam) {
            let torun = Utils.clone(this.projectService.getScripts().find(dataScript => dataScript.id == event.actparam));
            if (torun) {
                torun.parameters = <ScriptParam[]>Utils.clone(event.actoptions[SCRIPT_PARAMS_MAP]);
                torun.parameters.forEach(param => {
                    if (Utils.isNullOrUndefined(param.value)) {
                        param.value = selected;
                    }
                });
                this.scriptService.runScript(torun).subscribe(result => {
                }, err => {
                    console.error(err);
                });
            }
        }
    }

    // Dialog event handlers
    onParameterSetDialogClose(result: any) {
        const mode = this.parameterSetDialogData?.mode; 
        this.showParameterSetDialog = false;
        this.parameterSetDialogData = null;
        if (result) {
            this.handleParameterSetDialogResult(result, mode);
        }
    }

    onParameterDeleteDialogClose(result: boolean) {
        this.showParameterDeleteDialog = false;
        this.parameterDeleteDialogData = null;
        if (result) {
            this.handleParameterDeleteConfirm();
        }
    }

    private async handleParameterSetDialogResult(result: any, mode?: string) {
        if (mode === 'add') {
            await this.createParameterSet(result);
        } else if (mode === 'copy') {
            await this.copyParameterSetWithResult(result);
        } else if (mode === 'rename') {
            await this.renameParameterSetWithResult(result);
        }
    }

    private async createParameterSet(result: any) {
        try {
            const newSet = new ParameterSet(this.selectedParameterType.id, result.name, this.selectedParameterType);
            newSet.description = result.description || '';
            newSet.userId = result.userId || '';
            
            if (this.selectedParameterType && this.selectedParameterType.rows) {
                this.selectedParameterType.rows.forEach((row, rowIndex) => {
                    if (row && row.cells) {
                        row.cells.forEach(cell => {
                            if (cell && cell.id) {
                                const uniqueCellId = `${row.id}_${cell.id}`;
                                
                                if (cell.type === TableCellType.variable && cell.variableId) {
                                    if (!this.hmiService.variables[cell.variableId]) {
                                        this.hmiService.addSignal(cell.variableId);
                                    }
                                    const currentTagValue = this.hmiService.variables[cell.variableId]?.value;
                                    if (currentTagValue !== undefined) {
                                        newSet.values[uniqueCellId] = String(currentTagValue);
                                    }
                                }
                                
                                if (cell.type === TableCellType.label && cell.label) {
                                    newSet.values[uniqueCellId] = cell.label;
                                }
                                
                                if (cell.type === TableCellType.variable && cell.variableId) {
                                    const uniqueCellId = `${row.id}_${cell.id}`;
                                    newSet.tagBindings[uniqueCellId] = cell.variableId;
                                }
                            }
                        });
                    }
                });
            }
            
            const body = { set: newSet, storage: {storageType: this.tableOptions.storageType, odbcDeviceId: this.tableOptions.odbcDeviceId} };
            const response = await this.http.post('/api/parameters-table/sets', body).toPromise();
            await this.loadParameterSetsForType(this.selectedParameterType.id);
            const createdSet = this.parameterSets.find(set => set.id === newSet.id);
            if (createdSet) {
                this.onParameterSetChange(createdSet);
            } else {
                this.onParameterSetChange(newSet);
            }
            this.toastNotifier.notifySuccess('msg.created-parameter-set');
        } catch (error) {
            console.error('Error creating parameter set:', error);
            console.error('Error details:', error.error || error.message);
            this.toastNotifier.notifyError('msg.failed-create-parameter-set', (error.error?.message || error.message) || '');
        }
    }

    private async copyParameterSetWithResult(result: any) {
        try {
            const copiedSet = JSON.parse(JSON.stringify(this.selectedParameterSet));
            copiedSet.id = Utils.getShortGUID('ps_');
            copiedSet.name = result.name;
            copiedSet.description = result.description || '';
            copiedSet.userId = result.userId || '';
            copiedSet.created = new Date();
            copiedSet.modified = new Date();
            copiedSet.isDefault = false;

            const response = await this.http.post('/api/parameters-table/sets', { set: copiedSet, storage: {storageType: this.tableOptions.storageType, odbcDeviceId: this.tableOptions.odbcDeviceId} }).toPromise();
            await this.loadParameterSetsForType(this.selectedParameterType.id);
            const copiedSetFromDB = this.parameterSets.find(set => set.id === copiedSet.id);
            if (copiedSetFromDB) {
                this.onParameterSetChange(copiedSetFromDB);
            } else {
                this.onParameterSetChange(copiedSet);
            }
        } catch (error) {
            console.error('Error copying parameter set:', error);
        }
    }

    private async renameParameterSetWithResult(result: any) {
        try {
            this.selectedParameterSet.name = result.name;
            this.selectedParameterSet.description = result.description || '';
            this.selectedParameterSet.userId = result.userId || '';
            this.selectedParameterSet.modified = new Date();
            await this.http.put(`/api/parameters-table/sets/${this.selectedParameterSet.id}`, { set: this.selectedParameterSet, storage: {storageType: this.tableOptions.storageType, odbcDeviceId: this.tableOptions.odbcDeviceId} }).toPromise();
            await this.loadParameterSetsForType(this.selectedParameterType.id);
        } catch (error) {
            console.error('Error renaming parameter set:', error);
        }
    }

    private handleParameterDeleteConfirm() {
        const params = new URLSearchParams();
        params.append('id', this.selectedParameterSet.id);
        params.append('storageType', this.tableOptions.storageType || 'sqlite');
        params.append('odbcDeviceId', this.tableOptions.odbcDeviceId || '');
        this.http.delete(`/api/parameters-table/sets?${params.toString()}`).subscribe(
            async () => {
                await this.loadParameterSetsForType(this.selectedParameterType.id);
                if (this.parameterSets.length > 0) {
                    this.onParameterSetChange(this.parameterSets[0]);
                } else {
                    this.selectedParameterSet = null;
                    this.buildTableData();
                }
            },
            error => {
                console.error('Error deleting parameter set:', error);
            }
        );
    }
}
