import { AfterViewInit, ChangeDetectorRef, Component, Inject, ViewChild } from '@angular/core';
import { FlexHeadComponent } from '../../../gauge-property/flex-head/flex-head.component';
import { FlexEventComponent } from '../../../gauge-property/flex-event/flex-event.component';
import { FlexActionComponent } from '../../../gauge-property/flex-action/flex-action.component';
import { GaugeProperty, InputActionEscType, InputConvertionType, InputOptionsProperty, InputOptionType, InputTimeFormatType, IPropertyVariable, View } from '../../../../_models/hmi';
import { GaugePropertyData } from '../../../gauge-property/gauge-property.component';
import { HtmlInputComponent } from '../html-input.component';
import { PropertyType } from '../../../gauge-property/flex-input/flex-input.component';
import { PermissionData, PermissionDialogComponent } from '../../../gauge-property/permission-dialog/permission-dialog.component';
import { MatLegacyDialog as MatDialog, MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { SettingsService } from '../../../../_services/settings.service';
import { ProjectService } from '../../../../_services/project.service';
import { Script } from '../../../../_models/script';
import { MatSelectChange } from '@angular/material/select';

@Component({
    selector: 'app-input-property',
    templateUrl: './input-property.component.html',
    styleUrls: ['./input-property.component.scss'],
})
export class InputPropertyComponent implements AfterViewInit {
    @ViewChild('flexhead', { static: false }) flexHead: FlexHeadComponent;
    @ViewChild('flexevent', { static: false }) flexEvent: FlexEventComponent;
    @ViewChild('flexaction', { static: false }) flexAction: FlexActionComponent;

    slideView = true;
    slideActionView = true;
    withBitmask = false;
    property: GaugeProperty;
    dialogType = HtmlInputComponent.getDialogType();
    eventsSupported: boolean;
    actionsSupported: any;
    withProperty = PropertyType.input;
    views: View[];
    scripts: Script[];
    inputOptionType = InputOptionType;
    inputTimeFormatType = InputTimeFormatType;
    inputConvertionType = InputConvertionType;
    inputActionEscType = InputActionEscType;

    constructor(
        public dialog: MatDialog,
        public dialogRef: MatDialogRef<InputPropertyComponent>,
        private settingsService: SettingsService,
        private projectService: ProjectService,
        private cdr: ChangeDetectorRef,
        @Inject(MAT_DIALOG_DATA) public data: GaugePropertyData | any
    ) {
        this.eventsSupported = this.data.withEvents;
        this.actionsSupported = this.data.withActions;
        this.property = JSON.parse(JSON.stringify(this.data.settings.property));
        if (!this.property) {
            this.property = new GaugeProperty();
        }
        this.property.options = this.property.options || <InputOptionsProperty>{ updated: false, numeric: false };
        this.property.options.type = this.property.options.type ? this.property.options.type : this.property.options.numeric ? this.inputOptionType.number : this.inputOptionType.text;
        if (!this.property.options.actionOnEsc && this.property.options.updatedEsc) {   // compatibility 1.2.1
            this.property.options.actionOnEsc = InputActionEscType.update;
        } else if (this.property.options.actionOnEsc) {
            this.property.options.updatedEsc = null;
        }
        this.property.options.maxlength = this.property.options?.maxlength ?? null,
        this.property.options.readonly = !!this.property.options?.readonly;
        this.views = this.projectService.getHmi()?.views ?? [];
        this.scripts = this.projectService.getScripts();
    }

    ngAfterViewInit() {
        if (this.data.withBitmask) {
            this.withBitmask = this.data.withBitmask;
        }
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.data.settings.property = this.property;
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

    setVariable(event: IPropertyVariable) {
        this.property.variableId = event.variableId;
        this.property.variableValue = event.variableValue;
        this.property.bitmask = event.bitmask;
    }

    isTextToShow() {
        return this.data.languageTextEnabled;
    }

    onEditPermission() {
        let dialogRef = this.dialog.open(PermissionDialogComponent, {
            position: { top: '60px' },
            data: <PermissionData>{
                permission: this.property.permission,
                permissionRoles: this.property.permissionRoles,
            },
        });

        dialogRef.afterClosed().subscribe((result: PermissionData) => {
            if (result) {
                this.property.permission = result.permission;
                this.property.permissionRoles = result.permissionRoles;
            }
            this.cdr.detectChanges();
        });
    }

    onTypeChange(select: MatSelectChange) {
        if (!this.property.options.timeformat && (select.value === InputOptionType.time || select.value === InputOptionType.datetime)) {
            this.property.options.timeformat = InputTimeFormatType.normal;
        }
        if (!this.property.options.convertion && (select.value === InputOptionType.time || select.value === InputOptionType.date || select.value === InputOptionType.datetime)) {
            this.property.options.convertion = InputConvertionType.milliseconds;
        }
    }

    isRolePermission() {
        return this.settingsService.getSettings()?.userRole;
    }

    havePermission() {
        if (this.isRolePermission()) {
            return (
                this.property.permissionRoles?.show?.length ||
                this.property.permissionRoles?.enabled?.length
            );
        } else {
            return this.property.permission;
        }
    }
}
