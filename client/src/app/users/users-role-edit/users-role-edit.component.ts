import { Component, OnInit, Inject, OnDestroy } from '@angular/core';
import { AbstractControl, UntypedFormBuilder, UntypedFormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { Role } from '../../_models/user';
import { UserService } from '../../_services/user.service';
import { Utils } from '../../_helpers/utils';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'app-users-role-edit',
    templateUrl: './users-role-edit.component.html',
    styleUrls: ['./users-role-edit.component.css']
})
export class UsersRoleEditComponent implements OnInit, OnDestroy {
    formGroup: UntypedFormGroup;

	roles: Role[] = [];
    private destroy$ = new Subject<void>();

    constructor(public dialogRef: MatDialogRef<UsersRoleEditComponent>,
        private fb: UntypedFormBuilder,
        @Inject(MAT_DIALOG_DATA) public data: Role,
        private userService: UserService) { }

    ngOnInit() {
        this.userService.getRoles().pipe(
            takeUntil(this.destroy$)
        ).subscribe(roles => this.roles = roles);
        this.formGroup = this.fb.group({
            id: this.data.id || Utils.getShortGUID('r_'),
            name: [this.data.name, [Validators.required, this.isValidRoleName()]],
            index: [this.data?.index],
            description: [this.data?.description]
        });
        this.formGroup.updateValueAndValidity();
    }

    ngOnDestroy() {
		this.destroy$.next(null);
        this.destroy$.complete();
	}

    onCancelClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.data.id = this.formGroup.controls.id.value;
        this.data.name = this.formGroup.controls.name.value;
        this.data.index = this.formGroup.controls.index.value;
        this.data.description = this.formGroup.controls.description.value || '';
        this.dialogRef.close(this.data);
    }

    isValidRoleName(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            if (control.value && this.isValid(control.value)) {
                return null;
            } else {
                return { UserNameNotValid: true };
            }
        };
    }

    isValid(roleName: string): boolean {
        if (roleName) {
            return this.roles.find(role => role.name === roleName && this.data?.name !== roleName) ? false : true;
        }
        return false;
    }
}
