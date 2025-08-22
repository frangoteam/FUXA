import { ChangeDetectorRef, Component, Inject, ViewChild } from "@angular/core";
import { FlexHeadComponent } from "../../../gauge-property/flex-head/flex-head.component";
import { FlexEventComponent } from "../../../gauge-property/flex-event/flex-event.component";
import { FlexActionComponent } from "../../../gauge-property/flex-action/flex-action.component";
import { GaugeProperty } from "../../../../_models/hmi";
import { GaugeDialogType, GaugePropertyComponent, GaugePropertyData } from "../../../gauge-property/gauge-property.component";
import { HtmlInputComponent } from "../html-input.component";
import { PropertyType } from "../../../gauge-property/flex-input/flex-input.component";
import { PermissionData, PermissionDialogComponent } from "../../../gauge-property/permission-dialog/permission-dialog.component";
import { MatLegacyDialog as MatDialog, MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { SettingsService } from "../../../../_services/settings.service";

@Component({
    selector: "app-input-property",
    templateUrl: "./input-property.component.html",
    styleUrls: ["./input-property.component.scss"],
})
export class InputPropertyComponent {
    @ViewChild("flexhead", { static: false }) flexHead: FlexHeadComponent;
    @ViewChild("flexevent", { static: false }) flexEvent: FlexEventComponent;
    @ViewChild("flexaction", { static: false }) flexAction: FlexActionComponent;

    slideView = true;
    slideActionView = true;
    withBitmask = false;
    property: GaugeProperty;
    dialogType = HtmlInputComponent.getDialogType();
    eventsSupported: boolean;
    actionsSupported: any;
    defaultValue: any;

    constructor(
        public dialog: MatDialog,
        public dialogRef: MatDialogRef<GaugePropertyComponent>,
        private settingsService: SettingsService,
        private cdr: ChangeDetectorRef,
        @Inject(MAT_DIALOG_DATA) public data: GaugePropertyData | any
    ) {
        this.dialogType = this.data.dlgType;
        this.eventsSupported = this.data.withEvents;
        this.actionsSupported = this.data.withActions;
        this.property = JSON.parse(JSON.stringify(this.data.settings.property));
        if (!this.property) {
            this.property = new GaugeProperty();
        }
    }

    ngAfterViewInit() {
        this.defaultValue = this.data.default;
        this.flexHead.withProperty = PropertyType.input;
        if (this.data.withBitmask) {
            this.withBitmask = this.data.withBitmask;
        }
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.data.settings.property = this.flexHead?.getProperty();
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
        if (
            this.dialogType === GaugeDialogType.RangeWithAlarm ||
            this.dialogType === GaugeDialogType.Range ||
            this.dialogType === GaugeDialogType.Step ||
            this.dialogType === GaugeDialogType.RangeAndText
        ) {
            return this.data.withProperty !== false;
        }
        return false;
    }

    isTextToShow() {
        return (
            this.data.languageTextEnabled ||
            this.dialogType === GaugeDialogType.RangeAndText
        );
    }

    isReadonlyToShow() {
        if (this.dialogType === GaugeDialogType.Step) {
            return true;
        }
        return false;
    }
    onEditPermission() {
        let dialogRef = this.dialog.open(PermissionDialogComponent, {
            position: { top: "60px" },
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
