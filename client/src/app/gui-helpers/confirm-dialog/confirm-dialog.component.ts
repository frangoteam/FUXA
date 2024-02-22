import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
    selector: 'app-confirm-dialog',
    templateUrl: './confirm-dialog.component.html',
    styleUrls: ['./confirm-dialog.component.css']
})
export class ConfirmDialogComponent {

    msgToConfirm = '';

    constructor(public dialogRef: MatDialogRef<ConfirmDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData) {

        this.msgToConfirm = this.data.msg;
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close(true);
    }
}

export interface ConfirmDialogData {
    msg: string;
    hideCancel?: boolean;
}
