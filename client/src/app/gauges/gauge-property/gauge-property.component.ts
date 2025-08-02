/* eslint-disable @angular-eslint/component-class-suffix */
import { Component, Inject, Input, AfterViewInit, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialog as MatDialog, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { FlexHeadComponent } from './flex-head/flex-head.component';
import { FlexEventComponent } from './flex-event/flex-event.component';
import { FlexActionComponent } from './flex-action/flex-action.component';
import { GaugeProperty, GaugeSettings, View, WidgetProperty } from '../../_models/hmi';
import { Script } from '../../_models/script';
import { PropertyType } from './flex-input/flex-input.component';
import { PermissionData, PermissionDialogComponent } from './permission-dialog/permission-dialog.component';
import { SettingsService } from '../../_services/settings.service';
import { Device } from '../../_models/device';

@Component({
    selector: 'gauge-property',
    templateUrl: './gauge-property.component.html',
    styleUrls: ['./gauge-property.component.scss'],
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
    property: GaugeProperty | WidgetProperty;
    dialogType: GaugeDialogType = GaugeDialogType.RangeWithAlarm;
    eventsSupported: boolean;
    actionsSupported: any;
    views: View[];
    defaultValue: any;
    inputs: GaugeSettings[];
    scripts: Script[];

    constructor(public dialog: MatDialog,
                public dialogRef: MatDialogRef<GaugePropertyComponent>,
                private settingsService: SettingsService,
                private cdr: ChangeDetectorRef,
                @Inject(MAT_DIALOG_DATA) public data: GaugePropertyData | any) {
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
        if (!this.isWidget() && this.data.withProperty !== false) { // else undefined
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
        if (this.isWidget()) {
            this.data.settings.property = this.property;
        } else {
            this.data.settings.property = this.flexHead?.getProperty();
        }
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
        return this.data.languageTextEnabled || (this.dialogType === GaugeDialogType.RangeAndText);
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
        let dialogRef = this.dialog.open(PermissionDialogComponent, {
            position: { top: '60px' },
            data: <PermissionData>{ permission: this.property.permission, permissionRoles: this.property.permissionRoles }
        });

        dialogRef.afterClosed().subscribe((result: PermissionData) => {
            if (result) {
                this.property.permission = result.permission;
                this.property.permissionRoles = result.permissionRoles;
            }
            this.cdr.detectChanges();
        });
    }

    isWidget() {
        return (this.property as WidgetProperty).type;
    }

    isRolePermission() {
        return this.settingsService.getSettings()?.userRole;
    }

    havePermission() {
        if (this.isRolePermission()) {
            return this.property.permissionRoles?.show?.length || this.property.permissionRoles?.enabled?.length;
        } else {
            return this.property.permission;
        }
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
    Panel,
    Video
}

export interface GaugePropertyData {
    dlgType: GaugeDialogType;
    withEvents: boolean;
    withActions: any;
    withBitmask: boolean;
    views: View[];
    view: View;
    inputs: GaugeSettings[];
    scripts: Script[];
    settings: any;
    default: any;
    devices: Device[];
    title: string;
    names: string[];
    languageTextEnabled: boolean;
}
