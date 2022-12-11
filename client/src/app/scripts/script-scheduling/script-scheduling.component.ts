import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { ScriptScheduling } from '../../_models/script';

@Component({
    selector: 'app-script-scheduling',
    templateUrl: './script-scheduling.component.html',
    styleUrls: ['./script-scheduling.component.css']
})
export class ScriptSchedulingComponent {

    scheduling = <ScriptScheduling> { interval: 0 };

    constructor(
        public dialogRef: MatDialogRef<ScriptSchedulingComponent>,
        @Inject(MAT_DIALOG_DATA) public data: SchedulingData) {
            if (this.data.scheduling) {
                this.scheduling = JSON.parse(JSON.stringify(this.data.scheduling));
            }
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
