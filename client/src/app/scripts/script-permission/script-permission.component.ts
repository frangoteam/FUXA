import { ChangeDetectorRef, Component, Inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { SelOptionType, SelOptionsComponent } from '../../gui-helpers/sel-options/sel-options.component';
import { Role, UserGroups } from '../../_models/user';
import { SettingsService } from '../../_services/settings.service';
import { UserService } from '../../_services/user.service';
import { Subject, map, takeUntil } from 'rxjs';
import { UserInfo } from '../../users/user-edit/user-edit.component';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';

@Component({
  selector: 'app-script-permission',
  templateUrl: './script-permission.component.html',
  styleUrls: ['./script-permission.component.css']
})
export class ScriptPermissionComponent implements OnInit, OnDestroy {

    userInfo: UserInfo;
    selected = [];
    options = [];
	@ViewChild(SelOptionsComponent, {static: false}) seloptions: SelOptionsComponent;
    private destroy$ = new Subject<void>();

	constructor(public dialogRef: MatDialogRef<ScriptPermissionComponent>,
		@Inject(MAT_DIALOG_DATA) public data: ScriptPermissionData,
        private cdr: ChangeDetectorRef,
        private userService: UserService,
		private settingsService: SettingsService) {
	}

	ngOnInit() {
        if (this.isRolePermission()) {
            this.userService.getRoles().pipe(
                map(roles => roles.sort((a, b) => a.index - b.index)),
                takeUntil(this.destroy$)
            ).subscribe((roles: Role[]) => {
                this.options = roles?.map(role => <SelOptionType>{ id: role.id, label: role.name });
                this.selected = this.options.filter(role => this.data.permissionRoles?.enabled?.includes(role.id));
            }, err => {
                console.error('get Roles err: ' + err);
            });
        } else {
            this.selected = UserGroups.ValueToGroups(this.data.permission);
            this.options = UserGroups.Groups;
        }
        this.cdr.detectChanges();
    }

	ngOnDestroy() {
		this.destroy$.next(null);
        this.destroy$.complete();
	}

  	onNoClick(): void {
		this.dialogRef.close();
	}

	onOkClick(): void {
		let result = <ScriptPermissionData>{
			permission: null,
			permissionRoles: { enabled: null }
		};
        if (this.seloptions) {
            if (this.isRolePermission()) {
                result.permissionRoles.enabled = this.seloptions.selected?.map(role => role.id);
            } else {
                result.permission = UserGroups.GroupsToValue(this.seloptions.selected);
            }
        }
		this.dialogRef.close(result);
	}

	isRolePermission() {
        return this.settingsService.getSettings()?.userRole;
    }
}

export interface ScriptPermissionData {
	permission: number;
	permissionRoles: {
        enabled: string[];
    };
}
