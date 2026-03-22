import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { AppSettings } from '../../_models/settings';
import { SettingsService } from '../../_services/settings.service';
import { UserService } from '../../_services/user.service';
import { User } from '../../_models/user';

@Component({
    selector: 'app-onboarding-wizard',
    templateUrl: './onboarding-wizard.component.html',
    styleUrls: ['./onboarding-wizard.component.scss']
})
export class OnboardingWizardComponent implements OnInit {

    authType = [
        { text: 'dlg.app-auth-disabled', value: '' },
        { text: 'dlg.app-auth-expiration-15m', value: '15m' },
        { text: 'dlg.app-auth-expiration-1h', value: '1h' },
        { text: 'dlg.app-auth-expiration-3h', value: '3h' },
        { text: 'dlg.app-auth-expiration-1d', value: '1d' }
    ];

    formGroup: UntypedFormGroup;
    authenticationTooltip = '';
    showSecretCode = false;
    showAdminPassword = false;
    isSaving = false;

    constructor(
        public dialogRef: MatDialogRef<OnboardingWizardComponent>,
        private fb: UntypedFormBuilder,
        private settingsService: SettingsService,
        private userService: UserService,
        private translateService: TranslateService,
        private toastr: ToastrService
    ) { }

    ngOnInit() {
        const settings = this.settingsService.getSettings();
        this.authType = this.authType.map(auth => ({
            ...auth,
            text: this.translateService.instant(auth.text)
        }));
        this.translateService.get('dlg.app-auth-tooltip').subscribe((txt: string) => {
            this.authenticationTooltip = txt;
        });
        this.formGroup = this.fb.group({
            hideEditorOnboarding: [settings?.hideEditorOnboarding ?? false],
            authentication: [settings?.secureEnabled ? settings.tokenExpiresIn : ''],
            secretCode: [settings?.secretCode ?? ''],
            adminPassword: ['']
        });
    }

    onNoClick(): void {
        this.closeDialog(false);
    }

    onOkClick(): void {
        const authentication = this.formGroup?.get('authentication')?.value;
        const secretCode = this.formGroup?.get('secretCode')?.value;
        const adminPassword = this.formGroup?.get('adminPassword')?.value;
        if (authentication && !secretCode?.trim()) {
            this.notifyError(this.translateService.instant('msg.secret-code-required'));
            return;
        }
        if (authentication && !adminPassword?.trim()) {
            this.notifyError(this.translateService.instant('editor.onboarding-wizard-admin-password-required'));
            return;
        }
        this.closeDialog(true);
    }

    private closeDialog(saveOnClose: boolean): void {
        const authentication = this.formGroup?.get('authentication')?.value;
        const hideEditorOnboarding = !!this.formGroup?.get('hideEditorOnboarding')?.value;
        if (!saveOnClose) {
            if (hideEditorOnboarding) {
                this.saveHidePreferenceOnly(hideEditorOnboarding);
            }
            this.dialogRef.close();
            return;
        }

        this.isSaving = true;
        const adminPassword = this.formGroup?.get('adminPassword')?.value;
        this.saveAdminPassword(adminPassword, () => {
            this.saveSettings(authentication, hideEditorOnboarding || !!authentication);
            this.isSaving = false;
            this.dialogRef.close();
        }, () => {
            this.isSaving = false;
        });
    }

    private saveHidePreferenceOnly(hideEditorOnboarding: boolean): void {
        const settings = new AppSettings();
        Object.assign(settings, this.settingsService.getSettings(), { hideEditorOnboarding });
        if (this.settingsService.setSettings(settings)) {
            this.settingsService.saveSettings();
        }
    }

    private saveSettings(authentication: string, hideEditorOnboarding: boolean): void {
        const settings = new AppSettings();
        const secretCode = this.formGroup?.get('secretCode')?.value?.trim();
        Object.assign(settings, this.settingsService.getSettings(), {
            hideEditorOnboarding,
            secureEnabled: !!authentication,
            tokenExpiresIn: authentication || this.settingsService.getSettings()?.tokenExpiresIn,
            secretCode: secretCode || this.settingsService.getSettings()?.secretCode
        });

        if (this.settingsService.setSettings(settings)) {
            this.settingsService.saveSettings();
        }
    }

    private saveAdminPassword(adminPassword: string, onSuccess: () => void, onError: () => void): void {
        this.userService.getUsers({ username: 'admin' }).subscribe((users: User[]) => {
            const adminUser = users?.length ? users[0] : <User>{
                username: 'admin',
                fullname: 'Administrator Account',
                groups: -1,
                info: '{}'
            };
            adminUser.password = adminPassword;
            this.userService.setUser(adminUser).subscribe(() => {
                onSuccess();
            }, () => {
                onError();
            });
        }, () => {
            onError();
        });
    }

    private notifyError(error: string) {
        this.toastr.error(error, '', {
            timeOut: 3000,
            closeButton: true
        });
    }
}
