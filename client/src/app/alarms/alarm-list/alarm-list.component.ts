import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { Subscription } from 'rxjs';

import { ProjectService } from '../../_services/project.service';
import { TranslateService } from '@ngx-translate/core';
import { AlarmPropertyComponent } from '../alarm-property/alarm-property.component';
import { Alarm, AlarmSubProperty, AlarmSubActions } from '../../_models/alarm';

@Component({
    selector: 'app-alarm-list',
    templateUrl: './alarm-list.component.html',
    styleUrls: ['./alarm-list.component.css']
})
export class AlarmListComponent implements OnInit, AfterViewInit, OnDestroy {

    displayedColumns = ['select', 'name', 'device', 'highhigh', 'high', 'low', 'info', 'actions', 'remove'];
    dataSource = new MatTableDataSource([]);

    private subscriptionLoad: Subscription;
    private enabledText = '';

    @ViewChild(MatTable, {static: false}) table: MatTable<any>;
    @ViewChild(MatSort, {static: false}) sort: MatSort;

    constructor(public dialog: MatDialog,
        private translateService: TranslateService,
        private projectService: ProjectService) { }

    ngOnInit() {
        this.loadAlarms();
        this.subscriptionLoad = this.projectService.onLoadHmi.subscribe(res => {
            this.loadAlarms();
        });
    	this.translateService.get('alarm.property-enabled').subscribe((txt: string) => { this.enabledText = txt; });
    }

    ngAfterViewInit() {
        this.dataSource.sort = this.sort;
    }

    ngOnDestroy() {
        try {
            if (this.subscriptionLoad) {
                this.subscriptionLoad.unsubscribe();
            }
        } catch (e) {
        }
    }

    onAddAlarm() {
		let alarm = new Alarm();
		this.editAlarm(alarm, 1);
    }

    onEditAlarm(alarm: Alarm) {
		this.editAlarm(alarm, 0);
    }

    onRemoveAlarm(alarm: Alarm) {
		this.editAlarm(alarm, -1);
    }

    editAlarm(alarm: Alarm, toAdd: number) {
		let malarm: Text = JSON.parse(JSON.stringify(alarm));
        let dialogRef = this.dialog.open(AlarmPropertyComponent, {
            disableClose: true,
            data: { alarm: malarm, editmode: toAdd, alarms: this.dataSource.data,
                devices: Object.values(this.projectService.getDevices()), views: this.projectService.getViews() },
            position: { top: '80px' }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                if (toAdd < 0) {
                    this.projectService.removeAlarm(result).subscribe(result => {
                        this.loadAlarms();
                    });
				} else {
                    this.projectService.setAlarm(result, alarm).subscribe(result => {
                        this.loadAlarms();
                    });
                }
            }
        });
    }

    getSubProperty(alrSubPro: AlarmSubProperty) {
        if (alrSubPro && alrSubPro.enabled && AlarmSubProperty.isValid(alrSubPro)) {
            return this.enabledText;
        }
        return '';
    }

    getSubActionsProperty(alrSubAct: AlarmSubActions) {
        if (alrSubAct && alrSubAct.enabled && AlarmSubActions.isValid(alrSubAct)) {
            return this.enabledText;
        }
        return '';
    }

    getVariableLabel(varProp) {
        if (!varProp.variableId) {
            return '';
        }
        let device = this.projectService.getDeviceFromTagId(varProp.variableId);
        if (device) {
            return device.name + ' - ' + device.tags[varProp.variableId].name;
        }
        return '';
    }

    private loadAlarms() {
        this.dataSource.data = this.projectService.getAlarms();
	}
}
