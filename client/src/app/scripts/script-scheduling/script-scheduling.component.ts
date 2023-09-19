import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { ScriptScheduling, ScriptSchedulingMode } from '../../_models/script';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';

@Component({
    selector: 'app-script-scheduling',
    templateUrl: './script-scheduling.component.html',
    styleUrls: ['./script-scheduling.component.css']
})
export class ScriptSchedulingComponent implements OnInit {

    formGroup: UntypedFormGroup;
    scheduling = <ScriptScheduling> { interval: 0 };
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
            mode: [this.data.scheduling?.mode || 'interval'],
            interval: [this.data.scheduling?.interval || 0],
        });
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close(this.formGroup.value);
    }
}

export interface SchedulingData {
    scheduling: ScriptScheduling;
}
