import { Component, Inject, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { PermissionData, PermissionDialogComponent } from '../../../gauge-property/permission-dialog/permission-dialog.component';
import { GaugeEventActionType, View } from '../../../../_models/hmi';
import { Script } from '../../../../_models/script';
import { ProjectService } from '../../../../_services/project.service';
import { TranslateService } from '@ngx-translate/core';

interface SchedulerDevice {
    variableId: string;
    name: string;
    permission?: number;
    permissionRoles?: {
        show: string[];
        enabled: string[];
    };
}

interface SchedulerDeviceAction {
    deviceName: string;
    action: string;
    actparam?: string;
    actoptions?: any;
    eventTrigger?: 'on' | 'off';
}

@Component({
    selector: 'app-scheduler-property',
    templateUrl: './scheduler-property.component.html',
    styleUrls: ['./scheduler-property.component.scss']
})
export class SchedulerPropertyComponent implements OnInit {
    @Input() data: any;
    @Output() onPropChanged = new EventEmitter<any>();
    @Input('reload') set reload(b: any) {
        this._reload();
    }
    deviceList: SchedulerDevice[] = [];
    deviceActionsOn: SchedulerDeviceAction[] = [];
    deviceActionsOff: SchedulerDeviceAction[] = [];
    views: View[] = [];
    scripts: Script[] = [];
    inputs: any[] = [];
    actionType = GaugeEventActionType;
    actionTypeKeys: any = {};

    constructor(
        public dialogRef?: MatDialogRef<SchedulerPropertyComponent>,
        @Inject(MAT_DIALOG_DATA) dialogData?: any,
        private dialog?: MatDialog,
        private projectService?: ProjectService,
        private translateService?: TranslateService
    ) {
        if (dialogData) {
            this.data = dialogData;
        }
    }

    ngOnInit(): void {
        this._reload();
    }

    private _reload() {
        if (this.projectService) {
            this.views = this.projectService.getViews();
            this.scripts = this.projectService.getScripts();
        }
        const serverSideActions = {
            onSetValue: this.actionType.onSetValue,
            onToggleValue: this.actionType.onToggleValue,
            onRunScript: this.actionType.onRunScript
        };
        if (this.translateService) {
            Object.keys(serverSideActions).forEach(key => {
                this.translateService.get(serverSideActions[key]).subscribe((txt: string) => {
                    this.actionTypeKeys[key] = txt;
                });
            });
        }
        if (!this.data.settings) {
            this.data.settings = {};
        }
        if (!this.data.settings.property) {
            this.data.settings.property = {};
        }
        if (!this.data.settings.name) {
            this.data.settings.name = 'scheduler_1';
        }
        const property = this.data.settings.property;
        if (!property.accentColor) property.accentColor = '#556e82';
        if (!property.backgroundColor) property.backgroundColor = '#f0f0f0';
        if (!property.textColor) property.textColor = '#505050';
        if (!property.secondaryTextColor) property.secondaryTextColor = '#ffffff';
        if (!property.borderColor) property.borderColor = '#cccccc';
        if (!property.hoverColor) property.hoverColor = '#f5f5f5';
        if (!property.timeFormat) property.timeFormat = '12hr';
        if (property.devices && Array.isArray(property.devices) && property.devices.length > 0) {
            this.deviceList = [...property.devices];
        } else {
            this.deviceList = [{ variableId: '', name: 'Device 1' }];
            property.devices = [...this.deviceList];
        }
        if (property.deviceActions && Array.isArray(property.deviceActions)) {
            this.deviceActionsOn = property.deviceActions.filter(e => e.eventTrigger === 'on' || !e.eventTrigger);
            this.deviceActionsOff = property.deviceActions.filter(e => e.eventTrigger === 'off');
            this.deviceActionsOn.forEach(e => {
                e.eventTrigger = 'on';
                if (!e.actoptions) e.actoptions = { variable: {}, params: [] };
            });
            this.deviceActionsOff.forEach(e => {
                e.eventTrigger = 'off';
                if (!e.actoptions) e.actoptions = { variable: {}, params: [] };
            });
        } else {
            this.deviceActionsOn = [];
            this.deviceActionsOff = [];
        }
        if (this.deviceActionsOn.length === 0) this.addActionOn();
        if (this.deviceActionsOff.length === 0) this.addActionOff();
    }

    addDevice(): void {
        this.deviceList.push({ variableId: '', name: `Device ${this.deviceList.length + 1}` });
        this.data.settings.property.devices = [...this.deviceList];
        this.onPropChanged.emit(this.data.settings);
    }

    removeDevice(index: number): void {
        if (this.deviceList.length > 1) {
            this.deviceList.splice(index, 1);
            this.data.settings.property.devices = [...this.deviceList];
            this.onPropChanged.emit(this.data.settings);
        }
    }

    onTagChanged(index: number, event: any): void {
        if (event && event.variableId) {
            this.deviceList[index].variableId = event.variableId;
            this.onPropChanged.emit(this.data.settings);
        }
    }

    onNoClick(): void {
        if (this.dialogRef) {
            this.dialogRef.close();
        }
    }

    onEditDevicePermission(index: number): void {
        const device = this.deviceList[index];
        let dialogRef = this.dialog.open(PermissionDialogComponent, {
            position: { top: '60px' },
            data: <PermissionData>{
                permission: device.permission,
                permissionRoles: device.permissionRoles
            }
        });
        dialogRef.afterClosed().subscribe((result: PermissionData) => {
            if (result) {
                device.permission = result.permission;
                device.permissionRoles = result.permissionRoles;
            }
        });
    }

    haveDevicePermission(device: SchedulerDevice): boolean {
        return !!(device.permission || device.permissionRoles?.show?.length || device.permissionRoles?.enabled?.length);
    }

    onEditMasterPermission(): void {
        const property = this.data.settings.property;
        let dialogRef = this.dialog.open(PermissionDialogComponent, {
            position: { top: '60px' },
            data: <PermissionData>{
                permission: property.permission,
                permissionRoles: property.permissionRoles
            }
        });
        dialogRef.afterClosed().subscribe((result: PermissionData) => {
            if (result) {
                property.permission = result.permission;
                property.permissionRoles = result.permissionRoles;
            }
        });
    }

    haveMasterPermission(): boolean {
        const property = this.data.settings.property;
        return !!(property.permission || property.permissionRoles?.show?.length || property.permissionRoles?.enabled?.length);
    }

    onOkClick(): void {
        this.data.settings.property.devices = [...this.deviceList];
        const validActionsOn = this.deviceActionsOn.filter(e => e.deviceName && e.action);
        const validActionsOff = this.deviceActionsOff.filter(e => e.deviceName && e.action);
        this.data.settings.property.deviceActions = [...validActionsOn, ...validActionsOff];
        this.onPropChanged.emit(this.data.settings);
        if (this.dialogRef) {
            this.dialogRef.close(this.data);
        }
    }

    addActionOn(): void {
        this.deviceActionsOn.push({
            deviceName: this.deviceList[0]?.name || '',
            action: '',
            actparam: '',
            actoptions: { variable: {}, params: [] },
            eventTrigger: 'on'
        });
    }

    addActionOff(): void {
        this.deviceActionsOff.push({
            deviceName: this.deviceList[0]?.name || '',
            action: '',
            actparam: '',
            actoptions: { variable: {}, params: [] },
            eventTrigger: 'off'
        });
    }

    removeActionOn(index: number): void {
        if (index > -1 && index < this.deviceActionsOn.length) {
            this.deviceActionsOn.splice(index, 1);
            this.onPropChanged.emit(this.data.settings);
        }
    }

    removeActionOff(index: number): void {
        if (index > -1 && index < this.deviceActionsOff.length) {
            this.deviceActionsOff.splice(index, 1);
            this.onPropChanged.emit(this.data.settings);
        }
    }

    withSetValue(action: string): boolean {
        return action === this.actionType.onSetValue;
    }

    withToggleValue(action: string): boolean {
        return action === this.actionType.onToggleValue;
    }

    isRunScript(action: string): boolean {
        return action === this.actionType.onRunScript;
    }

    onScriptChanged(value: any, action: SchedulerDeviceAction): void {
        action.actparam = value;
        this.onPropChanged.emit(this.data.settings);
    }

    setScriptParam(scriptParam: any, event: any): void {
        scriptParam.value = event;
        this.onPropChanged.emit(this.data.settings);
    }
}