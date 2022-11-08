import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
    selector: 'app-edit-name',
    templateUrl: './edit-name.component.html',
    styleUrls: ['./edit-name.component.css']
})
export class EditNameComponent {
    error = '';
    constructor(public dialogRef: MatDialogRef<EditNameComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any) { }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close(this.data);
    }

    isValid(name: string): boolean {
        if (this.data.validator) {
            if (!this.data.validator(name)) {
                return false;
            }
        }
        if (this.data.exist && this.data.exist.length) {
            return (this.data.exist.find((n) => n === name)) ? false : true;
        }
        return true;
    }

    onCheckValue(input: any) {
        if (this.data.exist && this.data.exist.length && input.target.value) {
            if (this.data.exist.find((n) => n === input.target.value)) {
                this.error = this.data.error;
                return;
            }
        }
        this.error = '';
    }
}
