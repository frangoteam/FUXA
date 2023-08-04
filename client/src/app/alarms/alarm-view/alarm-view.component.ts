import { Component, OnInit, AfterViewInit, OnDestroy, Input, ViewChild, Output, EventEmitter } from '@angular/core';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { Subject, timer, empty } from 'rxjs';
import { takeUntil, switchMap, catchError, delay } from 'rxjs/operators';

import { HmiService } from '../../_services/hmi.service';
import { TranslateService } from '@ngx-translate/core';
import { AlarmPriorityType, AlarmQuery, AlarmStatusType } from '../../_models/alarm';
import { FormControl, FormGroup } from '@angular/forms';

import * as moment from 'moment';
import { ConfirmDialogComponent } from '../../gui-helpers/confirm-dialog/confirm-dialog.component';
import { MatDialog } from '@angular/material/dialog';

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
    statusText = AlarmStatusType;
    priorityText = AlarmPriorityType;
    alarmShowType = AlarmShowType;
    showType = AlarmShowType.alarms;
    history = [];
    alarmsLoading = false;
    dateRange: FormGroup;

    @Input() autostart = false;
    @Input() showInContainer = false;
    @Input() fullview = true;
    @Output() showMode: EventEmitter<string> = new EventEmitter();

    dataSource = new MatTableDataSource([]);
    @ViewChild(MatTable, {static: false}) table: MatTable<any>;
    @ViewChild(MatSort, {static: false}) sort: MatSort;
    @ViewChild(MatPaginator, {static: false}) paginator: MatPaginator;

    private rxjsPollingTimer = timer(0, 2000);
    private destroy = new Subject<void>();

    constructor(private translateService: TranslateService,
                private dialog: MatDialog,
                private hmiService: HmiService) {
        const today = moment();
        this.dateRange = new FormGroup({
            endDate: new FormControl(today.set({hour: 23, minute: 59, second: 59, millisecond: 999}).toDate()),
            startDate: new FormControl(today.set({hour: 0, minute: 0, second: 0, millisecond: 0}).add(-3, 'day').toDate())
        });
    }

    ngOnInit() {
        Object.keys(this.statusText).forEach(key => {
            this.translateService.get(this.statusText[key]).subscribe((txt: string) => { this.statusText[key] = txt; });
        });
        Object.keys(this.priorityText).forEach(key => {
            this.translateService.get(this.priorityText[key]).subscribe((txt: string) => { this.priorityText[key] = txt; });
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
            });
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
            console.error('Error setAlarmAck', error);
        });
    }

    onAckAllAlarm() {
        let dialogRef = this.dialog.open(ConfirmDialogComponent, {
            data: {
                msg: this.translateService.instant('msg.alarm-ack-all')
            },
            position: {
                top: '60px'
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.hmiService.setAlarmAck(null).subscribe(result => {
                }, error => {
                    console.error('Error onAckAllAlarm', error);
                });
            }
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
        console.log(new Date(this.dateRange.value.startDate), new Date(this.dateRange.value.endDate));
        this.showType = AlarmShowType.history;
        this.displayColumns = this.historyColumns;
        let query: AlarmQuery = <AlarmQuery>{
            start: new Date(this.dateRange.value.startDate),
            end: new Date(this.dateRange.value.endDate)
        };
		this.alarmsLoading = true;
        this.hmiService.getAlarmsHistory(query).pipe(
            delay(1000)
        ).subscribe(result => {
            if (result) {
                result.forEach(alr => {
                    alr.status = this.getStatus(alr.status);
                    alr.type = this.getPriority(alr.type);
                });
                this.dataSource.data = result;
            }
		    this.alarmsLoading = false;
        });
    }
}

export enum AlarmShowType {
    alarms,
    history
}
