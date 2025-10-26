import { Component, Inject } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef, MatLegacyDialog as MatDialog, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';

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