import { Component, OnInit, AfterViewInit, ViewChild, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { MatLegacyRow as MatRow, MatLegacyTable as MatTable, MatLegacyTableDataSource as MatTableDataSource } from '@angular/material/legacy-table';
import { MatLegacyPaginator as MatPaginator } from '@angular/material/legacy-paginator';
import { MatLegacyMenuTrigger as MatMenuTrigger } from '@angular/material/legacy-menu';
import { MatSort } from '@angular/material/sort';
import { Utils } from '../../../../_helpers/utils';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';

import { TranslateService } from '@ngx-translate/core';

import { DaterangeDialogComponent } from '../../../../gui-helpers/daterange-dialog/daterange-dialog.component';
import { IDateRange, DaqQuery, TableType, TableOptions, TableColumn, TableCellType, TableCell, TableRangeType, TableCellAlignType, GaugeEvent, GaugeEventType, GaugeEventActionType, TableFilter } from '../../../../_models/hmi';
import { Device, DeviceType } from '../../../../_models/device';
import { format } from 'fecha';
import { BehaviorSubject, Subject, Subscription, of, timer } from 'rxjs';
import { catchError, concatMap, switchMap, takeUntil } from 'rxjs/operators';
import { DataConverterService, DataTableColumn, DataTableContent } from '../../../../_services/data-converter.service';
import { ScriptService } from '../../../../_services/script.service';
import { ProjectService } from '../../../../_services/project.service';
import { SCRIPT_PARAMS_MAP, ScriptParam } from '../../../../_models/script';
import { HmiService } from '../../../../_services/hmi.service';
import { AlarmBaseType, AlarmColumnsType, AlarmPriorityType, AlarmsFilter, AlarmStatusType } from '../../../../_models/alarm';
import { ReportsService } from '../../../../_services/reports.service';
import { ReportColumnsType, ReportFile, ReportsFilter } from '../../../../_models/report';
import * as FileSaver from 'file-saver';
import { CommandService } from '../../../../_services/command.service';
import { LanguageService } from '../../../../_services/language.service';
import { GaugeBaseComponent } from '../../../gauge-base/gauge-base.component';

declare const numeral: any;

interface OdbcDataSource {
    query: string;
    result: any[];
    columnNames: string[];
    cells: TableCellData[];
}

interface TableRow {
    [columnId: string]: SimpleCellData;
}

interface SimpleCellData {
    stringValue: string;
    rowIndex?: number;
}

interface DataSourceState {
    odbc: {
        loaded: boolean;
        data: OdbcDataSource[];
        lastHash: string;
    };
    daq: {
        loaded: boolean;
        data: { dt: number; value: string }[][];
        accumulated: { dt: number; value: string }[][];
        expectedChunks: number;
        lastHash: string;
    };
}

@Component({
    selector: 'app-data-table',
    templateUrl: './data-table.component.html',
    styleUrls: ['./data-table.component.scss'],
})
export class DataTableComponent implements OnInit, AfterViewInit, OnDestroy {

    @ViewChild(MatTable, { static: false }) table: MatTable<any>;
    @ViewChild(MatSort, { static: false }) sort: MatSort;
    @ViewChild(MatMenuTrigger, { static: false }) trigger: MatMenuTrigger;
    @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;
    onTimeRange$ = new BehaviorSubject<DaqQuery>(null);

    settings: any;
    property: any;

    private pollingSubscription: Subscription;
    statusText = AlarmStatusType;
    priorityText = AlarmPriorityType;
    alarmColumnType = AlarmColumnsType;
    reportColumnType = ReportColumnsType;
    loading = false;
    id: string;
    type: TableType;
    isEditor: boolean;
    displayedColumns = [];
    columnsStyle = {};
    dataSource = new MatTableDataSource([]);
    tagsMap = {};
    timestampMap = {};
    odbcMap = {};
    private isAutoRefreshRunning = false;
    executedQueries = new Set<string>();
    private pendingOdbcQueries = new Map<string, { deviceId: string, cells: TableCellData[] }>();
    private odbcQueryTimeout: any;
    tagsColumnMap = {};
    range = { from: Date.now(), to: Date.now() };
    private pendingOdbcRequestIds = new Set<string>(); 
    tableType = TableType;
    tableHistoryType = TableType.history;
    lastRangeType = TableRangeType;
    tableOptions = DataTableComponent.DefaultOptions();
    data = [];
    reloadActive = false;
    withToolbar = false;
    private lastDaqQuery = new DaqQuery();
    private destroy$ = new Subject<void>();
    private historyDateformat = '';
    addValueInterval = 0;
    private pauseMemoryValue: TableMapValueDictionary = {};
    setOfSourceTableData = false;
    selectedRow = null;
    events: GaugeEvent[];
    eventSelectionType = Utils.getEnumKey(GaugeEventType, GaugeEventType.select);
    dataFilter: TableFilter | AlarmsFilter | ReportsFilter;
    isRangeDropdownOpen = false;
    isPageSizeDropdownOpen = false;
    selectedPageSize = 25;
    pageSizeOptions = [10, 25, 100];

    private dataSourceState: DataSourceState = {
        odbc: {
            loaded: false,
            data: [],
            lastHash: ''
        },
        daq: {
            loaded: false,
            data: [],
            accumulated: [],
            expectedChunks: 0,
            lastHash: ''
        }
    };

    private tableData: TableRow[] = [];
    private currentTableDataHash = '';

    constructor(
        private dataService: DataConverterService,
        private projectService: ProjectService,
        private hmiService: HmiService,
        private scriptService: ScriptService,
        private reportsService: ReportsService,
        private languageService: LanguageService,
        private commandService: CommandService,
        public dialog: MatDialog,
        private translateService: TranslateService,
        private cdr: ChangeDetectorRef) { }

    ngOnInit() {
        if (this.type === TableType.data) {
            this.tableData = this.data;
            this.updateTableIfChanged();
        } else if (this.type === TableType.history) {
            this.dataSource.data = [];

            // Initialize default date range for DAQ queries (last 1 hour)
            const now = Date.now();
            this.lastDaqQuery.from = now - (1 * 60 * 60 * 1000); // 1 hour ago
            this.lastDaqQuery.to = now;
            this.lastDaqQuery.gid = this.id;
            this.lastDaqQuery.sids = this.getVariableIdsForQuery();
            this.range.from = this.lastDaqQuery.from;
            this.range.to = this.lastDaqQuery.to;
        }
        Object.keys(this.lastRangeType).forEach(key => {
            this.translateService.get(this.lastRangeType[key]).subscribe((txt: string) => { this.lastRangeType[key] = txt; });
        });
        this.dataSource.filterPredicate = (match: any, filter: string) => {
            const cells = Object.values(match).map((c: TableCellData) => c.stringValue);
            for (let i = 0; i < cells.length; i++) {
                if (cells[i].toLowerCase().includes(filter)) { return true; }
            }
            return false;
        };

        if (this.isAlarmsType()) {
            Object.keys(this.statusText).forEach(key => {
                this.statusText[key] = this.translateService.instant(this.statusText[key]);
            });
            Object.keys(this.priorityText).forEach(key => {
                this.priorityText[key] = this.translateService.instant(this.priorityText[key]);
            });
            if (this.type === TableType.alarms) {
                this.startPollingAlarms();
            }
        } else if (this.isReportsType()) {
            this.startPollingReports();
        }

        // Subscribe to ODBC query results
        this.hmiService.onDeviceOdbcQuery.subscribe(message => {
            if (message && message.result) {

                if (message.requestId && !this.pendingOdbcRequestIds.has(message.requestId)) {
                    return;
                }

                if (message.requestId) {
                    this.pendingOdbcRequestIds.delete(message.requestId);
                }

                let hasCells = !!this.odbcMap[message.query];
                if (!hasCells) {
                    const baseQuery = message.query.split(' WHERE ')[0];
                    hasCells = !!this.odbcMap[baseQuery];
                }
                if (hasCells) {
                    this.updateOdbcCells(message.query, message.result);
                }
            }
        });
    }

    /**
     * Normalize timestamp to seconds granularity (for matching rows within ~1 second)
     */
    private normalizeToSecond(timestampMs: number): number {
        return Math.floor(timestampMs / 1000);
    }

    /**
     * Extract timestamp from a table row (handles both ODBC and DAQ formats)
     * ODBC: Uses rowIndex field if present
     * DAQ: Looks for timestamp column in displayedColumns
     */
    private getRowTimestampForMerge(row: TableRow): number {
        if (!row) return 0;

        for (const colId of this.displayedColumns) {
            const cell = row[colId];
            if (cell && typeof cell.rowIndex === 'number' && cell.rowIndex > 0) {
                return cell.rowIndex; // Already normalized
            }
        }
        return 0;
    }

    /**
     * Create optimized hash of table data for change detection
     * Samples large datasets (>1000 rows) for performance
     */
    private createDataHash(data: TableRow[]): string {
        if (!data || data.length === 0) return 'empty';

        const hash: string[] = [];

        if (data.length === 1) {
            hash.push(this.hashRow(data[0]));
        } else if (data.length <= 100) {
            hash.push(...data.map(row => this.hashRow(row)));
        } else {
            hash.push(this.hashRow(data[0])); 

            const sampleRate = Math.ceil((data.length - 11) / 1000);
            for (let i = 1; i < data.length - 10; i += sampleRate) {
                hash.push(this.hashRow(data[i]));
            }

            for (let i = Math.max(1, data.length - 10); i < data.length; i++) {
                hash.push(this.hashRow(data[i]));
            }
        }

        return hash.join('||');
    }

    private hashRow(row: TableRow): string {
        return Object.keys(row).map(colId => {
            const cell = row[colId];
            return `${colId}:${cell?.stringValue}:${cell?.rowIndex || ''}`;
        }).join('|');
    }

    /**
     * Combines ODBC and DAQ data into final table dataset
     */
    private consolidateAllData(): TableRow[] {
        const hasOdbc = this.dataSourceState.odbc.loaded && this.dataSourceState.odbc.data.length > 0;
        const hasDaq = this.dataSourceState.daq.loaded && this.dataSourceState.daq.data.length > 0;

        // Case 1: Only ODBC data
        if (hasOdbc && !hasDaq) {
            const rows = this.createOdbcTableRows(this.dataSourceState.odbc.data);
            return rows;
        }

        // Case 2: Only DAQ data
        if (hasDaq && !hasOdbc) {
            const rows = this.createDaqTableRows(this.dataSourceState.daq.data);
            return rows;
        }

        // Case 3: Both ODBC and DAQ data - merge by timestamp
        if (hasOdbc && hasDaq) {
            const odbcRows = this.createOdbcTableRows(this.dataSourceState.odbc.data);
            const daqRows = this.createDaqTableRows(this.dataSourceState.daq.data);
            const merged = this.mergeOdbcAndDaqRows(odbcRows, daqRows);
            return merged;
        }

        // Case 4: No data
        return [];
    }

    private groupQueryByCellsByTable(queries: string[]): Map<string, TableCellData[]> {
        const tableQueries = new Map<string, TableCellData[]>();
        queries.forEach(query => {
            const tableName = this.extractTableNameFromQuery(query);
            if (!tableQueries.has(tableName)) {
                tableQueries.set(tableName, []);
            }
            const cells = this.odbcMap[query];
            if (cells) {
                tableQueries.get(tableName).push(...cells);
            }
        });
        return tableQueries;
    }

    private collectTimestampColumns(): string[] {
        const timestampColumns: string[] = [];
        if (this.tableOptions.columns) {
            this.tableOptions.columns.forEach(col => {
                if (col.type === TableCellType.timestamp) {
                    if (col.odbcTimestampColumns && col.odbcTimestampColumns.length > 0) {
                        col.odbcTimestampColumns.forEach(ts => {
                            if (ts.column) {
                                timestampColumns.push(ts.column);
                            }
                        });
                    }
                    else if (col.odbcTimestampColumn) {
                        timestampColumns.push(col.odbcTimestampColumn);
                    }
                }
            });
        }
        return timestampColumns;
    }

    private shouldApplyDateFilter(): boolean {
        const hasHistory = this.type === this.tableHistoryType && this.tableOptions.daterange?.show;
        return hasHistory;
    }

    private prepareAndExecuteQuery(baseQuery: string, cells: TableCellData[], deviceId: string): void {
        let query = baseQuery;
        if (this.shouldApplyDateFilter()) {
            query = this.addDateFilterToOdbcQuery(baseQuery);
            if (!this.odbcMap[query]) {
                this.odbcMap[query] = cells;
            }
        } else {
            if (!this.odbcMap[query]) {
                this.odbcMap[query] = cells;
            }
        }

        const requestId = `${this.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.pendingOdbcRequestIds.add(requestId);
        this.hmiService.executeOdbcQuery(deviceId, query, requestId);
    }

    private extractTimestampValue(column: any, dbRow: any): any {
        let timestampValue = null;
        let shouldConvertUtc = false;

        if (column.odbcTimestampColumns && column.odbcTimestampColumns.length > 0) {
            for (const tsSource of column.odbcTimestampColumns) {
                if (dbRow[tsSource.column] !== undefined) {
                    timestampValue = dbRow[tsSource.column];
                    shouldConvertUtc = tsSource.convertUtcToLocal || false;
                    break;
                }
            }
        }
        else if (column.odbcTimestampColumn && dbRow[column.odbcTimestampColumn] !== undefined) {
            timestampValue = dbRow[column.odbcTimestampColumn];
            shouldConvertUtc = column.convertUtcToLocal || false;
        }

        if (timestampValue !== null && shouldConvertUtc) {
            if (typeof timestampValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(timestampValue)) {
                const isoUtcString = timestampValue.replace(' ', 'T') + 'Z';
                const utcDate = new Date(isoUtcString);

                if (!isNaN(utcDate.getTime())) {
                    const localDate = this.convertUtcToLocal(utcDate);
                    timestampValue = localDate.toISOString().replace('Z', '');
                }
            } else {
                timestampValue = this.convertUtcToLocalTimestamp(timestampValue);
            }
        }

        return timestampValue;
    }

    /**
     * Create table rows from ODBC data source
     */
    private createOdbcTableRows(odbcData: OdbcDataSource[]): TableRow[] {
        const rows: TableRow[] = [];

        odbcData.forEach(source => {
            source.result.forEach((dbRow: any) => {
                const tableRow: TableRow = {};

                this.displayedColumns.forEach(colId => {
                    const column = this.columnsStyle[colId];
                    const cellData: SimpleCellData = { stringValue: '' };

                    if (column.type === TableCellType.odbc) {
                        const dbColumnName = this.extractColumnNameFromOdbcQuery(column.variableId);
                        if (dbColumnName && dbRow[dbColumnName] !== undefined) {
                            cellData.stringValue = this.formatOdbcValue(dbRow[dbColumnName]);
                        }
                    } else if (column.type === TableCellType.timestamp) {
                        const timestampValue = this.extractTimestampValue(column, dbRow);

                        if (timestampValue !== null) {
                            cellData.stringValue = this.formatTimestampValue(timestampValue, column.valueFormat, false);
                            cellData.rowIndex = this.parseTimestampMs(timestampValue);
                        }
                    }

                    tableRow[colId] = cellData;
                });

                rows.push(tableRow);
            });
        });

        rows.sort((a, b) => this.getRowTimestampForMerge(b) - this.getRowTimestampForMerge(a));
        return rows;
    }

    /**
     * Create table rows from DAQ data source
     */
    private createDaqTableRows(daqData: { dt: number; value: string }[][]): TableRow[] {
        const rounder = { H: 3600000, m: 60000, s: 1000 };
        const roundIndex = rounder[this.historyDateformat?.[this.historyDateformat?.length - 1]] ?? 1000;

        const timestampsSet = new Set<number>();
        const mergedMap = new Map<number, Record<string, string>>();

        const variableColumns = this.displayedColumns
            .map(colId => this.columnsStyle[colId])
            .filter(col => col.type === TableCellType.variable);

        daqData.forEach((variableValues, varIndex) => {
            const column = variableColumns[varIndex];
            if (!column) return;

            variableValues.forEach(entry => {
                const roundedTime = Math.round(entry.dt / roundIndex) * roundIndex;
                if (!mergedMap.has(roundedTime)) {
                    mergedMap.set(roundedTime, {});
                }
                mergedMap.get(roundedTime)![column.id] = entry.value;
                timestampsSet.add(roundedTime);
            });
        });

        const sortedTimestamps = Array.from(timestampsSet).sort((a, b) => b - a);
        const filledRows: TableRow[] = [];

        sortedTimestamps.forEach(t => {
            const row: TableRow = {};
            this.displayedColumns.forEach(colId => {
                const column = this.columnsStyle[colId];
                row[colId] = { stringValue: '' };

                if (column.type === TableCellType.timestamp) {
                    row[colId].stringValue = format(new Date(t), column.valueFormat || 'YYYY-MM-DD HH:mm:ss');
                    row[colId].rowIndex = t;
                } else if (column.type === TableCellType.device) {
                    row[colId].stringValue = column.exname;
                } else if (column.type === TableCellType.variable) {
                    const val = mergedMap.get(t)?.[colId] ?? null;
                    if (Utils.isNumeric(val)) {
                        const rawValue = GaugeBaseComponent.maskedShiftedValue(val, column.bitmask);
                        row[colId].stringValue = Utils.formatValue(rawValue?.toString(), column.valueFormat);
                    } else {
                        row[colId].stringValue = val ?? '';
                    }
                }
            });
            filledRows.push(row);
        });

        for (const col of variableColumns) {
            let lastValue: string = '';
            for (let i = filledRows.length - 1; i >= 0; i--) {
                if (!filledRows[i][col.id].stringValue) {
                    filledRows[i][col.id].stringValue = lastValue;
                } else {
                    lastValue = filledRows[i][col.id].stringValue;
                }
            }
        }

        return filledRows;
    }

    /**
     * Merge ODBC and DAQ rows by timestamp
     * Rows with timestamps within 1 second are considered the same timestamp
     * ODBC and DAQ columns are combined into merged rows
     */
    private mergeOdbcAndDaqRows(odbcRows: TableRow[], daqRows: TableRow[]): TableRow[] {
        const mergedMap = new Map<number, TableRow>();

        odbcRows.forEach(row => {
            const ts = this.normalizeToSecond(this.getRowTimestampForMerge(row));
            if (!mergedMap.has(ts)) {
                mergedMap.set(ts, row);
            }
        });

        daqRows.forEach(row => {
            const ts = this.normalizeToSecond(this.getRowTimestampForMerge(row));
            if (mergedMap.has(ts)) {
                const existing = mergedMap.get(ts);
                Object.keys(row).forEach(colId => {
                    if (!existing[colId] || !existing[colId].stringValue) {
                        existing[colId] = row[colId];
                    }
                });
            } else {
                mergedMap.set(ts, row);
            }
        });

        const merged = Array.from(mergedMap.values());
        merged.sort((a, b) => this.getRowTimestampForMerge(b) - this.getRowTimestampForMerge(a));
        return merged;
    }

    /**
     * Parse timestamp value to milliseconds
     */
    private parseTimestampMs(value: any): number {
        if (typeof value === 'number') {
            return value < 1e11 ? value * 1000 : value;
        } else if (typeof value === 'string') {
            const date = new Date(value);
            return isNaN(date.getTime()) ? 0 : date.getTime();
        }
        return 0;
    }

    /**
     * Convert UTC timestamp value to local time
     * Preserves the input format (number returns number, string returns string)
     * Used to convert database timestamps immediately upon retrieval
     */
    private convertUtcToLocalTimestamp(value: any): any {
        const localDate = this.convertUtcToLocal(value);
        if (!localDate) return value; 

        if (typeof value === 'number') {
            return value < 1e11 ? Math.floor(localDate.getTime() / 1000) : localDate.getTime();
        } else if (typeof value === 'string') {
            return localDate.toISOString();
        }
        return value;
    }

    /**
     * Convert UTC timestamp to local time
     * Handles both UTC ISO strings and Date objects
     */
    private convertUtcToLocal(value: any): Date {
        let utcDate: Date;

        if (typeof value === 'number') {
            utcDate = new Date(value < 1e11 ? value * 1000 : value);
        } else if (typeof value === 'string') {
            utcDate = new Date(value);
        } else {
            utcDate = new Date(value);
        }

        if (isNaN(utcDate.getTime())) {
            return null;
        }

        const localDate = new Date(utcDate.getTime() - utcDate.getTimezoneOffset() * 60000);
        return localDate;
    }

    /**
     * Update table data with all consolidated data
     * Only updates if hash has changed (prevents flickering)
     */
    private updateTableData(): void {
        this.tableData = this.consolidateAllData();
        this.updateTableIfChanged();
        setTimeout(() => this.setLoading(false), 500);
    }

    /**
     * Update table only if data changed (prevents flickering)
     */
    private updateTableIfChanged(): boolean {
        const newHash = this.createDataHash(this.tableData);
        if (newHash === this.currentTableDataHash) {
            return false; // No change
        }

        this.currentTableDataHash = newHash;        

        this.dataSource.data = this.tableData;
        this.bindTableControls();
        return true;
    }

    /**
     * Check if ODBC data has changed
     */
    private hasOdbcDataChanged(newData: OdbcDataSource[]): boolean {
        let newHash = '';
        if (newData && newData.length > 0) {
            newHash = newData.map(source =>
                source.result.map(row => JSON.stringify(row)).join('|')
            ).join('||');
        } else {
            newHash = 'empty';
        }

        if (newHash === this.dataSourceState.odbc.lastHash) {
            return false;
        }

        this.dataSourceState.odbc.lastHash = newHash;
        return true;
    }

    /**
     * Check if DAQ data has changed
     */
    private hasDaqDataChanged(newData: { dt: number; value: string }[][]): boolean {
        let newHash = '';
        if (newData && newData.length > 0) {
            newHash = newData.map(arr =>
                arr.map(item => `${item.dt}:${item.value}`).join('|')
            ).join('||');
        } else {
            newHash = 'empty';
        }

        if (newHash === this.dataSourceState.daq.lastHash) {
            return false;
        }

        this.dataSourceState.daq.lastHash = newHash;
        return true;
    }

    ngAfterViewInit() {
        this.sort.disabled = this.type === TableType.data;

        if (this.type === TableType.history && !this.sort.disabled) {
            const timestampColumn = this.displayedColumns.find(colId =>
                this.columnsStyle[colId]?.type === TableCellType.timestamp
            );
            if (timestampColumn) {
                this.sort.sort({ id: timestampColumn, start: 'desc', disableClear: true });
            }
        }

        this.bindTableControls();
        if (this.paginator) {
            this.selectedPageSize = this.paginator.pageSize;
        }
        if (this.events) {
            this.events.forEach(event => {
                if (event.type === 'select' && event.action === 'onSetTag') {
                    this.setTagValue(event, null);
                }
            });
        }
    }

    ngOnDestroy() {
        if (this.pollingSubscription) {
            this.pollingSubscription.unsubscribe();
            this.pollingSubscription = null;
        }

        try {
            this.destroy$.next(null);
            this.destroy$.complete();
        } catch (e) {
            console.error(e);
        }
    }

    toggleRangeDropdown() {
        this.isRangeDropdownOpen = !this.isRangeDropdownOpen;
        this.isPageSizeDropdownOpen = false;
    }

    togglePageSizeDropdown() {
        this.isPageSizeDropdownOpen = !this.isPageSizeDropdownOpen;
        this.isRangeDropdownOpen = false;
    }

    selectRange(key: string) {
        this.tableOptions.lastRange = TableRangeType[key];
        this.onRangeChanged(key);
        this.isRangeDropdownOpen = false;
    }

    canGoPrevious(): boolean {
        return this.paginator && this.paginator.pageIndex > 0;
    }

    canGoNext(): boolean {
        return this.paginator && this.paginator.pageIndex < this.paginator.getNumberOfPages() - 1;
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
        this.cdr.detectChanges();
        if (this.paginator) {
            this.paginator.pageSize = value;
            this.paginator.page.emit({
                pageIndex: this.paginator.pageIndex,
                pageSize: value,
                length: this.paginator.length
            });
        }
        this.isPageSizeDropdownOpen = false;
    }

    get selectedRangeLabel(): string {
        if (this.tableOptions.lastRange === TableRangeType.none) return 'None';
        if (this.tableOptions.lastRange === TableRangeType.last1h) return 'Last 1 hour';
        if (this.tableOptions.lastRange === TableRangeType.last1d) return 'Last 1 day';
        if (this.tableOptions.lastRange === TableRangeType.last3d) return 'Last 3 days';
        return 'Last 1 hour';
    }

    get selectedPageSizeLabel(): string {
        return this.selectedPageSize.toString();
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

    private startPollingAlarms() {
        this.pollingSubscription = timer(0, 2500).pipe(
            takeUntil(this.destroy$),
            switchMap(() => this.hmiService.getAlarmsValues(<AlarmsFilter>this.dataFilter))
        ).subscribe(result => {
            this.updateAlarmsTable(result);
        });
    }

    private startPollingReports() {
        this.pollingSubscription = timer(0, 60000 * 5).pipe(
            takeUntil(this.destroy$),
            switchMap(() => this.reportsService.getReportsQuery(<ReportsFilter>this.dataFilter))
        ).subscribe(result => {
            this.updateReportsTable(result);
        });
    }

    private startPollingOdbc() {
        if (this.pollingSubscription) {
            this.pollingSubscription.unsubscribe();
            this.pollingSubscription = null;
        }

        let refreshInterval = this.tableOptions.refreshInterval || 5;

        if (refreshInterval > 300) {
            console.warn('refreshInterval is very long:', refreshInterval, 'seconds, capping at 300 seconds');
            refreshInterval = 300;
        }

        const interval = refreshInterval * 1000;

        this.pollingSubscription = timer(0, interval).pipe(
            takeUntil(this.destroy$),
            switchMap(() => {
                try {
                    this.onAutoRefresh();
                    return of(null);
                } catch (error) {
                    console.error('Error in auto-refresh polling:', error);
                    return of(null);
                }
            })
        ).subscribe({
            error: (err) => {
                console.error('Fatal error in ODBC polling:', err);
                this.pollingSubscription = null;
            }
        });
    }

    private executeOdbcQueriesImmediately() {
        const odbcQueries = Object.keys(this.odbcMap).slice();
        if (odbcQueries.length > 0) {
            const odbcDevices = (<Device[]>Object.values(this.projectService.getDevices())).filter(d => d.type === DeviceType.ODBC);
            if (odbcDevices.length > 0) {
                const deviceId = odbcDevices[0].id;

                const tableQueries = this.groupQueryByCellsByTable(odbcQueries);

                tableQueries.forEach((cells, tableName) => {
                    const timestampColumns = this.collectTimestampColumns();
                    const combinedQuery = this.combineOdbcQueries(cells, timestampColumns);
                    if (combinedQuery) {
                        const snapshotCells = [...cells];
                        this.prepareAndExecuteQuery(combinedQuery, snapshotCells, deviceId);
                    }
                });
            }
        }
    }

    onRangeChanged(ev, showLoading: boolean = true) {
        if (this.isEditor) {
            return;
        }
        if (ev) {
            const now = Date.now();
            this.range.to = now;
            switch (ev) {
                case 'none':
                    this.range.from = now - (10 * 365 * 24 * 60 * 60 * 1000); // 10 years ago
                    break;
                case 'last1h':
                    this.range.from = now - (1 * 60 * 60 * 1000);
                    break;
                case 'last1d':
                    this.range.from = now - (24 * 60 * 60 * 1000);
                    break;
                case 'last3d':
                    this.range.from = now - (3 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    this.range.from = now - (1 * 60 * 60 * 1000);
                    break;
            }

            // Reset ODBC data for fresh query with new date range
            this.dataSourceState.odbc.data = [];
            this.dataSourceState.odbc.loaded = false;
            this.dataSourceState.odbc.lastHash = ''; 
            this.currentTableDataHash = ''; 

            this.lastDaqQuery.event = ev;
            this.lastDaqQuery.gid = this.id;
            this.lastDaqQuery.sids = this.getVariableIdsForQuery();
            this.lastDaqQuery.from = this.range.from;
            this.lastDaqQuery.to = this.range.to;
            this.onDaqQuery(undefined, showLoading);

            // Execute ODBC queries immediately with new date range
            this.executeOdbcQueriesImmediately();
        }
    }

    onDateRange() {
        let dialogRef = this.dialog.open(DaterangeDialogComponent, {
            panelClass: 'light-dialog-container'
        });
        dialogRef.afterClosed().subscribe((dateRange: IDateRange) => {
            if (dateRange) {
                this.range.from = dateRange.start;
                this.range.to = dateRange.end;

                // Reset ODBC data for fresh query with new date range
                this.dataSourceState.odbc.data = [];
                this.dataSourceState.odbc.loaded = false;
                this.dataSourceState.odbc.lastHash = ''; 
                this.currentTableDataHash = ''; 

                this.lastDaqQuery.gid = this.id;
                this.lastDaqQuery.sids = this.getVariableIdsForQuery();
                this.lastDaqQuery.from = dateRange.start;
                this.lastDaqQuery.to = dateRange.end;
                this.onDaqQuery(undefined, true);

                // Execute ODBC queries immediately with new date range
                this.executeOdbcQueriesImmediately();
            }
        });
    }

    onDaqQuery(daqQuery?: DaqQuery, showLoading: boolean = true) {
        if (daqQuery) {
            this.lastDaqQuery = <DaqQuery>Utils.mergeDeep(this.lastDaqQuery, daqQuery);
        }
        // Reset DAQ data for new query, preserve ODBC data
        this.dataSourceState.daq.loaded = false;
        this.dataSourceState.daq.data = [];
        this.dataSourceState.daq.accumulated = [];
        this.dataSourceState.daq.expectedChunks = 0;

        // Reconslidate table data (preserves ODBC data while resetting DAQ)
        this.updateTableData();

        this.onTimeRange$.next(this.lastDaqQuery);
        if (this.type === TableType.history && showLoading) {
            this.setLoading(true);
        }
    }

    onRefresh() {
        try {
            this.reloadActive = true;
            if (this.type === TableType.history) {
                const now = Date.now();
                const rangeDuration = this.lastDaqQuery.to - this.lastDaqQuery.from;
                this.lastDaqQuery.from = now - rangeDuration;
                this.lastDaqQuery.to = now;
                this.range.from = this.lastDaqQuery.from;
                this.range.to = this.lastDaqQuery.to;
                this.dataSourceState.odbc.lastHash = '';

                // Execute incremental DAQ and ODBC queries
                this.executeDaqQueryForAutoRefresh();
                this.executeOdbcQueriesForAutoRefresh();
            } else {
                // For data tables, do incremental ODBC refresh
                this.executeOdbcQueriesForAutoRefresh();
            }
        } catch (e) {
            console.error('Error in onRefresh():', e);
        }
    }

    private onAutoRefresh() {
        // For history tables, refresh with updated time range
        if (this.type === TableType.history) {
            const now = Date.now();
            const rangeDuration = this.lastDaqQuery.to - this.lastDaqQuery.from;
            this.lastDaqQuery.from = now - rangeDuration;
            this.lastDaqQuery.to = now;
            this.range.from = this.lastDaqQuery.from;
            this.range.to = this.lastDaqQuery.to;
            this.executeDaqQueryForAutoRefresh();
            this.executeOdbcQueriesForAutoRefresh();
        } else {
            this.executeOdbcQueriesForAutoRefresh();
        }
    }

    private executeDaqQueryForAutoRefresh() {
        // For auto-refresh, query for new data since the last timestamp in DAQ data
        if (this.dataSourceState.daq.data && this.dataSourceState.daq.data.length > 0) {
            // Find the most recent timestamp from the LAST VARIABLE's data
            let lastTimestamp = 0;
            for (const varData of this.dataSourceState.daq.data) {
                if (varData && varData.length > 0) {
                    const varTimestamp = Math.max(...varData.map(entry => entry.dt));
                    lastTimestamp = Math.max(lastTimestamp, varTimestamp);
                }
            }

            const autoRefreshQuery = {
                ...this.lastDaqQuery,
                from: lastTimestamp, 
                to: Date.now() 
            };

            this.onTimeRange$.next(autoRefreshQuery);
        } else {
            this.onTimeRange$.next(this.lastDaqQuery);
        }
    }

    private executeOdbcQueriesForAutoRefresh() {
        if (!this.tableOptions?.realtime) {
            return;
        }

        if (this.isAutoRefreshRunning) {
            return;
        }

        this.isAutoRefreshRunning = true;
        // Execute ODBC queries for auto refresh - combine queries per table
        // Create a snapshot to avoid mutation during iteration
        const odbcQueries = Object.keys(this.odbcMap).slice();
        if (odbcQueries.length > 0) {
            const odbcDevices = (<Device[]>Object.values(this.projectService.getDevices())).filter(d => d.type === DeviceType.ODBC);
            if (odbcDevices.length > 0) {
                const deviceId = odbcDevices[0].id;

                const tableQueries = this.groupQueryByCellsByTable(odbcQueries);

                // Execute combined queries per table
                tableQueries.forEach((cells, tableName) => {
                    const timestampColumns = this.collectTimestampColumns();
                    const combinedQuery = this.combineOdbcQueries(cells, timestampColumns);
                    if (combinedQuery) {
                        // Snapshot cells to prevent modification during iteration
                        const snapshotCells = [...cells];
                        this.prepareAndExecuteQuery(combinedQuery, snapshotCells, deviceId);
                    }
                });
            }
        }

        this.isAutoRefreshRunning = false;
        Object.keys(this.odbcMap).forEach(query => {
            if (query.toUpperCase().includes(' WHERE ')) {
                delete this.odbcMap[query];
            }
        });
    }

    setOptions(options: TableOptions): void {
        this.tableOptions = { ...this.tableOptions, ...options };
        this.loadData();
        const key = Object.keys(TableRangeType).find(k => TableRangeType[k] === this.tableOptions.lastRange) || 'last1h';
        this.onRangeChanged(key, true);

        // Start polling once after all data is loaded
        if (this.tableOptions.realtime) {
            if (this.type === TableType.history) {
                this.startPollingOdbc();
            } else if (this.isAlarmsType()) {
                this.startPollingAlarms();
            } else if (this.isReportsType()) {
                this.startPollingReports();
            }
        }
    }

    addValue(variableId: string, dt: number, variableValue: string) {
        if (this.type === TableType.data && this.tagsMap[variableId]) {
            this.tagsMap[variableId].value = variableValue;
            this.tagsMap[variableId].cells.forEach((cell: TableCellData) => {
                const rawValue = GaugeBaseComponent.maskedShiftedValue(variableValue, cell.bitmask);
                cell.stringValue = Utils.formatValue(rawValue?.toString(), cell.valueFormat);
            });
            // update timestamp of all timestamp cells
            this.tagsMap[variableId].rows.forEach((rowIndex: number) => {
                if (this.timestampMap[rowIndex]) {
                    this.timestampMap[rowIndex].forEach((cell: TableCellData) => {
                        cell.stringValue = format(new Date(dt * 1e3), cell.valueFormat || 'YYYY-MM-DD HH:mm:ss');
                    });
                }
            });
        } else if (this.type === TableType.history) {

            return;
        }
    }

    setValues(values: { dt: number; value: string }[][], chunk?: { index: number; of: number }) {
        // Handle chunked data accumulation using unified structure
        if (chunk) {
            if (chunk.index === 0) {
                // First chunk - initialize accumulation
                this.dataSourceState.daq.accumulated = values.map(arr => arr.slice());
                this.dataSourceState.daq.expectedChunks = chunk.of;
            } else {
                // Accumulate data from this chunk
                values.forEach((variableData, varIndex) => {
                    if (!this.dataSourceState.daq.accumulated[varIndex]) {
                        this.dataSourceState.daq.accumulated[varIndex] = [];
                    }
                    this.dataSourceState.daq.accumulated[varIndex].push(...variableData);
                });
            }

            // If this is not the last chunk, wait for more data
            if (chunk.index + 1 < chunk.of) {
                return;
            }

            // Last chunk - use accumulated data
            values = this.dataSourceState.daq.accumulated;
            this.dataSourceState.daq.accumulated = [];
        }

        // Check if new DAQ data is different from previous
        if (!this.hasDaqDataChanged(values)) {
            return;
        }

        // IMPORTANT: For incremental refresh (auto-refresh), APPEND new data instead of replacing
        const isIncrementalRefresh = this.dataSourceState.daq.data && this.dataSourceState.daq.data.length > 0;

        if (isIncrementalRefresh) {
            // Append new data to existing DAQ data (incremental refresh)
            values.forEach((newVariableValues, varIndex) => {
                if (!this.dataSourceState.daq.data[varIndex]) {
                    this.dataSourceState.daq.data[varIndex] = [];
                }
                this.dataSourceState.daq.data[varIndex].push(...newVariableValues);
            });
        } else {
            // Replace all data (full range query or initial load)
            this.dataSourceState.daq.data = values;
        }

        this.dataSourceState.daq.loaded = true;

        this.updateTableData();
    }

    updateAlarmsTable(alrs: AlarmBaseType[]) {
        let rows = [];
        alrs.forEach(alr => {
            let alarm = {
                type: { stringValue: this.priorityText[alr.type] },
                name: { stringValue: alr.name },
                status: { stringValue: this.statusText[alr.status] },
                text: { stringValue: this.languageService.getTranslation(alr.text) ?? alr.text },
                group: { stringValue: this.languageService.getTranslation(alr.group) ?? alr.group },
                ontime: { stringValue: format(new Date(alr.ontime), 'YYYY.MM.DD HH:mm:ss') },
                color: alr.color,
                bkcolor: alr.bkcolor,
                toack: alr.toack
            };
            if (alr.offtime) {
                alarm['offtime'] = { stringValue: format(new Date(alr.offtime), 'YYYY.MM.DD HH:mm:ss') };
            }
            if (alr.acktime) {
                alarm['acktime'] = { stringValue: format(new Date(alr.acktime), 'YYYY.MM.DD HH:mm:ss') };
            }
            if (alr.userack) {
                alarm['userack'] = { stringValue: format(new Date(alr.userack), 'YYYY.MM.DD HH:mm:ss') };
            }
            rows.push(alarm);
        });
        this.dataSource.data = rows;
    }

    updateReportsTable(reports: ReportFile[]) {
        let rows = [];
        reports.forEach(item => {
            let report = {
                name: { stringValue: item.fileName },
                ontime: { stringValue: format(new Date(item.created), 'YYYY.MM.DD HH:mm:ss') },
                deletable: item.deletable,
                fileName: item.fileName
            };
            rows.push(report);
        });
        this.dataSource.data = rows;
    }

    isSelectable(row: any): boolean {
    const selectable = this.events && this.events.length > 0 && this.events.some(event => event.type === 'select' && event.action === 'onSetTag');
    return selectable;
  }

    selectRow(row: MatRow) {
        if (this.isSelectable(row)) {
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

    isSelected(row: MatRow) {
        return this.selectedRow === row;
    }

    private runScript(event: GaugeEvent, selected: MatRow) {
        if (event.actparam) {
            let torun = Utils.clone(this.projectService.getScripts().find(dataScript => dataScript.id == event.actparam));
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

    private setTagValue(event: GaugeEvent, selected: MatRow) {
        if (event.actparam) {
            const tagId = event.actparam;
            const tag = this.projectService.getTagFromId(tagId);
            if (tag) {
                let value: any;
                const type = tag.type.toLowerCase();
                if (type.includes('bool')) {
                    value = selected ? true : false;
                } else if (type.includes('number') || type.includes('int') || type.includes('word') || type.includes('real')) {
                    value = selected ? this.dataSource.data.indexOf(selected) + 1 : 0; // 1-based index
                } else if (type.includes('string') || type.includes('char')) {
                    if (selected) {
                        const rowData = {};
                        this.displayedColumns.forEach(col => {
                            const cell = selected[col];
                            if (cell && cell.stringValue !== undefined) {
                                const columnName = this.columnsStyle[col] && this.columnsStyle[col].label && this.columnsStyle[col].label !== 'undefined' ? this.columnsStyle[col].label : col;
                                let value: any = cell.stringValue;
                                if (!isNaN(Number(value)) && value.trim() !== '' && !isNaN(parseFloat(value))) {
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
        }
    }

    addRowDataToTable(dt: number, tagId: string, value: string) {
        let row = {};
        let timestapColumnId = null;
        let valueColumnId = null;
        let exnameColumnId = null;
        for (let x = 0; x < this.displayedColumns.length; x++) {
            let column = <TableColumn>this.columnsStyle[this.displayedColumns[x]];
            row[column.id] = <TableCellData>{ stringValue: '' };
            if (column.type === TableCellType.timestamp) {
                timestapColumnId = column.id;
                row[column.id].stringValue = format(new Date(dt), column.valueFormat || 'YYYY-MM-DD HH:mm:ss');
                row[column.id].timestamp = dt;
            } else if (column.variableId === tagId) {
                if (Utils.isNumeric(value)) {
                    const rawValue = GaugeBaseComponent.maskedShiftedValue(value, column.bitmask);
                    row[column.id].stringValue = Utils.formatValue(rawValue?.toString(), column.valueFormat);
                } else {
                    row[column.id].stringValue = value;
                }
                valueColumnId = column.id;
            } else if (column.type === TableCellType.device) {
                row[column.id].stringValue = column.exname;
                exnameColumnId = column.id;
            }
        }
        if (valueColumnId) {
            const firstRow = this.dataSource.data[0];
            if (firstRow && firstRow[timestapColumnId].stringValue === row[timestapColumnId].stringValue) {
                firstRow[valueColumnId].stringValue = row[valueColumnId].stringValue;
                if (exnameColumnId) {
                    firstRow[exnameColumnId].stringValue = row[exnameColumnId].stringValue;
                }
            } else {
                this.dataSource.data.unshift(row);
                const rangeDiff = this.lastDaqQuery.to - this.lastDaqQuery.from;
                this.lastDaqQuery.to = row[timestapColumnId].timestamp;
                this.lastDaqQuery.from = this.lastDaqQuery.to - rangeDiff;
                let count = 0;
                for (let i = this.dataSource.data.length - 1; i >= 0; i--) {
                    if (this.dataSource.data[i][timestapColumnId].timestamp < this.lastDaqQuery.from) {
                        count++;
                    } else {
                        break;
                    }
                }
                if (count) {
                    this.dataSource.data.splice(-count, count);
                }
                this.dataSource = new MatTableDataSource(this.dataSource.data);
            }
        }
    }

    public setProperty(property: any, value: any): boolean {
        if (Utils.isNullOrUndefined(this[property])) {
            return false;
        }
        this[property] = value;
        return true;
    }

    setTableAndData(tableData: TableData) {
        this.setOfSourceTableData = true;
        if (tableData.columns) {
            this.displayedColumns = tableData.columns.map(cln => cln.id);
            this.columnsStyle = tableData.columns;
            tableData.columns.forEach((clnData, index) => {
                let column = clnData as any;
                column.label = column.label || 'Column ' + (index + 1);
                column.fontSize = tableData.header?.fontSize;
                column.color = column.color || tableData.header?.color;
                column.background = column.background || tableData.header?.background;
                column.width = column.width || 100;
                column.align = column.align || TableCellAlignType.left;
                this.columnsStyle[column.id] = column;
            });
        }
        if (tableData.rows) {
            this.dataSource = new MatTableDataSource(tableData.rows);
        }
        this.bindTableControls();
    }

    applyFilter(filterValue: string) {
        filterValue = filterValue.trim(); 
        filterValue = filterValue.toLowerCase(); 
        this.dataSource.filter = filterValue;
    }

    setLoading(load: boolean) {
        if (load) {
            timer(10000).pipe(
                takeUntil(this.destroy$)
            ).subscribe((res) => {
                this.loading = false;
            });
        }
        this.loading = load;
    }

    onExportData() {
        let data = <DataTableContent>{ name: 'data', columns: [] };
        let columns = {};
        Object.values(this.columnsStyle).forEach((column: TableColumn) => {
            columns[column.id] = <DataTableColumn>{ header: `${column.label}`, values: [] };
        });
        this.dataSource.data.forEach(row => {
            Object.keys(row).forEach(id => {
                columns[id].values.push(<TableCellData>row[id].stringValue);
            });
        });
        data.columns = Object.values(columns);
        this.dataService.exportTagsData(data);
    }

    private bindTableControls(): void {
        if (this.type === TableType.history && this.tableOptions.paginator.show) {
            this.dataSource.paginator = this.paginator;
        }
        this.dataSource.sort = this.sort;
        this.dataSource.sortingDataAccessor = (data, sortHeaderId) => data[sortHeaderId].stringValue;
    }

    private loadData() {
        let columnIds = [];
        this.columnsStyle = {};
        const columns = this.isAlarmsType() ? this.tableOptions.alarmsColumns : this.isReportsType() ? this.tableOptions.reportsColumns : this.tableOptions.columns;
        columns.forEach(cn => {
            columnIds.push(cn.id);
            this.columnsStyle[cn.id] = cn;
            if (this.type === TableType.history) {
                if (cn.type === TableCellType.variable && cn.variableId) {
                    this.addColumnToMap(cn);
                }
                if (cn.type === TableCellType.odbc && cn.variableId) {
                    const cellData = <TableCellData>{ stringValue: '', ...cn };
                    if (!this.isEditor) {
                        this.executeOdbcQuery(cellData);
                        this.addOdbcToMap(cellData);
                    }
                }
                if (cn.type === TableCellType.timestamp) {
                    this.historyDateformat = cn.valueFormat;
                }
            }
        });
        this.displayedColumns = columnIds;

        if (this.type === TableType.history && this.tableOptions.rows) {
            this.tableOptions.rows.forEach((row, rowIndex) => {
                if (row.cells) {
                    row.cells.forEach(cell => {
                        if (cell && cell.type === TableCellType.odbc && cell.variableId) {
                            if (this.isEditor) {
                            } else {
                                const cellData = <TableCellData>{ stringValue: '', rowIndex: rowIndex, ...cell };
                                this.executeOdbcQuery(cellData);
                                this.addOdbcToMap(cellData);
                            }
                        }
                    });
                }
            });
        }

        if (this.type === TableType.data) {
            this.data = [];
            for (let i = 0; i < this.tableOptions.rows.length; i++) {
                let r = this.tableOptions.rows[i];
                let row = {};
                r.cells.forEach(cell => {
                    if (cell) {
                        row[cell.id] = <TableCellData>{ stringValue: '', rowIndex: i, ...cell };
                        this.mapCellContent(row[cell.id]);
                    }
                });
                this.data.push(row);
            }
        }

        if (this.type === TableType.data) {
            this.tableData = this.data;
            this.updateTableIfChanged();
        } else {
            this.dataSource.data = [];
        }

        this.withToolbar = this.type === this.tableHistoryType && (this.tableOptions.paginator.show || this.tableOptions.filter.show || this.tableOptions.daterange.show);
    }

    private mapCellContent(cell: TableCellData): void {
        cell.stringValue = '';
        if (cell.type === TableCellType.variable) {
            if (cell.variableId) {
                if (this.isEditor) {
                    cell.stringValue = numeral('123.56').format(cell.valueFormat);
                }
                this.addVariableToMap(cell);
            }
        } else if (cell.type === TableCellType.timestamp) {
            if (this.isEditor) {
                cell.stringValue = format(new Date(0), cell.valueFormat || 'YYYY-MM-DD HH:mm:ss');
            }
            this.addTimestampToMap(cell);
        } else if (cell.type === TableCellType.label) {
            cell.stringValue = cell.label;
        } else if (cell.type === TableCellType.device) {
            cell.stringValue = cell.label;
        } else if (cell.type === TableCellType.odbc) {
            if (cell.variableId) {
                if (this.isEditor) {
                    cell.stringValue = 'ODBC Query Result';
                } else {
                    this.executeOdbcQuery(cell);
                }
                this.addOdbcToMap(cell);
            }
        }
    }

    private addVariableToMap(cell: TableCellData) {
        if (!this.tagsMap[cell.variableId]) {
            this.tagsMap[cell.variableId] = <ITagMap>{ value: NaN, cells: [], rows: [] };
        }
        this.tagsMap[cell.variableId].cells.push(cell);
        this.tagsMap[cell.variableId].rows.push(cell.rowIndex);
    }

    private addTimestampToMap(cell: TableCellData) {
        if (!this.timestampMap[cell.rowIndex]) {
            this.timestampMap[cell.rowIndex] = [];
        }
        this.timestampMap[cell.rowIndex].push(cell);
    }

    private addOdbcToMap(cell: TableCellData) {
        if (!this.odbcMap[cell.variableId]) {
            this.odbcMap[cell.variableId] = [];
        }
        this.odbcMap[cell.variableId].push(cell);
    }

    private updateOdbcCells(query: string, result: any) {
        let cells = this.odbcMap[query];

        if (!cells) {
            const baseQuery = query.split(' WHERE ')[0];
            cells = this.odbcMap[baseQuery];
        }

        if (cells) {
            if (result && result.length > 0) {
                const columnNames = this.extractColumnNamesFromQuery(query);

                if (columnNames.length > 0) {
                    const odbcData: OdbcDataSource = {
                        query,
                        result,
                        columnNames,
                        cells
                    };

                    const hasChanged = this.hasOdbcDataChanged([odbcData]);

                    if (hasChanged) {
                        // APPEND ODBC data (accumulate from multiple queries)
                        // First, check if this query result already exists
                        const existingIndex = this.dataSourceState.odbc.data.findIndex(d => d.query === query);
                        if (existingIndex >= 0) {
                            this.dataSourceState.odbc.data[existingIndex] = odbcData;
                        } else {
                            this.dataSourceState.odbc.data.push(odbcData);
                        }
                        this.dataSourceState.odbc.loaded = true;

                        this.updateTableData();
                    }
                }
            } else {
                const existingIndex = this.dataSourceState.odbc.data.findIndex(d => d.query === query);
                if (existingIndex >= 0) {
                    this.dataSourceState.odbc.data.splice(existingIndex, 1);
                }

                this.dataSourceState.odbc.loaded = true;
                this.updateTableData();
            }
        }
    }

    private formatTimestampValue(value: any, formatString?: string, convertUtcToLocal: boolean = false): string {
        if (value == null) return '';

        try {
            let date: Date;

            if (typeof value === 'number') {
                if (value > 1e11) {
                    date = new Date(value);
                } else {
                    date = new Date(value * 1000);
                }
            } else if (typeof value === 'string') {
                date = new Date(value);
            } else {
                date = new Date(value);
            }

            if (isNaN(date.getTime())) {
                return value.toString();
            }

            if (convertUtcToLocal) {
                const localDate = this.convertUtcToLocal(value);
                if (localDate) {
                    date = localDate;
                }
            }

            return format(date, formatString || 'YYYY-MM-DD HH:mm:ss');
        } catch (error) {
            return value.toString();
        }
    }

    private formatOdbcValue(value: any): string {
        if (!value) return '';

        const stringValue = value.toString();

        if (this.isTimestampValue(stringValue)) {
            try {
                const date = this.parseTimestampValue(stringValue);
                if (date) {
                    return format(date, 'YYYY-MM-DD HH:mm:ss');
                }
            } catch (e) {
                console.warn('Failed to parse timestamp from ODBC result:', stringValue);
            }
        }

        return stringValue;
    }

    private isTimestampValue(value: string): boolean {
        // Check for ISO date strings
        if (value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) return true;

        // Check for common date formats
        if (value.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)) return true;

        // Check for Unix timestamp (10-13 digits)
        if (value.match(/^\d{10,13}$/) && !isNaN(Number(value))) return true;

        return false;
    }

    private parseTimestampValue(value: string): Date | null {
        if (!value || value.trim() === '') return null;

        // Try various timestamp formats that databases might return

        // 1. ISO string with timezone
        if (value.includes('T') || value.includes('Z') || value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) return date;
        }

        // 2. SQL datetime format: YYYY-MM-DD HH:MM:SS
        if (value.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)) {
            const date = new Date(value.replace(' ', 'T'));
            if (!isNaN(date.getTime())) return date;
        }

        // 3. SQL datetime with milliseconds: YYYY-MM-DD HH:MM:SS.sss
        if (value.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{1,3}/)) {
            const date = new Date(value.replace(' ', 'T'));
            if (!isNaN(date.getTime())) return date;
        }

        // 4. Unix timestamp (seconds or milliseconds)
        if (value.match(/^\d{10,13}$/) && !isNaN(Number(value))) {
            const timestamp = Number(value);
            // If it's milliseconds (13 digits), use as-is; if seconds (10 digits), multiply by 1000
            const date = new Date(timestamp < 1e12 ? timestamp * 1000 : timestamp);
            if (!isNaN(date.getTime())) return date;
        }

        // 5. Try parsing as a regular date string
        const date = new Date(value);
        if (!isNaN(date.getTime())) return date;

        return null;
    }

    private executeOdbcQuery(cell: TableCellData) {
        const baseQuery = cell.variableId;
        if (!this.executedQueries.has(baseQuery)) {
            this.executedQueries.add(baseQuery);

            let deviceId = cell['deviceId'];
            if (!deviceId) {
                const odbcDevices = (<Device[]>Object.values(this.projectService.getDevices())).filter(d => d.type === DeviceType.ODBC);
                if (odbcDevices.length > 0) {
                    deviceId = odbcDevices[0].id;
                }
            }

            if (deviceId) {
                // Add this query to pending queries
                if (!this.pendingOdbcQueries.has(deviceId)) {
                    this.pendingOdbcQueries.set(deviceId, { deviceId, cells: [] });
                }
                this.pendingOdbcQueries.get(deviceId).cells.push(cell);

                // Clear any existing timeout
                if (this.odbcQueryTimeout) {
                    clearTimeout(this.odbcQueryTimeout);
                }

                this.odbcQueryTimeout = setTimeout(() => {
                    this.executePendingOdbcQueries();
                }, 100);
            }
        }
    }

    private executePendingOdbcQueries() {
        this.pendingOdbcQueries.forEach(({ deviceId, cells }) => {
            const queries = cells.map(cell => cell.variableId);
            const tableQueries = this.groupQueryByCellsByTable(queries);

            tableQueries.forEach((tableCells, tableName) => {
                const timestampColumns = this.collectTimestampColumns();
                const combinedQuery = this.combineOdbcQueries(tableCells, timestampColumns);
                if (combinedQuery) {
                    tableCells.forEach(cell => {
                        if (!this.odbcMap[combinedQuery]) {
                            this.odbcMap[combinedQuery] = [];
                        }
                        this.odbcMap[combinedQuery].push(cell);
                    });

                    this.prepareAndExecuteQuery(combinedQuery, tableCells, deviceId);
                }
            });
        });

        this.pendingOdbcQueries.clear();
    }

    private extractTableNameFromQuery(query: string): string {
        const upperQuery = query.toUpperCase();
        const fromIndex = upperQuery.indexOf(' FROM ');
        if (fromIndex === -1) return 'unknown';

        const afterFrom = query.substring(fromIndex + 6).trim();
        const tableNameMatch = afterFrom.match(/^([`\w\[\]]+)/);
        return tableNameMatch ? tableNameMatch[1] : 'unknown';
    }

    private extractColumnNamesFromQuery(query: string): string[] {

        const selectMatch = query.match(/SELECT\s+(.+?)\s+FROM/i);
        if (!selectMatch) return [];

        const selectClause = selectMatch[1].trim();

        if (selectClause === '*') return [];

        const columns = selectClause.split(',').map(col => {
            col = col.trim();
            if (col.includes('.')) {
                col = col.split('.').pop();
            }
            if (col.toUpperCase().includes(' AS ')) {
                col = col.split(/\s+AS\s+/i)[0].trim();
            }
            return col;
        });

        return columns;
    }

    private extractColumnNameFromOdbcQuery(query: string): string | null {
        const columns = this.extractColumnNamesFromQuery(query);
        return columns.length === 1 ? columns[0] : null;
    }

    private combineOdbcQueries(cells: TableCellData[], timestampColumns: string[] = []): string | null {
        if (cells.length === 0) return null;

        // Extract table name from first query
        const firstQuery = cells[0].variableId;
        const upperQuery = firstQuery.toUpperCase();
        const fromIndex = upperQuery.indexOf(' FROM ');
        if (fromIndex === -1) return null;

        const tablePart = firstQuery.substring(fromIndex);

        // Extract column names from all queries
        const odbcColumns: string[] = [];
        cells.forEach(cell => {
            const columnMatch = cell.variableId.match(/SELECT\s+(.+?)\s+FROM/i);
            if (columnMatch) {
                const selectClause = columnMatch[1].trim();
                if (!selectClause.includes(',')) {
                    odbcColumns.push(selectClause);
                } else {
                    selectClause.split(',').forEach(col => odbcColumns.push(col.trim()));
                }
            }
        });

        const allColumns = [...odbcColumns, ...timestampColumns];

        if (allColumns.length === 0) return null;

        const uniqueColumns = [...new Set(allColumns)];

        return `SELECT ${uniqueColumns.join(', ')} ${tablePart}`;
    }

    private addDateFilterToOdbcQuery(baseQuery: string): string {
        const upperQuery = baseQuery.toUpperCase();
        const fromIndex = upperQuery.indexOf(' FROM ');
        if (fromIndex === -1) return baseQuery;

        const afterFrom = baseQuery.substring(fromIndex + 6).trim();
        const tableNameMatch = afterFrom.match(/^([`\w\[\]]+)/);
        if (!tableNameMatch) return baseQuery;

        const timestampColumns = ['timestamp', 'created_at', 'created_date', 'date_created', 'time', 'datetime', 'dt'];

        // Check if any timestamp columns have UTC to Local conversion enabled
        // If so, we need to convert the query times from LOCAL to UTC
        let shouldConvertToUtc = false;
        for (const column of this.displayedColumns) {
            const col = this.columnsStyle[column];
            if (col && col.type === TableCellType.timestamp) {
                // Check single source UTC flag
                if (col.convertUtcToLocal) {
                    shouldConvertToUtc = true;
                    break;
                }
                // Check multiple sources UTC flags
                if (col.odbcTimestampColumns && col.odbcTimestampColumns.some(ts => ts.convertUtcToLocal)) {
                    shouldConvertToUtc = true;
                    break;
                }
            }
        }

        let startDate = new Date(this.range.from);
        let endDate = new Date(this.range.to);

        if (shouldConvertToUtc) {
            const tzOffsetMs = new Date().getTimezoneOffset() * 60 * 1000;
            startDate = new Date(this.range.from + tzOffsetMs);
            endDate = new Date(this.range.to + tzOffsetMs);
        }

        // Format timestamps for SQL queries
        const formatSqlTimestamp = (date: Date): string => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        };

        const startTimestamp = formatSqlTimestamp(startDate);
        const endTimestamp = formatSqlTimestamp(endDate);

        for (const col of timestampColumns) {
            const columnRegex = new RegExp(`(?:^|,|\\s)${col}(?:$|,|\\s)`, 'i');
            if (columnRegex.test(baseQuery) || upperQuery.includes(`"${col}"`) || upperQuery.includes(`\`${col}\``) || upperQuery.includes(`[${col}]`)) {
                const whereClause = ` WHERE "${col}" >= '${startTimestamp}' AND "${col}" <= '${endTimestamp}'`;
                if (!upperQuery.includes(' WHERE ')) {
                    return baseQuery + whereClause;
                } else {
                    return baseQuery + ` AND "${col}" >= '${startTimestamp}' AND "${col}" <= '${endTimestamp}'`;
                }
            }
        }
        return baseQuery;
    }

    private addColumnToMap(cell: TableColumn) {
        if (!this.tagsColumnMap[cell.variableId]) {
            this.tagsColumnMap[cell.variableId] = [];
        }
        this.tagsColumnMap[cell.variableId].push(cell);
    }

    private getVariableIdsForQuery(): string[] {
        return this.tableOptions.columns
            .filter(col => col.type === TableCellType.variable && col.variableId)
            .map(col => col.variableId);
    }

    isAlarmsType(): boolean {
        return this.type === TableType.alarms || this.type === TableType.alarmsHistory;
    }

    isReportsType(): boolean {
        return this.type === TableType.reports;
    }

    onAckAlarm(alarm: any) {
        if (!this.isEditor) {
            this.hmiService.setAlarmAck(alarm.name?.stringValue).subscribe(result => {
            }, error => {
                console.error('Error setAlarmAck', error);
            });
        }
    }

    onDownloadReport(report: ReportFile) {
        this.commandService.getReportFile(report.fileName).subscribe(content => {
            let blob = new Blob([content], { type: 'application/pdf' });
            FileSaver.saveAs(blob, report.fileName);
        }, err => {
            console.error('Download Report File err:', err);
        });
    }

    onRemoveReportFile(report: ReportFile) {
        const userConfirmed = window.confirm(this.translateService.instant('msg.file-remove', { value: report.fileName }));
        if (userConfirmed) {
            this.reportsService.removeReportFile(report.fileName).pipe(
                concatMap(() => timer(2000)),
                catchError((err) => {
                    console.error(`Remove Report File ${report.fileName} err:`, err);
                    return of(null);
                })
            ).subscribe(() => {
                // this.loadDetails(report);
            });
        }
    }

    public static DefaultOptions() {
        let options = <TableOptions>{
            paginator: {
                show: false
            },
            filter: {
                show: false
            },
            daterange: {
                show: false
            },
            realtime: false,
            refreshInterval: 5,
            lastRange: TableRangeType.none,
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
            columns: [new TableColumn(Utils.getShortGUID('c_'), TableCellType.timestamp, 'Date/Time'), new TableColumn(Utils.getShortGUID('c_'), TableCellType.label, 'Tags')],
            alarmsColumns: [],
            alarmFilter: { filterA: [], filterB: [], filterC: [] },
            reportsColumns: [],
            reportFilter: { filterA: [] },
            rows: [],
        };
        return options;
    }

    remapVariableIds(options: TableOptions, targetSignalsId: Record<string, string>): void {
        if (!targetSignalsId) {
            return;
        }

        const updateVariableId = (cell: TableCell) => {
            if (cell.variableId && targetSignalsId[cell.variableId]) {
                cell.variableId = targetSignalsId[cell.variableId];
            }
        };

        const processCells = (cells?: TableCell[]) => {
            if (cells) {
                for (const cell of cells) {
                    updateVariableId(cell);
                }
            }
        };

        if (options.columns) {
            processCells(options.columns);
        }
        if (options.alarmsColumns) {
            processCells(options.alarmsColumns);
        }
        if (options.reportsColumns) {
            processCells(options.reportsColumns);
        }
        if (options.rows) {
            for (const row of options.rows) {
                processCells(row.cells);
            }
        }
    }
}

