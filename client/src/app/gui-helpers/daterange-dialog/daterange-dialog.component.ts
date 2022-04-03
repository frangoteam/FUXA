import { Component, OnInit, ViewChild } from '@angular/core';
import { MatDialogRef } from '@angular/material';

import { DaterangepickerComponent } from '../daterangepicker';
import { IDateRange } from '../../_models/hmi';
@Component({
    selector: 'app-daterange-dialog',
    templateUrl: './daterange-dialog.component.html',
    styleUrls: ['./daterange-dialog.component.css']
})
export class DaterangeDialogComponent implements OnInit {

    @ViewChild('dtrange') public dtrange: DaterangepickerComponent;

    options = { };

    constructor(public dialogRef: MatDialogRef<DaterangeDialogComponent>) { }

    ngOnInit() {
    }

    onOkClick() {
        let dateRange = <IDateRange> { start: this.dtrange.startDate.toDate().getTime(), 
            end: this.dtrange.endDate.toDate().getTime() };
        this.dialogRef.close(dateRange);
    }

    onNoClick() {
        this.dialogRef.close();
    }
}
