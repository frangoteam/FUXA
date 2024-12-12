import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';

import { PermissionData, PermissionDialogComponent } from '../permission-dialog/permission-dialog.component';
import { PermissionRoles } from '../../../_models/hmi';

@Component({
    selector: 'flex-auth',
    templateUrl: './flex-auth.component.html',
    styleUrls: ['./flex-auth.component.css']
})
export class FlexAuthComponent {

    @Input() name: string;
    @Input() permission: number;
    @Input() permissionRoles: PermissionRoles;


    constructor(public dialog: MatDialog,
                private cdr: ChangeDetectorRef) {

    }

    onEditPermission() {
        let permission = this.permission;
        let dialogRef = this.dialog.open(PermissionDialogComponent, {
            position: { top: '60px' },
            data: <PermissionData>{ permission: permission, permissionRoles: this.permissionRoles }
        });

        dialogRef.afterClosed().subscribe((result: PermissionData) => {
            if (result) {
                this.permission = result.permission;
                this.permissionRoles = result.permissionRoles;
            }
            this.cdr.detectChanges();
        });
    }

    getResult() {
        return { name: this.name, pemission: this.permission };
    }
}
