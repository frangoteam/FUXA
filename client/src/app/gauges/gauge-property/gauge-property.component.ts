/* eslint-disable @angular-eslint/component-class-suffix */
import { Component, Inject, Input, AfterViewInit, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';

import { SelOptionsComponent } from '../../gui-helpers/sel-options/sel-options.component';

import { FlexHeadComponent } from './flex-head/flex-head.component';
import { FlexEventComponent } from './flex-event/flex-event.component';
import { FlexActionComponent } from './flex-action/flex-action.component';
import { GaugeProperty, GaugeSettings, View } from '../../_models/hmi';
import { Script } from '../../_models/script';
import { UserGroups } from '../../_models/user';
import { PropertyType } from './flex-input/flex-input.component';

@Component({
    selector: 'gauge-property',
    templateUrl: './gauge-property.component.html',
    styleUrls: ['./gauge-property.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class GaugePropertyComponent implements AfterViewInit {

    @Input() name: any;
    @ViewChild('flexhead', {static: false}) flexHead: FlexHeadComponent;
    @ViewChild('flexevent', {static: false}) flexEvent: FlexEventComponent;
    @ViewChild('flexaction', {static: false}) flexAction: FlexActionComponent;

    slideView = true;
    slideActionView = true;
    withBitmask = false;
    property: GaugeProperty;
    dialogType: GaugeDialogType = GaugeDialogType.RangeWithAlarm;
    eventsSupported: boolean;
    actionsSupported: any;
    views: View[];
    defaultValue: any;
    inputs: GaugeSettings[];
    scripts: Script[];

    constructor(public dialog: MatDialog,
                public dialogRef: MatDialogRef<GaugePropertyComponent>,
                @Inject(MAT_DIALOG_DATA) public data: any) {
        this.dialogType = this.data.dlgType;
        this.eventsSupported = this.data.withEvents;
        this.actionsSupported = this.data.withActions;
        this.views = this.data.views;
        this.inputs = this.data.inputs;
        this.scripts = this.data.scripts;
        this.property = JSON.parse(JSON.stringify(this.data.settings.property));
        if (!this.property) {
            this.property = new GaugeProperty();
        }
    }

    ngAfterViewInit() {
        this.defaultValue = this.data.default;
        if (this.data.withProperty !== false) { // else undefined
            if (this.dialogType === GaugeDialogType.Input) {
                this.flexHead.withProperty = PropertyType.input;
            } else if (this.dialogType === GaugeDialogType.ValueAndUnit) {
                this.flexHead.withProperty = PropertyType.output;
            } else {
                this.flexHead.defaultValue = this.defaultValue;
                this.flexHead.withProperty = PropertyType.range;
                if (this.dialogType === GaugeDialogType.ValueWithRef) {
                    this.flexHead.withProperty = PropertyType.text;
                } else if (this.dialogType === GaugeDialogType.Step) {
                    this.flexHead.withProperty = PropertyType.step;
                } else if (this.dialogType === GaugeDialogType.MinMax) {
                    this.flexHead.withProperty = PropertyType.minmax;
                }
            }
        }
        if (this.data.withBitmask) {
            this.withBitmask = this.data.withBitmask;
        }
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        // this.data.settings.property = this.flexHead.property;
        this.data.settings.property = this.flexHead.getProperty();
        if (this.flexEvent) {
            this.data.settings.property.events = this.flexEvent.getEvents();
        }
        if (this.flexAction) {
            this.data.settings.property.actions = this.flexAction.getActions();
        }
        if (this.property.readonly) {
            this.property.readonly = true;
        } else {
            delete this.property.readonly;
        }
    }

    onAddInput() {
        this.flexHead.onAddInput();
    }

    onAddEvent() {
        this.flexEvent.onAddEvent();
    }

    onAddAction() {
        this.flexAction.onAddAction();
    }

    onRangeViewToggle() {
        this.flexHead.onRangeViewToggle(this.slideView);
    }

    onActionRangeViewToggle() {
        this.flexAction.onRangeViewToggle(this.slideActionView);
    }

    isToolboxToShow() {
        if (this.dialogType === GaugeDialogType.RangeWithAlarm || this.dialogType === GaugeDialogType.Range || this.dialogType === GaugeDialogType.Step ||
            this.dialogType === GaugeDialogType.RangeAndText) {
            return this.data.withProperty !== false;
        }
        return false;
    }

    isRangeToShow() {
        if (this.dialogType === GaugeDialogType.RangeWithAlarm || this.dialogType === GaugeDialogType.Range || this.dialogType === GaugeDialogType.RangeAndText) {
            return true;
        }
        return false;
    }

    isTextToShow() {
        if (this.dialogType === GaugeDialogType.RangeAndText) {
            return true;
        }
        return false;
    }

    isAlarmToShow() {
        if (this.dialogType === GaugeDialogType.RangeWithAlarm) {
            return true;
        }
        return false;
    }

    isReadonlyToShow() {
        if (this.dialogType === GaugeDialogType.Step) {
            return true;
        }
        return false;
    }

    onEditPermission() {
        let permission = this.property.permission;
        let dialogRef = this.dialog.open(DialogGaugePermission, {
            position: { top: '60px' },
            data: { permission: permission }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.property.permission = result.permission;
            }
        });
    }
}

export enum GaugeDialogType {
    Range,
    RangeAndText,
    RangeWithAlarm,
    ValueAndUnit,
    ValueWithRef,
    Step,
    MinMax,
    Chart,
    Gauge,
    Pipe,
    Slider,
    Switch,
    Graph,
    Iframe,
    Table,
    Input,
    Panel
}

@Component({
    selector: 'dialog-gaugepermission',
    templateUrl: './gauge-permission.dialog.html',
})
export class DialogGaugePermission {
    selectedGroups = [];
    extensionGroups = [];
    groups = UserGroups.Groups;

    @ViewChild(SelOptionsComponent, {static: false}) seloptions: SelOptionsComponent;

    constructor(
        public dialogRef: MatDialogRef<DialogGaugePermission>,
        @Inject(MAT_DIALOG_DATA) public data: any) {
        this.selectedGroups = UserGroups.ValueToGroups(this.data.permission);
        this.extensionGroups = UserGroups.ValueToGroups(this.data.permission, true);

    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.data.permission = UserGroups.GroupsToValue(this.seloptions.selected);
        this.data.permission += UserGroups.GroupsToValue(this.seloptions.extSelected, true);
        this.dialogRef.close(this.data);
    }
}
