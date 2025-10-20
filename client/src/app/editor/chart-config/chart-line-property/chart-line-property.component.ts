import { Component, Inject, OnInit } from '@angular/core';
import { Utils } from '../../../_helpers/utils';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { ChartLine, ChartLineZone } from '../../../_models/chart';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';

@Component({
    selector: 'app-chart-line-property',
    templateUrl: './chart-line-property.component.html',
    styleUrls: ['./chart-line-property.component.scss']
})
export class ChartLinePropertyComponent implements OnInit {
    defaultColor = Utils.defaultColor;
    chartAxesType = [1, 2, 3, 4];
    formGroup: UntypedFormGroup;

    constructor(
        private fb: UntypedFormBuilder,
        public dialogRef: MatDialogRef<ChartLinePropertyComponent>,
        @Inject(MAT_DIALOG_DATA) public data: ChartLineAndInterpolationsType) {
    }

    ngOnInit() {
        this.formGroup = this.fb.group({
            name: [{value: this.data.name, disabled: true }, Validators.required],
            label: [this.data.label, Validators.required],
            yaxis: [this.data.yaxis],
            lineInterpolation: [this.data.lineInterpolation],
            lineWidth: [this.data.lineWidth],
            spanGaps: [this.data.spanGaps]
        });
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close({...this.data, ...this.formGroup.getRawValue()});
    }

    onAddZone() {
        if (!this.data.zones) {
            this.data.zones = [];
        }
        this.data.zones.push(<ChartLineZone> {
            min: 0,
            max: 0,
            stroke: '#FF2525',
            fill: '#BFCDDB'
        });
    }

    onRemoveZone(index: number) {
        this.data.zones.splice(index, 1);
    }
}

export type ChartLineAndInterpolationsType = ChartLine & {
    lineInterpolationType: { text: string; value: any }[];
};
