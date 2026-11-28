import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef as MatDialogRef, MAT_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/dialog';
import { GaugePanelProperty, PropertyScaleModeType, View } from '../../../../_models/hmi';
import { FlexDeviceTagValueType } from '../../../gauge-property/flex-device-tag/flex-device-tag.component';

@Component({
    selector: 'app-panel-property',
    templateUrl: './panel-property.component.html',
    styleUrls: ['./panel-property.component.scss']
})
export class PanelPropertyComponent implements OnInit {

    property: GaugePanelProperty;
    scaleMode = PropertyScaleModeType;

    constructor(public dialogRef: MatDialogRef<PanelPropertyComponent>,
                @Inject(MAT_DIALOG_DATA) public data: any) {
        if (!this.data.settings.property) {
            this.data.settings.property = <GaugePanelProperty>{ viewName: null, variableId: null, scaleMode: null, variablesMapping: [] };
        }
        this.property = <GaugePanelProperty>JSON.parse(JSON.stringify(this.data.settings.property));
        if (!this.property.variablesMapping) {
            this.property.variablesMapping = [];
        }
    }

    ngOnInit() { }

    onTagChanged(daveiceTag: FlexDeviceTagValueType) {
        this.property.variableId = daveiceTag.variableId;
    }

    getView(viewName: string): View {
        if (!viewName || !this.data?.views) {
            return null;
        }
        return this.data.views.find((v: View) => v.name === viewName);
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.data.settings.property = this.property;
    }
}
