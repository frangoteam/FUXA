import { Component, Inject } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { ReportItemText } from '../../../_models/report';

@Component({
    selector: 'app-report-item-text',
    templateUrl: './report-item-text.component.html',
    styleUrls: ['./report-item-text.component.css']
})
export class ReportItemTextComponent {

    constructor(public dialogRef: MatDialogRef<ReportItemTextComponent>,
        @Inject(MAT_DIALOG_DATA) public data: ReportItemText) {}

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close(this.data);
    }
}
