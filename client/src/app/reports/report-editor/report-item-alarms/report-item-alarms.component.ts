import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { AlarmPriorityType, AlarmPropertyType, AlarmStatusType, AlarmsType } from '../../../_models/alarm';
import { ReportDateRangeType, ReportItemAlarms } from '../../../_models/report';
import { ProjectService } from '../../../_services/project.service';
import { ReportItemTableComponent } from '../report-item-table/report-item-table.component';

@Component({
    selector: 'app-report-item-alarms',
    templateUrl: './report-item-alarms.component.html',
    styleUrls: ['./report-item-alarms.component.scss']
})
export class ReportItemAlarmsComponent implements OnInit {

    dateRangeType = ReportDateRangeType;
    alarmsType = [AlarmsType.HIGH_HIGH, AlarmsType.HIGH, AlarmsType.LOW, AlarmsType.INFO];
    alarmPropertyType = Object.values(AlarmPropertyType).map(a => a);
    alarmsList = [];
    alarmsListSelected = [];

    constructor(
        private projectService: ProjectService,
        public dialogRef: MatDialogRef<ReportItemTableComponent>,
        private translateService: TranslateService,
        @Inject(MAT_DIALOG_DATA) public data: ReportItemAlarms) { }

    ngOnInit() {
        Object.keys(this.dateRangeType).forEach(key => {
            this.translateService.get(this.dateRangeType[key]).subscribe((txt: string) => { this.dateRangeType[key] = txt; });
        });

        this.alarmsList = this.projectService.getAlarms().map(alarm => {
            let tag = this.projectService.getTagFromId(alarm.property?.variableId);
            return {
                name: alarm.name,
                variableName: tag?.label || tag?.name,
                variableId: alarm.property?.variableId,
            };
        });
        if (this.data.alarmFilter) {
            this.alarmsListSelected = this.alarmsList.filter(alarm => !!this.data.alarmFilter?.find(name => alarm.name === name));
        } else {
            this.alarmsListSelected = this.alarmsList;
        }
    }

    onPriorityChanged(type: AlarmsType, value: boolean) {
        this.data.priority[type] = value;
    }

    onPropertyChanged(property: AlarmPropertyType, value: boolean) {
        this.data.property[property] = value;
    }

    getPriorityValue(type: AlarmsType) {
        return this.data.priority[type];
    }

    getPropertyValue(type: AlarmPropertyType) {
        return this.data.property[type];
    }

    toggleAlarmFilterSelection(event: any) {
        this.alarmsListSelected = this.alarmsList.filter(alarm => event.checked);
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.data.priorityText = {};
        Object.keys(AlarmPriorityType).forEach(key => {
            this.translateService.get(AlarmPriorityType[key]).subscribe((txt: string) => { this.data.priorityText[key] = txt; });
        });

        this.data.propertyText = {};
        Object.keys(this.data.property).forEach(key => {
            if (this.data.property[key]) {
                this.translateService.get('alarms.view-' + key).subscribe((txt: string) => { this.data.propertyText[key] = txt; });
            }
        });
        this.data.statusText = {};
        Object.keys(AlarmStatusType).forEach(key => {
            this.translateService.get(AlarmStatusType[key]).subscribe((txt: string) => { this.data.statusText[key] = txt; });
        });
        this.data.alarmFilter = this.alarmsListSelected.map(alarm => alarm.name);
        this.dialogRef.close(this.data);
    }
}
