import { Component, OnInit, ViewChild } from '@angular/core';
import { MatDialogRef } from '@angular/material';

import { DaterangepickerComponent } from 'ngx-daterangepicker-material';

@Component({
    selector: 'app-daterange-dialog',
    templateUrl: './daterange-dialog.component.html',
    styleUrls: ['./daterange-dialog.component.css']
})
export class DaterangeDialogComponent implements OnInit {

    @ViewChild('dtrange') public dtrange: DaterangepickerComponent;

    options = { showCancel: true, applyLabel: ' OK ' };

    constructor(public dialogRef: MatDialogRef<DaterangeDialogComponent>) { }

    ngOnInit() {
    }

    choosedDate(event) {
        console.log(this.dtrange.startDate);
        this.dtrange.startDate
        this.dialogRef.close();
    }

    change($event) {
        console.log('dfdsf');
    }

    cancel() {
        console.log('cancel');
    }
}
