import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { ReportDateRangeType, ReportItemTable } from '../../../_models/report';

@Component({
    selector: 'app-report-item-table',
    templateUrl: './report-item-table.component.html',
    styleUrls: ['./report-item-table.component.css']
})
export class ReportItemTableComponent implements OnInit {

    dateRangeType = ReportDateRangeType;

    constructor(public dialogRef: MatDialogRef<ReportItemTableComponent>,
        private translateService: TranslateService,
        @Inject(MAT_DIALOG_DATA) public data: ReportItemTable) { 
            if (!this.data.tags) {
                this.data.tags = [];
            }
        }

    ngOnInit() {
        Object.keys(this.dateRangeType).forEach(key => {
            this.translateService.get(this.dateRangeType[key]).subscribe((txt: string) => { this.dateRangeType[key] = txt });
        });
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close(this.data);
    }
}
