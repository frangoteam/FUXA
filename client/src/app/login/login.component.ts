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
	loginForm: FormGroup;
	username: FormControl;
	password: FormControl;
	errorEnabled = false;

	constructor(private authService: AuthService,
		private projectService: ProjectService,
		private translateService: TranslateService,
		private dialogRef: MatDialogRef<LoginComponent>,
		@Inject(MAT_DIALOG_DATA) private data: any) { }

	ngOnInit() {
		this.username = new FormControl('', [Validators.required]);
		this.password = new FormControl('', [Validators.required]);
		this.loginForm = new FormGroup({
			username: this.username,
			password: this.password
		});
	}

	onNoClick(): void {
		this.dialogRef.close();
	}

	onOkClick(): void {
		this.errorEnabled = true;
		this.messageError = '';
		if (this.loginForm.valid) {
			this.signIn();
		}
	}

	signIn() {
		if (this.loginForm.valid) {
			this.submitLoading = true;
			this.authService.signIn(this.loginForm.value.username, this.loginForm.value.password).subscribe(result => {
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
}
