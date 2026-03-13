import { Component, Inject } from '@angular/core';
import { MatDialogRef as MatDialogRef, MatDialog as MatDialog, MAT_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface ReportTypeSelectorData {
}

@Component({
    selector: 'app-report-type-selector',
    templateUrl: './report-type-selector.component.html',
    styleUrls: ['./report-type-selector.component.scss']
})
export class ReportTypeSelectorComponent {

    constructor(public dialogRef: MatDialogRef<ReportTypeSelectorComponent>,
        @Inject(MAT_DIALOG_DATA) public data: ReportTypeSelectorData) { }

    onSelectType(type: string) {
        this.dialogRef.close(type);
    }

    onCancel() {
        this.dialogRef.close();
    }
}