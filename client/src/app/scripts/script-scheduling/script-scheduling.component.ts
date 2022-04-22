import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

import { Script, ScriptScheduling } from '../../_models/script';

@Component({
    selector: 'app-script-scheduling',
    templateUrl: './script-scheduling.component.html',
    styleUrls: ['./script-scheduling.component.css']
})
export class ScriptSchedulingComponent implements OnInit {

    scheduling = <ScriptScheduling> { interval: 0 };

    constructor(
        public dialogRef: MatDialogRef<ScriptSchedulingComponent>,
        @Inject(MAT_DIALOG_DATA) public data: SchedulingData) {
            if (this.data.scheduling) { 
                this.scheduling = JSON.parse(JSON.stringify(this.data.scheduling));
            }
        }

    ngOnInit() {
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close(this.scheduling);
    }
}

export interface SchedulingData {
    scheduling: ScriptScheduling;
}