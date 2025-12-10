import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { PermissionData, PermissionDialogComponent } from '../../../gauge-property/permission-dialog/permission-dialog.component';
import { GaugeEventActionType, GaugeSchedulerProperty, SchedulerDevice, SchedulerDeviceAction, View } from '../../../../_models/hmi';
import { Script } from '../../../../_models/script';
import { ProjectService } from '../../../../_services/project.service';
import { TranslateService } from '@ngx-translate/core';
import { FlexAuthValues } from '../../../gauge-property/flex-auth/flex-auth.component';

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
    property: GaugeSchedulerProperty;

    constructor(
        private dialog?: MatDialog,
        private projectService?: ProjectService,
        private translateService?: TranslateService
    ) {
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
        if (!this.data.settings.name) {
            this.data.settings.name = 'scheduler_1';
        }
        this.property = <GaugeSchedulerProperty>(this.data.settings.property || {});
        this.property.accentColor ??= '#556e82';
        this.property.backgroundColor ??= '#f0f0f0';
        this.property.textColor ??= '#505050';
        this.property.secondaryTextColor ??= '#ffffff';
        this.property.borderColor ??= '#cccccc';
        this.property.hoverColor ??= '#f5f5f5';
        this.property.timeFormat ??= '12hr';
        if (this.property.devices && Array.isArray(this.property.devices) && this.property.devices.length > 0) {
            this.deviceList = [...this.property.devices];
        } else {
            this.deviceList = [{ variableId: '', name: 'Device 1' }];
            this.property.devices = [...this.deviceList];
        }
        if (this.property.deviceActions && Array.isArray(this.property.deviceActions)) {
            this.deviceActionsOn = this.property.deviceActions.filter(e => e.eventTrigger === 'on' || !e.eventTrigger);
            this.deviceActionsOff = this.property.deviceActions.filter(e => e.eventTrigger === 'off');
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

    onFlexAuthChanged(flexAuth: FlexAuthValues) {
        this.data.settings.name = flexAuth.name;
        this.property.permission = flexAuth.permission;
        this.property.permissionRoles = flexAuth.permissionRoles;
        this.onPropertyChanged();
    }

    onTagChanged(index: number, event: any): void {
        if (event && event.variableId) {
            this.deviceList[index].variableId = event.variableId;
            this.onPropChanged.emit(this.data.settings);
        }
    }

    onEditDevicePermission(index: number): void {
        const device = this.deviceList[index];
        let dialog = this.dialog.open(PermissionDialogComponent, {
            position: { top: '60px' },
            data: <PermissionData>{
                permission: device.permission,
                permissionRoles: device.permissionRoles
            }
        });
        dialog.afterClosed().subscribe((result: PermissionData) => {
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
        let dialog = this.dialog.open(PermissionDialogComponent, {
            position: { top: '60px' },
            data: <PermissionData>{
                permission: property.permission,
                permissionRoles: property.permissionRoles
            }
        });
        dialog.afterClosed().subscribe((result: PermissionData) => {
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

    onPropertyChanged(): void {
        this.data.settings.property = this.property;
        this.data.settings.property.devices = [...this.deviceList];
        const validActionsOn = this.deviceActionsOn.filter(e => e.deviceName && e.action);
        const validActionsOff = this.deviceActionsOff.filter(e => e.deviceName && e.action);
        this.data.settings.property.deviceActions = [...validActionsOn, ...validActionsOff];
        this.onPropChanged.emit(this.data.settings);
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
