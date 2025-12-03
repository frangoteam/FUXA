import { Component, Inject } from '@angular/core';
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { ParameterType } from '../../../../../_models/hmi';

@Component({
    selector: 'app-table-customizer-type-edit',
    templateUrl: './table-customizer-type-edit.component.html',
    styleUrls: ['./table-customizer-type-edit.component.scss']
})
export class TableCustomizerTypeEditComponent {
    constructor(
        public dialogRef: MatDialogRef<TableCustomizerTypeEditComponent>,
        @Inject(MAT_DIALOG_DATA) public data: TableCustomizerTypeEditDialogData) {
        if (!this.data.type) {
            this.data.type = new ParameterType();
        }
    }

    onNoClick() {
        this.dialogRef.close();
    }

    onOkClick() {
        this.dialogRef.close(this.data.type);
    }
}

export interface TableCustomizerTypeEditDialogData {
    type?: ParameterType;
    devices?: any[];
    isNew?: boolean;
}
