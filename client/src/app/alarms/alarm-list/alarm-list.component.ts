import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild } from '@angular/core';
import { MatDialog as MatDialog } from '@angular/material/dialog';
import { MatTable as MatTable, MatTableDataSource as MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { Subscription } from 'rxjs';

import { ProjectService } from '../../_services/project.service';
import { TranslateService } from '@ngx-translate/core';
import { AlarmPropertyComponent } from '../alarm-property/alarm-property.component';
import { Alarm, AlarmSubProperty, AlarmSubActions } from '../../_models/alarm';
import { ToastNotifierService } from '../../_services/toast-notifier.service';
import { AlarmImportDialogComponent, AlarmImportMode } from './alarm-import-dialog/alarm-import-dialog.component';

@Component({
    selector: 'app-alarm-list',
    templateUrl: './alarm-list.component.html',
    styleUrls: ['./alarm-list.component.scss']
})
export class AlarmListComponent implements OnInit, AfterViewInit, OnDestroy {

    displayedColumns = ['select', 'name', 'device', 'highhigh', 'high', 'low', 'info', 'actions', 'remove'];
    dataSource = new MatTableDataSource([]);
    importingAlarms = false;

    private subscriptionLoad: Subscription;
    private enabledText = '';

    @ViewChild(MatTable, {static: false}) table: MatTable<any>;
    @ViewChild(MatSort, {static: false}) sort: MatSort;
    @ViewChild('fileImportInput', {static: false}) fileImportInput: any;

    constructor(public dialog: MatDialog,
        private translateService: TranslateService,
        private projectService: ProjectService,
        private toastNotifyService: ToastNotifierService) { }

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

    onCopyAlarm(alarm: Alarm) {
        let copy = JSON.parse(JSON.stringify(alarm));
        copy.name = copy.name + ' (copy)';
        this.editAlarm(copy, 1);
    }

    onRemoveAlarm(alarm: Alarm) {
		this.editAlarm(alarm, -1);
    }

    onImportAlarms() {
        if (this.importingAlarms) {
            return;
        }
        let ele = document.getElementById('alarmsConfigFileUpload') as HTMLElement;
        ele.click();
    }

    onExportAlarms() {
        if (this.importingAlarms) {
            return;
        }
        try {
            this.projectService.exportAlarms();
        } catch (err) {
            console.error(err);
            this.toastNotifyService.notifyError('msg.export-alarms-error');
        }
    }

    onAlarmFileChangeListener(event) {
        let input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) {
            return;
        }
        let reader = new FileReader();
        reader.onload = () => {
            try {
                const alarms = JSON.parse(reader.result.toString());
                if (!Array.isArray(alarms)) {
                    this.toastNotifyService.notifyError('msg.import-alarms-error');
                    return;
                }
                this.confirmAndImportAlarms(alarms);
            } catch (err) {
                console.error(err);
                this.toastNotifyService.notifyError('msg.import-alarms-error', input.files[0].name);
            }
        };
        reader.onerror = () => {
            this.toastNotifyService.notifyError('msg.import-alarms-error', input.files[0].name);
        };
        reader.readAsText(input.files[0]);
        if (input) {
            input.value = '';
        }
    }

    private confirmAndImportAlarms(alarms: Alarm[]) {
        const existingNames = this.getExistingAlarmNames();
        const conflicts = alarms.filter((alarm: Alarm) => alarm?.name && existingNames.has(alarm.name));
        if (!conflicts.length) {
            this.importAlarms(alarms);
            return;
        }

        let dialogRef = this.dialog.open(AlarmImportDialogComponent, {
            data: { total: alarms.length, conflicts: conflicts.length },
            position: { top: '80px' }
        });
        dialogRef.afterClosed().subscribe((mode: AlarmImportMode) => {
            if (mode === 'replace') {
                this.importAlarms(alarms);
            } else if (mode === 'copy') {
                this.importAlarms(this.renameConflictingAlarms(alarms));
            }
        });
    }

    private importAlarms(alarms: Alarm[]) {
        this.importingAlarms = true;
        this.projectService.importAlarms(alarms).subscribe(success => {
            this.projectService.onRefreshProject();
            this.loadAlarms();
            this.importingAlarms = false;
            if (!success) {
                this.toastNotifyService.notifyError('msg.import-alarms-error');
            }
        }, err => {
            console.error(err);
            this.importingAlarms = false;
            this.toastNotifyService.notifyError('msg.import-alarms-error');
        });
    }

    private renameConflictingAlarms(alarms: Alarm[]) {
        const usedNames = this.getExistingAlarmNames();
        return alarms.map((alarm: Alarm) => {
            const importedAlarm = JSON.parse(JSON.stringify(alarm));
            if (!importedAlarm?.name) {
                return importedAlarm;
            }
            if (usedNames.has(importedAlarm.name)) {
                importedAlarm.name = this.getCopyName(importedAlarm.name, usedNames);
            }
            usedNames.add(importedAlarm.name);
            return importedAlarm;
        });
    }

    private getCopyName(name: string, usedNames: Set<string>) {
        const copyName = `${name}-copy`;
        if (!usedNames.has(copyName)) {
            return copyName;
        }
        let index = 2;
        while (usedNames.has(`${copyName}-${index}`)) {
            index++;
        }
        return `${copyName}-${index}`;
    }

    private getExistingAlarmNames() {
        return new Set((this.projectService.getAlarms() || []).map((alarm: Alarm) => alarm.name));
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
