import { Component, Inject } from '@angular/core';
import { Utils } from '../../../_helpers/utils';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';

import { GraphSource } from '../../../_models/graph';

@Component({
    selector: 'app-graph-source-edit',
    templateUrl: './graph-source-edit.component.html',
    styleUrls: ['./graph-source-edit.component.css']
})
export class GraphSourceEditComponent {
    defaultColor = Utils.defaultColor;
    chartAxesType = [1, 2, 3, 4];

    constructor(
        public dialogRef: MatDialogRef<GraphSourceEditComponent>,
        @Inject(MAT_DIALOG_DATA) public data: GraphSource) {
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close(this.data);
    }
}
