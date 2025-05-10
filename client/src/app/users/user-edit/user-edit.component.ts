import { AfterViewInit, ChangeDetectorRef, Component, Inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Role, User, UserGroups } from '../../_models/user';
import { SelOptionType, SelOptionsComponent } from '../../gui-helpers/sel-options/sel-options.component';
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { AbstractControl, UntypedFormBuilder, UntypedFormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ProjectService } from '../../_services/project.service';
import { View } from '../../_models/hmi';
import { SettingsService } from '../../_services/settings.service';
import { UserService } from '../../_services/user.service';
import { Subject, map, takeUntil } from 'rxjs';
import { Languages } from '../../_models/language';

@Component({
    selector: 'app-user-edit',
    templateUrl: './user-edit.component.html',
    styleUrls: ['./user-edit.component.css']
})
export class UserEditComponent implements OnInit, AfterViewInit, OnDestroy {
    formGroup: UntypedFormGroup;
    selected = [];
    options = [];
    showPassword: boolean;
    views: View[];
    userInfo: UserInfo;
    languages: Languages;

    @ViewChild(SelOptionsComponent, { static: false }) seloptions: SelOptionsComponent;

    private destroy$ = new Subject<void>();

    constructor(public dialogRef: MatDialogRef<UserEditComponent>,
        private fb: UntypedFormBuilder,
        @Inject(MAT_DIALOG_DATA) public data: UserEditData,
        private projectService: ProjectService,
        private cdr: ChangeDetectorRef,
        private userService: UserService,
        private settingsService: SettingsService) {
    }

    ngOnInit() {
        this.views = this.projectService.getViews();
        this.languages = this.projectService.getLanguages();
        this.userInfo = new UserInfo(this.data.user?.info);
        this.formGroup = this.fb.group({
            username: [this.data.user?.username, [Validators.required, this.isValidUserName()]],
            fullname: [this.data.user?.fullname],
            password: [],
            start: [this.userInfo.start],
            languageId: [this.userInfo.languageId]
        });
        if (this.data.current?.username) {
            this.formGroup.get('username').disable();
        }
        this.formGroup.updateValueAndValidity();
    }

    ngAfterViewInit() {
        if (this.isRolePermission()) {
            this.userService.getRoles().pipe(
                map(roles => roles.sort((a, b) => a.index - b.index)),
                takeUntil(this.destroy$)
            ).subscribe((roles: Role[]) => {
                this.options = roles?.map(role => <SelOptionType>{ id: role.id, label: role.name });
                this.selected = this.options.filter(role => this.userInfo.roleIds?.includes(role.id));
            }, err => {
                console.error('get Roles err: ' + err);
            });
        } else {
            this.selected = UserGroups.ValueToGroups(this.data.user.groups);
            this.options = UserGroups.Groups;
        }
        this.cdr.detectChanges();
    }

    ngOnDestroy() {
		this.destroy$.next(null);
        this.destroy$.complete();
	}

    onCancelClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        let roles;
        if (this.seloptions) {
            if (this.isRolePermission()) {
                roles = this.seloptions.selected?.map(role => role.id);
            } else {
                this.data.user.groups = UserGroups.GroupsToValue(this.seloptions.selected);
            }
        }
        this.data.user.username = this.formGroup.controls.username.value;
        this.data.user.fullname = this.formGroup.controls.fullname.value || '';
        this.data.user.password = this.formGroup.controls.password.value;
        this.data.user.info = JSON.stringify({
            start: this.formGroup.controls.start.value || '',
            roles: roles,
            languageId: this.formGroup.controls.languageId.value
        });
        this.dialogRef.close(this.data.user);
    }

    isValidUserName(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            if (control.value && this.isValid(control.value)) {
                return null;
            } else {
                return { UserNameNotValid: true };
            }
        };
    }

    isValid(name): boolean {
        if (this.data.current?.username) {
            return true;
        } else if (name) {
            return this.data.users.find(uname => uname === name && uname !== this.data.user?.username) ? false : true;
        }
        return false;
    }

    isAdmin(): boolean {
        if (this.data.user && this.data.user.username === 'admin') {
            return true;
        } else {
            return false;
        }
    }

    keyDownStopPropagation(event) {
        event.stopPropagation();
    }

    isRolePermission() {
        return this.settingsService.getSettings()?.userRole;
    }
}

export interface UserEditData {
    user: User;
    current: User;
    users: string[];
}

export class UserInfo {
    start: string;
    roleIds: string[];
    languageId: string;

    constructor(info: string) {
        if (info) {
            const obj = JSON.parse(info);
            this.start = obj.start;
            this.roleIds = obj.roles;
            this.languageId = obj.languageId;
        }
    }
}
