import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ReportItemText } from '../../../_models/report';

@Component({
    selector: 'app-report-item-text',
    templateUrl: './report-item-text.component.html',
    styleUrls: ['./report-item-text.component.css']
})
export class ReportItemTextComponent implements OnInit {

    constructor(public dialogRef: MatDialogRef<ReportItemTextComponent>,
        @Inject(MAT_DIALOG_DATA) public data: ReportItemText) {}

    ngOnInit() {
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close(this.data);
    }
}
