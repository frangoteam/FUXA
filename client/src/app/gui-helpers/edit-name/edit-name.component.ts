import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

@Component({
    selector: 'app-edit-name',
    templateUrl: './edit-name.component.html',
    styleUrls: ['./edit-name.component.css']
})
export class EditNameComponent {

    constructor(public dialogRef: MatDialogRef<EditNameComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any) { }
    
    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close(this.data);
    }
}
