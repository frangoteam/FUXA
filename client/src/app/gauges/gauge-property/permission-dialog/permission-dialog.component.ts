import { AfterViewInit, ChangeDetectorRef, Component, Inject, OnDestroy, ViewChild } from '@angular/core';
import { Role, UserGroups } from '../../../_models/user';
import { SelOptionType, SelOptionsComponent } from '../../../gui-helpers/sel-options/sel-options.component';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { SettingsService } from '../../../_services/settings.service';
import { UserService } from '../../../_services/user.service';
import { Subject, map, takeUntil } from 'rxjs';

@Component({
    selector: 'app-permission-dialog',
    templateUrl: './permission-dialog.component.html',
    styleUrls: ['./permission-dialog.component.scss']
})
export class PermissionDialogComponent implements AfterViewInit, OnDestroy {
    selected = [];
    extension = [];
    options = [];
    private destroy$ = new Subject<void>();

    @ViewChild(SelOptionsComponent, { static: false }) seloptions: SelOptionsComponent;

    constructor(
        public dialogRef: MatDialogRef<PermissionDialogComponent>,
        private userService: UserService,
        private cdr: ChangeDetectorRef,
        private settingsService: SettingsService,
        @Inject(MAT_DIALOG_DATA) public data: PermissionData) {
    }

    ngAfterViewInit() {
        if (this.isRolePermission()) {
            this.userService.getRoles().pipe(
                map(roles => roles.sort((a, b) => a.index - b.index)),
                takeUntil(this.destroy$)
            ).subscribe((roles: Role[]) => {
                this.options = roles?.map(role => <SelOptionType>{ id: role.id, label: role.name });
                this.selected = this.options.filter(role => this.data.permissionRoles?.enabled?.includes(role.id));
                this.extension = this.data.mode ? null : this.options.filter(role => this.data.permissionRoles?.show?.includes(role.id));
            }, err => {
                console.error('get Roles err: ' + err);
            });
        } else {
            this.selected = UserGroups.ValueToGroups(this.data.permission);
            this.extension = this.data.mode ? null : UserGroups.ValueToGroups(this.data.permission, true);
            this.options = UserGroups.Groups;
        }
        this.cdr.detectChanges();
    }

    ngOnDestroy() {
		this.destroy$.next(null);
        this.destroy$.complete();
	}

    isRolePermission() {
        return this.settingsService.getSettings()?.userRole;
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        if (this.isRolePermission()) {
            if (!this.data.permissionRoles) {
                this.data.permissionRoles = { show: null, enabled: null };
            }
            this.data.permissionRoles.enabled = this.seloptions.selected?.map(role => role.id);
            if (this.data.mode === 'onlyShow') {
                this.data.permissionRoles.show = this.seloptions.selected?.map(role => role.id);
            } else {
                this.data.permissionRoles.show = this.seloptions.extSelected?.map(role => role.id);
            }

        } else {
            this.data.permission = UserGroups.GroupsToValue(this.seloptions.selected);
            if (this.data.mode === 'onlyShow') {
                this.data.permission += UserGroups.GroupsToValue(this.seloptions.selected, true);
            } else {
                this.data.permission += UserGroups.GroupsToValue(this.seloptions.extSelected, true);
            }
        }
        this.dialogRef.close(this.data);
    }
}

export interface PermissionData {
    permission: number;
    permissionRoles: {
        show: string[];
        enabled: string[];
    };
    mode?: PermissionMode;
}

export type PermissionMode = 'onlyShow' | 'onlyEnable';
