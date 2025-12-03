import { Component, Inject } from '@angular/core';
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { TableCellAlignType } from '../../../../../_models/hmi';

export interface TableCustomizerTextRowEditDialogData {
    row: any; // TableRow/ParameterRow-ish
}

@Component({
    selector: 'app-table-customizer-text-row-edit',
    templateUrl: './table-customizer-text-row-edit.component.html',
    styleUrls: ['./table-customizer-text-row-edit.component.scss']
})
export class TableCustomizerTextRowEditComponent {
    public row: any;
    public tableCellAlignType = TableCellAlignType;
    constructor(
        public dialogRef: MatDialogRef<TableCustomizerTextRowEditComponent>,
        @Inject(MAT_DIALOG_DATA) public data: TableCustomizerTextRowEditDialogData
    ) {
        this.row = this.data.row;
        // Provide defaults if not present
        if (!this.row.textContent) this.row.textContent = '';
        if (this.row.textAlign === undefined || this.row.textAlign === null) this.row.textAlign = TableCellAlignType.left;
        if (!this.row.textSize) this.row.textSize = 12;
        if (this.row.textBold === undefined) this.row.textBold = false;
    }

    onCancel() {
        this.dialogRef.close();
    }

    onSave() {
        this.row.modified = new Date();
        this.dialogRef.close(this.row);
    }
}
