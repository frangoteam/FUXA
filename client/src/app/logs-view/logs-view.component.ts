import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';

import { FormControl } from '@angular/forms';
import { MatTable, MatTableDataSource, MatPaginator, MatSort } from '@angular/material';

import { DiagnoseService } from '../_services/diagnose.service';
import { LogsRequest } from '../_models/diagnose';

@Component({
    selector: 'app-logs-view',
    templateUrl: './logs-view.component.html',
    styleUrls: ['./logs-view.component.css']
})
export class LogsViewComponent implements OnInit, AfterViewInit {

    @ViewChild(MatTable) table: MatTable<any>;
    @ViewChild(MatSort) sort: MatSort;
    @ViewChild(MatPaginator) paginator: MatPaginator;

    dataSource = new MatTableDataSource([]);
    ontimeFilter = new FormControl();
    typeFilter = new FormControl();
    sourceFilter = new FormControl();
    textFilter = new FormControl();

    filteredValues = {
        ontime: '', source: '', type: '', text: ''
    };

    readonly displayColumns = ['ontime', 'type', 'source', 'text'];
    tableView = false;
    content = '';

    constructor(private diagnoseService: DiagnoseService) { }

    ngOnInit() {
    }

    ngAfterViewInit() {
        this.loadLogs();
    }

    private loadLogs() {
		this.diagnoseService.getLogs(<LogsRequest>{ type: 'err', index: 0 }).subscribe(result => {
            this.content = result.replace(new RegExp('\n', 'g'), "<br />");
		}, err => {
			console.error('get Logs err: ' + err);
		});
	}
}
