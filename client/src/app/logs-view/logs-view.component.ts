import { Component, AfterViewInit, ViewChild } from '@angular/core';

import { UntypedFormControl } from '@angular/forms';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';

import { DiagnoseService } from '../_services/diagnose.service';
import { AppService } from '../_services/app.service';
import { LogsRequest } from '../_models/diagnose';

@Component({
    selector: 'app-logs-view',
    templateUrl: './logs-view.component.html',
    styleUrls: ['./logs-view.component.css']
})
export class LogsViewComponent implements AfterViewInit {

    @ViewChild(MatTable, {static: false}) table: MatTable<any>;
    @ViewChild(MatSort, {static: false}) sort: MatSort;
    @ViewChild(MatPaginator, {static: false}) paginator: MatPaginator;

    dataSource = new MatTableDataSource([]);
    ontimeFilter = new UntypedFormControl();
    typeFilter = new UntypedFormControl();
    sourceFilter = new UntypedFormControl();
    textFilter = new UntypedFormControl();

    filteredValues = {
        ontime: '', source: '', type: '', text: ''
    };

    readonly displayColumns = ['ontime', 'type', 'source', 'text'];
    tableView = false;
    content = '';
    logs = { selected: 'fuxa.log', files: [] };

    constructor(private diagnoseService: DiagnoseService,
                private appService: AppService) { }

    ngAfterViewInit() {
        this.diagnoseService.getLogsDir().subscribe(result => {
            this.logs.files = result;
        }, err => {
            console.error('get Logs err: ' + err);
        });

        this.loadLogs(this.logs.selected);
    }

    loadLogs(logfile: string) {
        this.appService.showLoading(true);
        this.diagnoseService.getLogs(<LogsRequest>{ file: logfile }).subscribe(result => {
            this.content = result.body.replace(new RegExp('\n', 'g'), '<br />');
            this.appService.showLoading(false);
        }, err => {
            this.appService.showLoading(false);
            console.error('get Logs err: ' + err);
        });
    }
}
