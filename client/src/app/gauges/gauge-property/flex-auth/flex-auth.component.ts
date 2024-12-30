import { ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';

import { PermissionData, PermissionDialogComponent, PermissionMode } from '../permission-dialog/permission-dialog.component';
import { PermissionRoles } from '../../../_models/hmi';
import { SettingsService } from '../../../_services/settings.service';

@Component({
    selector: 'flex-auth',
    templateUrl: './flex-auth.component.html',
    styleUrls: ['./flex-auth.component.css']
})
export class FlexAuthComponent {

    @Input() name: string;
    @Input() permission: number;
    @Input() permissionRoles: PermissionRoles;
    @Input() permissionMode: PermissionMode;
    @Output() onChanged: EventEmitter<FlexAuthValues> = new EventEmitter();


    constructor(public dialog: MatDialog,
        private settingsService: SettingsService,
        private cdr: ChangeDetectorRef) {

    }

    onEditPermission() {
        let permission = this.permission;
        let dialogRef = this.dialog.open(PermissionDialogComponent, {
            position: { top: '60px' },
            data: <PermissionData>{
                permission: permission,
                permissionRoles: this.permissionRoles,
                mode: this.permissionMode
            }
        });

        dialogRef.afterClosed().subscribe((result: PermissionData) => {
            if (result) {
                this.permission = result.permission;
                this.permissionRoles = result.permissionRoles;
                this.onEmitValues();
            }
            this.cdr.detectChanges();
        });
    }

    getResult(): FlexAuthValues {
        return {
            name: this.name,
            permission: this.permission,
            permissionRoles: this.permissionRoles
        };
    }

    onEmitValues() {
        this.onChanged.emit(this.getResult());
    }


    isRolePermission() {
        return this.settingsService.getSettings()?.userRole;
    }

    havePermission() {
        if (this.isRolePermission()) {
            return this.permissionRoles?.show?.length || this.permissionRoles?.enabled?.length;
        } else {
            return this.permission;
        }
    }
}

export interface FlexAuthValues {
    name: string;
    permission?: number;
    permissionRoles?: {
        show: string[];
        enabled: string[];
    };
}
