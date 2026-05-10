import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

export type AlarmImportMode = 'replace' | 'copy';

export interface AlarmImportDialogData {
    total: number;
    conflicts: number;
}

@Component({
    selector: 'app-alarm-import-dialog',
    templateUrl: './alarm-import-dialog.component.html',
    styleUrls: ['./alarm-import-dialog.component.scss']
})
export class AlarmImportDialogComponent {

    constructor(
        public dialogRef: MatDialogRef<AlarmImportDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: AlarmImportDialogData) {
    }

    onCancel() {
        this.dialogRef.close();
    }

    onReplace() {
        this.dialogRef.close(<AlarmImportMode>'replace');
    }

    onCopy() {
        this.dialogRef.close(<AlarmImportMode>'copy');
    }
}
