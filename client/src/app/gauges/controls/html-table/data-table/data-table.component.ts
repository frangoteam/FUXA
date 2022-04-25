import { Component, OnInit, AfterViewInit, ViewChild, OnDestroy } from '@angular/core';
import { MatTable, MatTableDataSource, MatPaginator, MatSort, MatMenuTrigger } from '@angular/material';
import { Utils } from '../../../../_helpers/utils';

import { GaugeTableProperty, TableOptions, TableColumn, TableRow, TableCellType, TableCell } from '../../../../_models/hmi';

@Component({
    selector: 'app-data-table',
    templateUrl: './data-table.component.html',
    styleUrls: ['./data-table.component.css']
})
export class DataTableComponent implements OnInit, AfterViewInit, OnDestroy {

    @ViewChild(MatTable) table: MatTable<any>;
    @ViewChild(MatSort) sort: MatSort;
    @ViewChild(MatMenuTrigger) trigger: MatMenuTrigger;
    @ViewChild(MatPaginator) paginator: MatPaginator;

    id: string;
    isEditor: boolean;
    displayedColumns = [];
    columnsStyle = {};
    dataSource = new MatTableDataSource([]);

    tableOptions = DataTableComponent.DefaultOptions();

    constructor() { }

    ngOnInit() {
        this.dataSource.data = [];//{ name: 'pippo', adr: '233'}, { name: 'ciccio', adr: 2344 }, { name: 'pippo', adr: 233 }, { name: 'pippo', adr: 33}];
    }

    ngAfterViewInit() {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    ngOnDestroy() {
        try {
        } catch (e) {
            console.error(e);
        }
    }

    setOptions(options: TableOptions): void {
        this.tableOptions = { ...this.tableOptions, ...options };
        this.loadData();
    }

    getCellSetting(cell: TableCell) {
        if (cell) {
            if (cell.type === TableCellType.label) {
                return cell.label || '';
            } else if (cell.type === TableCellType.timestamp) {
                return cell.valueFormat ? cell.valueFormat : '';
            } else if (cell.type === TableCellType.variable) {
                return (cell.variableId || '') + ((cell.valueFormat) ? ` (${cell.valueFormat})` : '');
            } else if (cell.type === TableCellType.device) {
                return (cell.variableId || '');
            }
        }
        return '';
    }

    private loadData() {
        // columns
        let columnIds = [];
        this.columnsStyle = {};
        this.tableOptions.columns.forEach(cn => {
            columnIds.push(cn.id);
            this.columnsStyle[cn.id] = cn;
        })
        this.displayedColumns = columnIds;

        // rows
        let data = [];
        this.tableOptions.rows.forEach(r => {
            let row = {};
            r.cells.forEach(c => {
                if (c) {
                    row[c.id] = c;
                }
            });
            data.push(row);
        });
        this.dataSource.data = data;
    }

    public static DefaultOptions() {
        let options = <TableOptions> { 
            paginator: { 
                show: false 
            },
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
            columns: [new TableColumn(Utils.getShortGUID('c_'), TableCellType.timestamp, 'Date/Time'), new TableColumn(Utils.getShortGUID('c_'), TableCellType.variable, 'Tags')],
            rows: [],
        };
        return options;
    }
}
