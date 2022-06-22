import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { TranslateService } from '@ngx-translate/core';
import { Report } from '../../_models/report';

@Component({
    selector: 'app-report-editor',
    templateUrl: './report-editor.component.html',
    styleUrls: ['./report-editor.component.css']
})
export class ReportEditorComponent implements OnInit {

    myForm: FormGroup;
    
    report: Report;
    constructor(public dialogRef: MatDialogRef<ReportEditorComponent>,
        public dialog: MatDialog,
        private fb: FormBuilder,
        private translateService: TranslateService,
        @Inject(MAT_DIALOG_DATA) public data: any) {

        this.report = data.report;
        this.myForm = this.fb.group({
            name: [this.report.name, Validators.required],
            receiver: [this.report.receiver, Validators.email]
        });
    }

    ngOnInit() {
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.report = this.myForm.value;
        if (this.data.editmode < 0) {
            this.dialogRef.close(this.report);
        } else if (this.checkValid()) {
            this.dialogRef.close(this.report);
        }
    }

    checkValid() {
        return this.myForm.valid;
    }
}
