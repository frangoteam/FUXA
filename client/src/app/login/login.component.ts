import { Component, Inject } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { AuthService } from '../_services/auth.service';
import { ProjectService } from '../_services/project.service';
import { TranslateService } from '@ngx-translate/core';

@Component({
	selector: 'app-login',
	templateUrl: './login.component.html',
	styleUrls: ['./login.component.css']
})
export class LoginComponent {

	loading = false;
	showPassword = false;
	submitLoading = false;
	messageError: string;
	username: UntypedFormControl = new UntypedFormControl();
	password: UntypedFormControl = new UntypedFormControl();
	errorEnabled = false;

	constructor(private authService: AuthService,
		private projectService: ProjectService,
		private translateService: TranslateService,
		private dialogRef: MatDialogRef<LoginComponent>,
		@Inject(MAT_DIALOG_DATA) private data: any) { }

	onNoClick(): void {
		this.dialogRef.close();
	}

	onOkClick(): void {
		this.errorEnabled = true;
		this.messageError = '';
		this.signIn();
	}

	isValidate() {
		if (this.username.value && this.password.value) {
			return true;
		}
		return false;
	}

	signIn() {
		this.submitLoading = true;
		this.authService.signIn(this.username.value, this.password.value).subscribe(result => {
			this.submitLoading = false;
			this.dialogRef.close(true);
			this.projectService.reload();
		}, error => {
			this.submitLoading = false;
			this.translateService.get('msg.signin-failed').subscribe((txt: string) => this.messageError = txt);
		});
	}

    keyDownStopPropagation(event) {
        event.stopPropagation();
    }
}
