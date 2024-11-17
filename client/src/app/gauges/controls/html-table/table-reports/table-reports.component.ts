import { Component, Inject } from '@angular/core';
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialog as MatDialog, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { ReportColumns, ReportsFilter } from '../../../../_models/report';
import { TableFilter, TableType } from '../../../../_models/hmi';
import { ProjectService } from '../../../../_services/project.service';

@Component({
    selector: 'app-table-reports',
    templateUrl: './table-reports.component.html',
    styleUrls: ['./table-reports.component.scss']
})
export class TableReportsComponent {

    reportsColumns = ReportColumns;
    reportsFilter: ReportsFilter = {
        name: '',
        count: ''
    };

    constructor(
        private dialog: MatDialog,
        private projectService: ProjectService,
        public dialogRef: MatDialogRef<TableReportsComponent>,
        @Inject(MAT_DIALOG_DATA) public data: TableReportsType) {
            this.reportsFilter.name = this.data.filter?.filterA[0];
            this.reportsFilter.count = this.data.filter?.filterA[1];
    }


    onReportColumChanged(clnId: string, selected: boolean) {
        let indexToRemove = this.data.columns.indexOf(clnId);
        if (selected) {
            if (indexToRemove === -1) {
                this.data.columns.push(clnId);
            }
        } else {
            this.data.columns.splice(indexToRemove, 1);
        }
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.data.filter = {
            filterA: [this.reportsFilter.name, this.reportsFilter.count],
        };
        this.dialogRef.close(this.data);
    }
}

export interface TableReportsType {
    columns: string[];
    filter: TableFilter;
    type: TableType;
}
