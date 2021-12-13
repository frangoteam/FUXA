import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';

import { FormControl } from '@angular/forms';
import { MatTable, MatTableDataSource, MatPaginator, MatSort } from '@angular/material';

import { DiagnoseService } from '../_services/diagnose.service';
import { AppService } from '../_services/app.service';
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
    logs = { selected: 'fuxa.log', files: [] };

    constructor(private diagnoseService: DiagnoseService,
                private appService: AppService) { }

    ngOnInit() {
    }

    ngAfterViewInit() {
        this.diagnoseService.getLogsDir().subscribe(result => {
            this.logs.files = result;
        }, err => {
            console.error('get Logs err: ' + err);
        });

        this.loadLogs(this.logs.selected);
    }

    private loadLogs(logfile: string) {
        this.appService.showLoading(true);
        this.diagnoseService.getLogs(<LogsRequest>{ file: logfile }).subscribe(result => {
            this.content = result.body.replace(new RegExp('\n', 'g'), "<br />");
            this.appService.showLoading(false);
        }, err => {
            this.appService.showLoading(false);
            console.error('get Logs err: ' + err);
        });
    }
}
