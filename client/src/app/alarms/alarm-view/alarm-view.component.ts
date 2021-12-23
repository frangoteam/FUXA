import { Component, OnInit, AfterViewInit, OnDestroy, Input, ViewChild, Output, EventEmitter } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatMenuTrigger } from '@angular/material';
import { MatTable, MatTableDataSource, MatPaginator, MatSort } from '@angular/material';
import { Subscription, Subject, timer, Observable, empty } from 'rxjs';
import { takeUntil, switchMap, catchError } from 'rxjs/operators';

import { HmiService } from '../../_services/hmi.service';
import { TranslateService } from '@ngx-translate/core';
import { AlarmQuery } from '../../_models/alarm';

@Component({
    selector: 'app-alarm-view',
    templateUrl: './alarm-view.component.html',
    styleUrls: ['./alarm-view.component.css']
})
export class AlarmViewComponent implements OnInit, AfterViewInit, OnDestroy {

    alarmsColumns = ['ontime', 'text', 'type', 'group', 'status', 'ack', 'history'];
    historyColumns = ['ontime', 'text', 'type', 'group', 'status', 'offtime', 'acktime', 'userack', 'history'];
    displayColumns = this.alarmsColumns;

    showheader = false;
    currentShowMode = 'collapse';
    alarmsPolling: any;
    statusText = AlarmStatus;
    priorityText = AlarmPriority;
    alarmShowType = AlarmShowType;
    showType = AlarmShowType.alarms;
    history = [];

    @Input() autostart = false;
    @Input() showInContainer = false;
    @Input() fullview = true;
    @Output() showMode:EventEmitter<string> = new EventEmitter();

    dataSource = new MatTableDataSource([]);
    @ViewChild(MatTable) table: MatTable<any>;
    @ViewChild(MatSort) sort: MatSort;
    @ViewChild(MatPaginator) paginator: MatPaginator;

    private rxjsPollingTimer = timer(0, 2000);
    private destroy = new Subject();

    constructor(private translateService: TranslateService,
        private hmiService: HmiService) { }

    ngOnInit() {
        Object.keys(this.statusText).forEach(key => {
            this.translateService.get(this.statusText[key]).subscribe((txt: string) => { this.statusText[key] = txt });
        });
        Object.keys(this.priorityText).forEach(key => {
            this.translateService.get(this.priorityText[key]).subscribe((txt: string) => { this.priorityText[key] = txt });
        });
    }

    ngAfterViewInit() {
        this.displayColumns = this.alarmsColumns;
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
        this.table.renderRows();
        if (this.autostart) {
            this.startAskAlarmsValues();
        }
    }

    ngOnDestroy() {
        this.stopAskAlarmsValues();
    }

    startAskAlarmsValues() {
        this.startPolling();
    }

    stopAskAlarmsValues() {
        this.stopPolling();
    }

    private stopPolling() {
        this.alarmsPolling = 0;
        this.destroy.next();
        this.destroy.complete();
    }

    private startPolling() {
        try {
            if (!this.alarmsPolling) {
                this.alarmsPolling = 1;
                this.destroy = new Subject();
                this.rxjsPollingTimer.pipe(takeUntil(this.destroy),
                    switchMap(() =>
                        this.hmiService.getAlarmsValues().pipe(
                            catchError((er) => this.handleError(er)))
                    )).subscribe(result => {
                        this.updateAlarmsList(result);
                    });
            }
        } catch (error) {
        }
    }

    private handleError(error: any) {
        return empty();
    }

    updateAlarmsList(alr: any[]) {
        if (this.showType === AlarmShowType.alarms) {
            alr.forEach(alr => {
                alr.status = this.getStatus(alr.status);
                alr.type = this.getPriority(alr.type);
            })
            this.dataSource.data = alr;
        }
    }

    getStatus(status: string) {
        return this.statusText[status];
    }

    getPriority(type: string) {
        return this.priorityText[type];
    }

    onAckAlarm(alarm: any) {
        this.hmiService.setAlarmAck(alarm.name).subscribe(result => {
        }, error => {
            console.error('Error setAlarmAck');
        });
    }

    onShowMode(mode: string) {
        this.currentShowMode = mode;
        this.showMode.emit(this.currentShowMode);
    }

    onClose() {
        this.currentShowMode = 'collapse';
        this.showMode.emit('close');
        this.stopAskAlarmsValues();
    }

    onShowAlarms() {
        this.showType = AlarmShowType.alarms;
        this.displayColumns = this.alarmsColumns;
    }

    onShowAlarmsHistory() {
        this.showType = AlarmShowType.history;
        this.displayColumns = this.historyColumns;
        let query: AlarmQuery = <AlarmQuery>{ from: 'a', to: 'b' };
        this.hmiService.getAlarmsHistory(query).subscribe(result => {
            if (result) {
                result.forEach(alr => {
                    alr.status = this.getStatus(alr.status);
                    alr.type = this.getPriority(alr.type);
                })
                this.dataSource.data = result;
            }
        }, err => {
            console.error('get Alarms history err: ' + err);
        });
    }
}

export enum AlarmStatus {
    N = 'alarm.status-active',
    NF = 'alarm.status-passive',
    NA = 'alarm.status-active-ack',
}

export enum AlarmPriority {
    highhigh = 'alarm.property-highhigh',
    high = 'alarm.property-high',
    low = 'alarm.property-low',
    info = 'alarm.property-info'
}

export enum AlarmShowType {
    alarms,
    history
}