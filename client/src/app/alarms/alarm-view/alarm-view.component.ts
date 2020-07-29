import { Component, OnInit, AfterViewInit, OnDestroy, Input, ViewChild, Output, EventEmitter } from '@angular/core';
import { MatDialog, MatDialogRef, MatTable, MatTableDataSource, MAT_DIALOG_DATA, MatSort, MatMenuTrigger } from '@angular/material';
import { Subscription, Subject, timer, Observable, empty } from 'rxjs';
import { takeUntil, switchMap, catchError } from 'rxjs/operators';

import { HmiService } from '../../_services/hmi.service';
import { ProjectService } from '../../_services/project.service';
import { TranslateService } from '@ngx-translate/core';
import { Alarm, AlarmSubProperty } from '../../_models/alarm';

@Component({
    selector: 'app-alarm-view',
    templateUrl: './alarm-view.component.html',
    styleUrls: ['./alarm-view.component.css']
})
export class AlarmViewComponent implements OnInit, AfterViewInit, OnDestroy {

    displayedColumns = ['ontime', 'text', 'type', 'group', 'status', 'ack'];
    dataSource = new MatTableDataSource([]);
    showheader = false;
    currentShowMode = 'collapse';
    alarmsPolling: any;
    statusText = AlarmStatus;
    priorityText = AlarmPriority;

    @Input() fullview = true;
    @Output() showMode:EventEmitter<string> = new EventEmitter();

    @ViewChild(MatTable) table: MatTable<any>;
    @ViewChild(MatSort) sort: MatSort;

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
        this.dataSource.sort = this.sort;
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
        alr.forEach(alr => {
            alr.status = this.getStatus(alr.status);
            alr.type = this.getPriority(alr.type);
        })
        this.dataSource.data = alr;
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
            console.log('Error setAlarmAck');
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