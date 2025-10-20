import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { ProjectService } from '../../../_services/project.service';
import { Device } from '../../../_models/device';
import { GaugeProperty } from '../../../_models/hmi';
import { FlexActionComponent } from '../flex-action/flex-action.component';

@Component({
    selector: 'app-action-properties-dialog',
    templateUrl: './action-properties-dialog.component.html',
    styleUrls: ['./action-properties-dialog.component.scss']
})
export class ActionPropertiesDialogComponent implements OnInit {

    @ViewChild('flexaction', {static: false}) flexAction: FlexActionComponent;
    property: GaugeProperty;

    constructor(
        private projectService: ProjectService,
        public dialogRef: MatDialogRef<ActionPropertiesDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: ActionPropertiesData) { }

    ngOnInit() {
        if (!this.data.devices) {
            this.data.devices = Object.values(this.projectService.getDevices());
        }
        this.property = this.data.property;
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.data.property.actions = this.flexAction.getActions();
        this.dialogRef.close(this.data);
    }

    onAddAction() {
        this.flexAction.onAddAction();
    }
}

export interface ActionPropertiesData {
    devices?: Device[];
    withActions: any;
    property: GaugeProperty;
}

