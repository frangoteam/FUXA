import { Component, OnInit, AfterViewInit, ViewChild, OnDestroy } from '@angular/core';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatMenuTrigger } from '@angular/material/menu';
import { MatSort } from '@angular/material/sort';
import { Utils } from '../../../../_helpers/utils';
import { MatDialog } from '@angular/material/dialog';

import { TranslateService } from '@ngx-translate/core';

import { DaterangeDialogComponent } from '../../../../gui-helpers/daterange-dialog/daterange-dialog.component';
import { IDateRange, DaqQuery, TableType, TableOptions, TableColumn, TableCellType, TableCell, TableRangeType } from '../../../../_models/hmi';
import { format } from 'fecha';
import { BehaviorSubject, Subject, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DataConverterService, DataTableColumn, DataTableContent } from '../../../../_services/data-converter.service';

declare const numeral: any;
@Component({
    selector: 'app-data-table',
    templateUrl: './data-table.component.html',
    styleUrls: ['./data-table.component.scss'],
})
export class DataTableComponent implements OnInit, AfterViewInit, OnDestroy {

    @ViewChild(MatTable, {static: false}) table: MatTable<any>;
    @ViewChild(MatSort, {static: false}) sort: MatSort;
    @ViewChild(MatMenuTrigger, {static: false}) trigger: MatMenuTrigger;
    @ViewChild(MatPaginator, {static: false}) paginator: MatPaginator;
    onTimeRange$ = new BehaviorSubject<DaqQuery>(null);

    loading = false;
    id: string;
    type: TableType;
    isEditor: boolean;
    displayedColumns = [];
    columnsStyle = {};
    dataSource = new MatTableDataSource([]);
    tagsMap = {};
    timestampMap = {};
    tagsColumnMap = {};
    range = { from: Date.now(), to: Date.now() };
    tableHistoryType = TableType.history;
    lastRangeType = TableRangeType;
    tableOptions = DataTableComponent.DefaultOptions();
    data = [];
    reloadActive = false;
    withToolbar = false;
    private lastDaqQuery = new DaqQuery();
    private destroy$ = new Subject<void>();
    private historyDateformat = '';

    constructor(
        private dataService: DataConverterService,
        public dialog: MatDialog,
        private translateService: TranslateService) { }

    ngOnInit() {
        this.dataSource.data = this.data;
        Object.keys(this.lastRangeType).forEach(key => {
            this.translateService.get(this.lastRangeType[key]).subscribe((txt: string) => { this.lastRangeType[key] = txt; });
        });
        this.dataSource.filterPredicate = (match: any, filter: string) => {
            const cells = Object.values(match).map((c: TableCellData) => c.stringValue);
            for (let i = 0; i < cells.length; i++) {
                if (cells[i].toLowerCase().includes(filter))
                {return true;}
            }
            return false;
        };
    }

    ngAfterViewInit() {
        this.sort.disabled = this.type === TableType.data;
        this.bindTableControls();
    }

    ngOnDestroy() {
        try {
            this.destroy$.next();
            this.destroy$.unsubscribe();
        } catch (e) {
            console.error(e);
        }
    }

