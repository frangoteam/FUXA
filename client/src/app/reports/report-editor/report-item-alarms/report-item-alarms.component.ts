import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs/operators';
import { AlarmPriorityType, AlarmPropertyType, AlarmStatusType, AlarmsType } from '../../../_models/alarm';
import { ReportDateRangeType, ReportItemAlarms } from '../../../_models/report';
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

    constructor(
        public dialogRef: MatDialogRef<ReportItemTableComponent>,
        private translateService: TranslateService,
        @Inject(MAT_DIALOG_DATA) public data: ReportItemAlarms) { }

    ngOnInit() {
        Object.keys(this.dateRangeType).forEach(key => {
            this.translateService.get(this.dateRangeType[key]).subscribe((txt: string) => { this.dateRangeType[key] = txt; });
        });
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
        this.dialogRef.close(this.data);
    }
}
