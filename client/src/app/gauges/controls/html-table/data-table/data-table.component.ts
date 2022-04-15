import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTable, MatTableDataSource, MatPaginator, MatSort, MatMenuTrigger } from '@angular/material';

@Component({
    selector: 'app-data-table',
    templateUrl: './data-table.component.html',
    styleUrls: ['./data-table.component.css']
})
export class DataTableComponent implements OnInit {

    @ViewChild(MatTable) table: MatTable<any>;
    @ViewChild(MatSort) sort: MatSort;
    @ViewChild(MatMenuTrigger) trigger: MatMenuTrigger;
    @ViewChild(MatPaginator) paginator: MatPaginator;

    displayedColumns = ['name', 'address'];;
    dataSource = new MatTableDataSource([]);

    tableStyle = { headerHeight: 30, rowHeight: 30 };
    constructor() { }

    ngOnInit() {
        this.dataSource.data = [{ name: 'pippo', adr: '233'}, { name: 'ciccio', adr: 2344 }, { name: 'pippo', adr: 233 }, { name: 'pippo', adr: 33}];
    }

    ngAfterViewInit() {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }
}
