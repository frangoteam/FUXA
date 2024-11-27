import { Component, Inject } from '@angular/core';
import { Utils } from '../../../_helpers/utils';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { ChartLine } from '../../../_models/chart';

@Component({
    selector: 'app-chart-line-property',
    templateUrl: './chart-line-property.component.html',
    styleUrls: ['./chart-line-property.component.css']
})
export class ChartLinePropertyComponent {
    defaultColor = Utils.defaultColor;
    chartAxesType = [1, 2, 3, 4];

    constructor(
        public dialogRef: MatDialogRef<ChartLinePropertyComponent>,
        @Inject(MAT_DIALOG_DATA) public data: ChartLineAndInterpolationsType) {
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close(this.data);
    }
}

export type ChartLineAndInterpolationsType = ChartLine & {
    lineInterpolationType: { text: string; value: any }[];
  };
