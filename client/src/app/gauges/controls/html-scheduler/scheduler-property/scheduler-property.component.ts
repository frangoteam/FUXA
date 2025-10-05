import { Component, Inject, OnInit } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { PermissionData, PermissionDialogComponent } from '../../../gauge-property/permission-dialog/permission-dialog.component';
import { GaugeEventActionType, View } from '../../../../_models/hmi';
import { Script } from '../../../../_models/script';
import { Utils } from '../../../../_helpers/utils';
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
    eventTrigger?: 'on' | 'off'; // Trigger when device turns ON or OFF
}

@Component({
    selector: 'app-scheduler-property', 
    templateUrl: './scheduler-property.component.html',
    styleUrls: ['./scheduler-property.component.scss']
})
export class SchedulerPropertyComponent implements OnInit {
    deviceList: SchedulerDevice[] = [];
    deviceActionsOn: SchedulerDeviceAction[] = [];  // Actions triggered when device turns ON
    deviceActionsOff: SchedulerDeviceAction[] = []; // Actions triggered when device turns OFF
    views: View[] = [];
    scripts: Script[] = [];
    inputs: any[] = []; // HTML input gauges for SetInput action
    actionType = GaugeEventActionType;
    actionTypeKeys: any = {};

    constructor(
        public dialogRef: MatDialogRef<SchedulerPropertyComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any,
        private dialog: MatDialog,
        private projectService: ProjectService,
        private translateService: TranslateService
    ) { }

    ngOnInit(): void {
        // Load views and scripts from project
        this.views = this.projectService.getViews();
        this.scripts = this.projectService.getScripts();
        
        // Only include SERVER-SIDE actions for scheduler (no page navigation, dialogs, etc.)
        const serverSideActions = {
            onSetValue: this.actionType.onSetValue,
            onToggleValue: this.actionType.onToggleValue,
            onRunScript: this.actionType.onRunScript
        };
        
        // Translate only server-side action types
        Object.keys(serverSideActions).forEach(key => {
            this.translateService.get(serverSideActions[key]).subscribe((txt: string) => {
                this.actionTypeKeys[key] = txt;
            });
        });
        
        // Initialize property 
        if (!this.data.settings) {
            this.data.settings = {};
        }
        if (!this.data.settings.property) {
            this.data.settings.property = {};
        }
        if (!this.data.settings.name) {
            this.data.settings.name = 'scheduler_1';
        }
        
        // Get reference to the property object
        const property = this.data.settings.property;
        
        // Set default colors
        if (!property.accentColor) {
            property.accentColor = '#556e82'; // RGB(85,110,130) - Theme
        }
        if (!property.backgroundColor) {
            property.backgroundColor = '#f0f0f0'; // RGB(240,240,240) - Background
        }
        if (!property.textColor) {
            property.textColor = '#505050'; // RGB(80,80,80) - Primary Text
        }
        if (!property.secondaryTextColor) {
            property.secondaryTextColor = '#ffffff'; // RGB(255,255,255) - Secondary Text
        }
        if (!property.borderColor) {
            property.borderColor = '#cccccc'; // RGB(204,204,204) - Border
        }
        if (!property.hoverColor) {
            property.hoverColor = '#f5f5f5';
        }
        
        // Set default time format
        if (!property.timeFormat) {
            property.timeFormat = '12hr'; // Default to 12-hour format
        }
        
        // Initialize device list
        if (property.devices && Array.isArray(property.devices) && property.devices.length > 0) {
            this.deviceList = [...property.devices];
        } else {
            this.deviceList = [{
                variableId: '',
                name: 'Device 1'
            }];
            property.devices = [...this.deviceList];
        }
        
        // Initialize device actions - split into ON and OFF actions
        if (property.deviceActions && Array.isArray(property.deviceActions)) {
            // Separate actions by trigger type
            this.deviceActionsOn = property.deviceActions.filter(e => e.eventTrigger === 'on' || !e.eventTrigger);
            this.deviceActionsOff = property.deviceActions.filter(e => e.eventTrigger === 'off');
            
            // Set default trigger and ensure actoptions exists
            this.deviceActionsOn.forEach(e => {
                e.eventTrigger = 'on';
                if (!e.actoptions) {
                    e.actoptions = { variable: {}, params: [] };
                }
            });
            this.deviceActionsOff.forEach(e => {
                e.eventTrigger = 'off';
                if (!e.actoptions) {
                    e.actoptions = { variable: {}, params: [] };
                }
            });
        } else {
            this.deviceActionsOn = [];
            this.deviceActionsOff = [];
        }
        
        // Auto-add blank actions if none exist (like flex-event)
        if (this.deviceActionsOn.length === 0) {
            this.addActionOn();
        }
        if (this.deviceActionsOff.length === 0) {
            this.addActionOff();
        }
    }

