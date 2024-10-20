import { Component, Inject } from '@angular/core';
import { TableFilter, TableType } from '../../../../_models/hmi';
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialog as MatDialog, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { AlarmColumns, AlarmColumnsType, AlarmHistoryColumns, AlarmHistoryColumnsType, AlarmsFilter, AlarmsType } from '../../../../_models/alarm';
import { ProjectService } from '../../../../_services/project.service';
import { DeviceTagSelectionComponent, DeviceTagSelectionData } from '../../../../device/device-tag-selection/device-tag-selection.component';
import { DeviceType } from '../../../../_models/device';

@Component({
    selector: 'app-table-alarms',
    templateUrl: './table-alarms.component.html',
    styleUrls: ['./table-alarms.component.scss']
})
export class TableAlarmsComponent {

    alarmsColumns = AlarmColumns.filter(column => column !== AlarmColumnsType.history);
    historyColumns = AlarmHistoryColumns.filter(column => column !== AlarmHistoryColumnsType.history);
    alarmPriorityType = [AlarmsType.HIGH_HIGH, AlarmsType.HIGH, AlarmsType.LOW, AlarmsType.INFO];
    tableType = TableType;
    alarmsFilter: AlarmsFilter = {
        priority: [],
        text: '',
        group: '',
        tagIds: []
    };

    constructor(
        private dialog: MatDialog,
        private projectService: ProjectService,
        public dialogRef: MatDialogRef<TableAlarmsComponent>,
        @Inject(MAT_DIALOG_DATA) public data: TableAlarmsType) {
            this.alarmsFilter.priority = this.data.filter?.filterA || [];
            this.alarmsFilter.text = this.data.filter?.filterB[0];
            this.alarmsFilter.group = this.data.filter?.filterB[1];
            this.alarmsFilter.tagIds = this.data.filter?.filterC || [];
    }

    onAlarmColumChanged(clnId: string, selected: boolean) {
        let indexToRemove = this.data.columns.indexOf(clnId);
        if (selected) {
            if (indexToRemove === -1) {
                this.data.columns.push(clnId);
            }
        } else {
            this.data.columns.splice(indexToRemove, 1);
        }
    }

    onAlarmTypeChanged(prioId: string, selected: boolean) {
        let indexToRemove = this.alarmsFilter.priority.indexOf(prioId);
        if (selected) {
            if (indexToRemove === -1) {
                this.alarmsFilter.priority.push(prioId);
            }
        } else {
            this.alarmsFilter.priority.splice(indexToRemove, 1);
        }
    }

    removeFilterTag(tagId: string) {
        const indexToRemove = this.alarmsFilter.tagIds.indexOf(tagId);
        if (indexToRemove > -1) {
            this.alarmsFilter.tagIds.splice(indexToRemove, 1);
        }
    }

    getDeviceTagName(tagId: string) {
        return this.projectService.getTagFromId(tagId)?.name;
    }

    getDeviceName(tagId: string) {
        return this.projectService.getDeviceFromTagId(tagId)?.name;
    }

    onAddTags() {
        let dialogRef = this.dialog.open(DeviceTagSelectionComponent, {
            disableClose: true,
            position: { top: '60px' },
            data: <DeviceTagSelectionData> {
                variableId: null,
                multiSelection: true,
                variablesId: this.alarmsFilter.tagIds,
                deviceFilter: [ DeviceType.internal ]
            }
        });

        dialogRef.afterClosed().subscribe((result) => {
            if (result) {
                this.alarmsFilter.tagIds = result.variablesId || [];
            }
        });
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.data.filter = {
            filterA: this.alarmsFilter.priority || [],
            filterB: [this.alarmsFilter.text, this.alarmsFilter.group],
            filterC: this.alarmsFilter.tagIds || []
        };
        this.dialogRef.close(this.data);
    }
}

export interface TableAlarmsType {
    columns: string[];
    filter: TableFilter;
    type: TableType;
}
