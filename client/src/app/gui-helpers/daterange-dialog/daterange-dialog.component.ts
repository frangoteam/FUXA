import { Component, ViewChild } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

import { DaterangepickerComponent } from '../daterangepicker';
import { IDateRange } from '../../_models/hmi';
@Component({
    selector: 'app-daterange-dialog',
    templateUrl: './daterange-dialog.component.html',
    styleUrls: ['./daterange-dialog.component.css']
})
export class DaterangeDialogComponent {

    @ViewChild('dtrange', {static: false}) public dtrange: DaterangepickerComponent;

    options = { };

    constructor(public dialogRef: MatDialogRef<DaterangeDialogComponent>) { }

    onOkClick() {
        let dateRange = <IDateRange> { start: this.dtrange.startDate.toDate().getTime(),
            end: this.dtrange.endDate.toDate().getTime() };
        this.dialogRef.close(dateRange);
    }

    onNoClick() {
        this.dialogRef.close();
    }
}