export class TableCellData extends TableCell {
    rowIndex?: number;
    stringValue: string;
}

interface SimpleCellData {
    rowIndex?: number;
    stringValue: string;
    timestamp?: number;
}

interface ITagMap {
    value: number;
    cells: TableCellData[];
    rows: number[];
}


export class TableRangeConverter {
    static TableRangeToHours(crt: TableRangeType) {
        let types = Object.keys(TableRangeType);
        if (crt === types[0]) {         
            return 0; 
        } else if (crt === types[1]) { 
            return 1;
        } else if (crt === types[2]) {  
            return 24;
        } else if (crt === types[3]) {  
            return 24 * 3;
        }
        return 0;
    }
}

interface TableMapValueDictionary {
    [key: string]: number;
}

/**
 * Interface definition for setTableAndData from script
 */
interface TableData {
    paginator?: TableDataPaginatorOptions;
    filter?: TableDataFilterOptions;
    gridColor?: string;
    header?: TableDataHeaderStyle;
    rowStyle?: TableDataRowStyle;
    columns?: TableDataColumnData[];
    rows?: TableDataRow[];
}

interface TableDataPaginatorOptions {
    show: boolean;
    pageSize: number;
}

interface TableDataFilterOptions {
    show: boolean;
}

interface TableDataHeaderStyle {
    show: boolean;
    height: number;
    fontSize: number;
    background: string;
    color: string;
}

interface TableDataRowStyle {
    height: number;
    fontSize: number;
    background: string;
    color: string;
}

interface TableDataColumnData {
    id: string;
    label: string;
    align?: string;
    width?: number;
    color?: string;
    fontSize: number;
    background: string;
}

interface TableDataRow {
    cells: TableDataCell[];
}

interface TableDataCell {
    value: string;
}
