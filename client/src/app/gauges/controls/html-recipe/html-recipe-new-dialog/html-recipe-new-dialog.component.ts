import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { MatDialogRef as MatDialogRef, MAT_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface HtmlRecipeNewDialogData {
    name: string;
    description: string;
}

@Component({
    selector: 'html-recipe-new-dialog',
    templateUrl: './html-recipe-new-dialog.component.html',
    styleUrls: ['./html-recipe-new-dialog.component.css'],
    encapsulation: ViewEncapsulation.None
})
export class HtmlRecipeNewDialogComponent {
    dialogName: string;
    dialogDescription: string;

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: HtmlRecipeNewDialogData,
        private dialogRef: MatDialogRef<HtmlRecipeNewDialogComponent>
    ) {
        this.dialogName = data.name || 'New Recipe';
        this.dialogDescription = data.description || 'New Recipe';
    }

    onCancel(): void {
        this.dialogRef.close();
    }

    onSave(): void {
        this.dialogRef.close({
            name: this.dialogName,
            description: this.dialogDescription
        });
    }
}
