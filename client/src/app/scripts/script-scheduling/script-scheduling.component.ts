import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { SchedulerData, ScriptScheduling, ScriptSchedulingMode } from '../../_models/script';
import { FormArray, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';

@Component({
    selector: 'app-script-scheduling',
    templateUrl: './script-scheduling.component.html',
    styleUrls: ['./script-scheduling.component.scss']
})
export class ScriptSchedulingComponent implements OnInit {

    formGroup: UntypedFormGroup;
    scheduling = <ScriptScheduling>{ interval: 0 };
    schedulingMode = Object.keys(ScriptSchedulingMode);

    constructor(
        public dialogRef: MatDialogRef<ScriptSchedulingComponent>,
        private fb: UntypedFormBuilder,
        @Inject(MAT_DIALOG_DATA) public data: SchedulingData) {

        if (this.data.scheduling) {
            this.scheduling = JSON.parse(JSON.stringify(this.data.scheduling));
        }
    }

    ngOnInit() {
        this.formGroup = this.fb.group({
            mode: [this.scheduling?.mode || 'interval'],
            interval: [this.scheduling?.interval || 0],
            schedules: [this.fb.array([])]
        });
        if (this.scheduling?.schedules) {
            this.scheduling.schedules.forEach(schedule => {
                this.onAddScheduling(schedule);
            });
        }
    }

    onAddScheduling(value?: SchedulerData) {
        let schedules = this.formGroup.get('schedules') as FormArray;
        const sch = this.fb.group({
            date: [value?.date],
            days: [value?.days],
            time: [value?.time],
            hour: [value?.hour],
            minute: [value?.minute],
            type: [value?.type],
        });
        schedules.value.controls.push(sch);
    }

    onRemoveScheduling(index: number) {
        let schedules = this.formGroup.get('schedules') as FormArray;
        schedules.value.controls.splice(index, 1);
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        let schedules = this.formGroup.get('schedules') as FormArray;
        this.scheduling = <ScriptScheduling>this.formGroup.value;
        this.scheduling.schedules = schedules.value.controls.map(control => control.value);
        this.dialogRef.close(this.scheduling);
    }
}

export interface SchedulingData {
    scheduling: ScriptScheduling;
}