    addDevice(): void {
        this.deviceList.push({
            variableId: '',
            name: `Device ${this.deviceList.length + 1}`
        });
        this.data.settings.property.devices = [...this.deviceList];
    }

    removeDevice(index: number): void {
        if (this.deviceList.length > 1) {
            this.deviceList.splice(index, 1);
            this.data.settings.property.devices = [...this.deviceList];
        }
    }

    onTagChanged(index: number, event: any): void {
        if (event && event.variableId) {
            this.deviceList[index].variableId = event.variableId;
        }
    }

    onNoClick(): void {
        this.dialogRef.close();
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
        
        // Filter out incomplete actions (no device or no action selected)
        const validActionsOn = this.deviceActionsOn.filter(e => e.deviceName && e.action);
        const validActionsOff = this.deviceActionsOff.filter(e => e.deviceName && e.action);
        
        // Merge ON and OFF actions into single array
        this.data.settings.property.deviceActions = [...validActionsOn, ...validActionsOff];
        
        console.log('[SCHEDULER PROPERTY] Saving device actions:', this.data.settings.property.deviceActions);
        this.dialogRef.close(this.data);
    }
    
    // Action Management Methods
    addActionOn(): void {
        this.deviceActionsOn.push({
            deviceName: this.deviceList[0]?.name || '',
            action: '',
            actparam: '',
            eventTrigger: 'on',
            actoptions: {
                variable: {},
                params: []
            }
        });
    }
    
    addActionOff(): void {
        this.deviceActionsOff.push({
            deviceName: this.deviceList[0]?.name || '',
            action: '',
            actparam: '',
            eventTrigger: 'off',
            actoptions: {
                variable: {},
                params: []
            }
        });
    }
    
    removeActionOn(index: number): void {
        this.deviceActionsOn.splice(index, 1);
    }
    
    removeActionOff(index: number): void {
        this.deviceActionsOff.splice(index, 1);
    }
    
    // Server-side action type checkers
    isRunScript(action: string): boolean {
        return action === Utils.getEnumKey(GaugeEventActionType, GaugeEventActionType.onRunScript);
    }
    
    withSetValue(action: string): boolean {
        return action === Utils.getEnumKey(GaugeEventActionType, GaugeEventActionType.onSetValue);
    }
    
    withToggleValue(action: string): boolean {
        return action === Utils.getEnumKey(GaugeEventActionType, GaugeEventActionType.onToggleValue);
    }
    
    onScriptChanged(scriptId: string, event: any) {
        if (event && this.scripts) {
            const script = this.scripts.find(s => s.id === scriptId);
            if (!event.actoptions) {
                event.actoptions = {};
            }
            event.actoptions['params'] = [];
            if (script && script.parameters) {
                event.actoptions['params'] = JSON.parse(JSON.stringify(script.parameters));
            }
        }
    }
    
    setScriptParam(param: any, variableId: string) {
        param.value = variableId;
    }
}