    onRangeChanged(ev) {
        if (this.isEditor) {
            return;
        }
        if (ev) {
            this.range.from = Date.now();
            this.range.to = Date.now();
            this.range.from = new Date(this.range.from).setTime(new Date(this.range.from).getTime() - (TableRangeConverter.TableRangeToHours(ev) * 60 * 60 * 1000));

            this.lastDaqQuery.event = ev;
            this.lastDaqQuery.gid = this.id;
            this.lastDaqQuery.sids = Object.keys(this.tagsColumnMap);
            this.lastDaqQuery.from = this.range.from;
            this.lastDaqQuery.to = this.range.to;
            this.onDaqQuery();
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
                this.lastDaqQuery.gid = this.id;
                this.lastDaqQuery.sids = Object.keys(this.tagsColumnMap);
                this.lastDaqQuery.from = dateRange.start;
                this.lastDaqQuery.to = dateRange.end;
                this.onDaqQuery();
            }
        });
    }

    onDaqQuery() {
        this.onTimeRange$.next(this.lastDaqQuery);
        if (this.type === TableType.history) {
            this.setLoading(true);
        }
    }

    onRefresh() {
        this.onRangeChanged(this.lastDaqQuery.event);
        this.reloadActive = true;
    }

    setOptions(options: TableOptions): void {
        this.tableOptions = { ...this.tableOptions, ...options };
        this.loadData();
        this.onRangeChanged(this.tableOptions.lastRange || TableRangeType.last1h);
    }

    addValue(variableId: string, dt: number, variableValue: string) {
        if (this.tagsMap[variableId]) {
            this.tagsMap[variableId].value = variableValue;
            this.tagsMap[variableId].cells.forEach((cell: TableCellData) => {
                cell.stringValue = Utils.formatValue(this.tagsMap[variableId].value, cell.valueFormat);
            });
            // update timestamp of all timestamp cells
            this.tagsMap[variableId].rows.forEach((rowIndex: number) => {
                if (this.timestampMap[rowIndex]) {
                    this.timestampMap[rowIndex].forEach((cell: TableCellData) => {
                        cell.stringValue = format(new Date(dt * 1e3), cell.valueFormat || 'YYYY-MM-DDTHH:mm:ss');
                    });
                }
            });
        }
    }

    setValues(values) {
        // merge the data to have rows with 0:timestamp, n:variable values
        const rounder = {H: 3600000, m: 60000, s: 1000};
        const roundIndex = rounder[this.historyDateformat?.[this.historyDateformat?.length - 1]] ?? 1;
        let data = [];
        data.push([]);    // timestamp, index 0
        let xmap = {};
        for (var i = 0; i < values.length; i++) {
            data.push([]);    // line
            for (var x = 0; x < values[i].length; x++) {
                let t = Math.round(values[i][x].dt / roundIndex) * roundIndex;
                if (data[0].indexOf(t) === -1) {
                    data[0].push(t);
                    xmap[t] = {};
                }
                xmap[t][i] = values[i][x].value;
            }
        }
        data[0].sort(function(a, b) { return b - a; });
        for (var i = 0; i < data[0].length; i++) {
            let t = data[0][i];
            for (var x = 1; x < data.length; x++) {
                if (xmap[t][x - 1] !== undefined) {
                    data[x].push(xmap[t][x - 1]);
                } else {
                    data[x].push(null);
                }
            }
        }
        for (var x = 1; x < data.length; x++) {
            let lastValue = null;
            for (var i = data[x].length - 1; i >= 0; i--) {
                if (data[x][i] === null) {
                    data[x][i] = lastValue;
                } else {
                    lastValue = data[x][i];
                }
            }
        }
        // create the table data
        let dataTable = [];
        for (let i = 0; i < data[0].length; i++) {
            // create the row
            let row = {};
            let colPos = 1;
            for (let x = 0; x < this.displayedColumns.length; x++) {
                let column = <TableColumn>this.columnsStyle[this.displayedColumns[x]];
                row[column.id] = <TableCellData> { stringValue: '' };
                if (column.type === TableCellType.timestamp) {
                    row[column.id].stringValue = format(new Date(data[0][i]), column.valueFormat || 'YYYY-MM-DDTHH:mm:ss');
                } else if (column.type === TableCellType.variable) {
                    const tempValue = data[x][i];
                    if (Utils.isNumeric(tempValue)) {
                        row[column.id].stringValue = (data[colPos][i]) ? Utils.formatValue(tempValue, column.valueFormat) : '';
                    } else {
                        row[column.id].stringValue = tempValue;
                    }
                    colPos++;
                } else if (column.type === TableCellType.device) {
                    row[column.id].stringValue = column.exname;
                }
            }
            dataTable.push(row);
        }
        this.dataSource.data = dataTable;
        this.bindTableControls();
        setTimeout(() => {
            this.setLoading(false);
        }, 500);
        this.reloadActive = false;
    }

    applyFilter(filterValue: string) {
        filterValue = filterValue.trim(); // Remove whitespace
        filterValue = filterValue.toLowerCase(); // MatTableDataSource defaults to lowercase matches
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
        // columns
        let columnIds = [];
        this.columnsStyle = {};
        this.tableOptions.columns.forEach(cn => {
            columnIds.push(cn.id);
            this.columnsStyle[cn.id] = cn;
            if (this.type === TableType.history) {
                if (cn.variableId) {
                    this.addColumnToMap(cn);
                }
                if (cn.type === TableCellType.timestamp) {
                    this.historyDateformat = cn.valueFormat;
                }
            }
        });
        this.displayedColumns = columnIds;

        if (this.type === TableType.data) {
            // rows
            this.data = [];
            for (let i = 0; i < this.tableOptions.rows.length; i++) {
                let r = this.tableOptions.rows[i];
                let row = {};
                r.cells.forEach(cell => {
                    if (cell) {
                        row[cell.id] = <TableCellData> {stringValue: '', rowIndex: i, ...cell};
                        this.mapCellContent(row[cell.id]);
                    }
                });
                this.data.push(row);
            }
        }
        this.dataSource.data = this.data;
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
                cell.stringValue = format(new Date(0), cell.valueFormat || 'YYYY-MM-DDTHH:mm:ss');;
            }
            this.addTimestampToMap(cell);
        } else if (cell.type === TableCellType.label) {
            cell.stringValue = cell.label;
        } else if (cell.type === TableCellType.device) {
            cell.stringValue = cell.label;
        }
    }

    private addVariableToMap(cell: TableCellData) {
        if (!this.tagsMap[cell.variableId]) {
            this.tagsMap[cell.variableId] = <ITagMap>{ value: NaN, cells: [], rows: []};
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

    private addColumnToMap(cell: TableColumn) {
        if (!this.tagsColumnMap[cell.variableId]) {
            this.tagsColumnMap[cell.variableId] = [];
        }
        this.tagsColumnMap[cell.variableId].push(cell);
    }

    public static DefaultOptions() {
        let options = <TableOptions> {
            paginator: {
                show: false
            },
            filter: {
                show: false
            },
            daterange: {
                show: false
            },
            lastRange: Utils.getEnumKey(TableRangeType, TableRangeType.last1h),
            gridColor: '#E0E0E0',
            header: {
                show: true,
                height: 30,
                fontSize: 12,
                background: '#F0F0F0',
                color: '#757575',
            },
            row: {
                height: 30,
                fontSize: 10,
                background: '#F9F9F9',
                color: '#000000',
            },
            columns: [new TableColumn(Utils.getShortGUID('c_'), TableCellType.timestamp, 'Date/Time'), new TableColumn(Utils.getShortGUID('c_'), TableCellType.label, 'Tags')],
            rows: [],
        };
        return options;
    }
}

export class TableCellData extends TableCell {
    rowIndex: number;
    stringValue: string;
}

interface ITagMap {
    value: number;
    cells: TableCellData[];
    rows: number[];
}


export class TableRangeConverter {
    static TableRangeToHours(crt: TableRangeType) {
        let types = Object.keys(TableRangeType);
        if (crt === types[0]) {         // TableRangeType.last1h) {
            return 1;
        } else if (crt === types[1]) {  // TableRangeType.last1d) {
            return 24;
        } else if (crt === types[2]) {  // TableRangeType.last3d) {
            return 24 * 3;
        }
        return 0;
    }
}

// interface IRowDateTime {
//     rowsIndex: number[];
//     lastDateTime: string;
// }
