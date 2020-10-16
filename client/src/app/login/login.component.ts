import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

import { AuthService } from '../_services/auth.service';
import { ProjectService } from '../_services/project.service';
import { TranslateService } from '@ngx-translate/core';

@Component({
	selector: 'app-login',
	templateUrl: './login.component.html',
	styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

	loading = false;
	showPassword = false;
	submitLoading = false;
	messageError: string;
	username: FormControl = new FormControl();
	password: FormControl = new FormControl();
	errorEnabled = false;

	constructor(private authService: AuthService,
		private projectService: ProjectService,
		private translateService: TranslateService,
		private dialogRef: MatDialogRef<LoginComponent>,
		@Inject(MAT_DIALOG_DATA) private data: any) { }

	ngOnInit() {
	}

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
			// 		this.router.navigate([this.returnUrl]);
			this.submitLoading = false;
			this.dialogRef.close(this.data.user);
			this.projectService.reload();
		}, error => {
			this.submitLoading = false;
			this.translateService.get('msg.signin-failed').subscribe((txt: string) => this.messageError = txt);
		});
	}
}
