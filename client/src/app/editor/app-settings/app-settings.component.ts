import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

import { SettingsService } from '../../_services/settings.service';
import { DiagnoseService } from '../../_services/diagnose.service';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';

import { AlarmsRetentionType, AppSettings, DaqStore, DaqStoreRetentionType, DaqStoreType, MailMessage, SmtpSettings, StoreCredentials } from '../../_models/settings';
import { Utils } from '../../_helpers/utils';

@Component({
    selector: 'app-app-settings',
    templateUrl: './app-settings.component.html',
    styleUrls: ['./app-settings.component.css']
})
export class AppSettingsComponent implements OnInit {

    languageType = [ { text: 'dlg.app-language-en', value: 'en' }, { text: 'dlg.app-language-ru', value: 'ru' },
                     { text: 'dlg.app-language-ua', value: 'ua' }, { text: 'dlg.app-language-zh-cn', value: 'zh-cn' },
                     { text: 'dlg.app-language-pt', value: 'pt' }, { text: 'dlg.app-language-tr', value: 'tr' },
                     { text: 'dlg.app-language-ko', value: 'ko' }, { text: 'dlg.app-language-es', value: 'es' },
                     { text: 'dlg.app-language-fr', value: 'fr' }, { text: 'dlg.app-language-de', value: 'de' },];
    authType = [ { text: 'dlg.app-auth-disabled', value: '' }, { text: 'dlg.app-auth-expiration-15m', value: '15m' },
                        { text: 'dlg.app-auth-expiration-1h', value: '1h' }, { text: 'dlg.app-auth-expiration-3h', value: '3h' },
                        { text: 'dlg.app-auth-expiration-1d', value: '1d' }];
    settings = new AppSettings();
    authentication = '';
    authenticationTooltip = '';
    smtpTesting = false;
    smtpTestAddress = '';
    showPassword = false;

    daqstoreType = DaqStoreType;
    retationType = DaqStoreRetentionType;
    alarmsRetationType = AlarmsRetentionType;
    influxDB18 = Utils.getEnumKey(DaqStoreType, DaqStoreType.influxDB18);

    constructor(private settingsService: SettingsService,
        private diagnoseService: DiagnoseService,
        private translateService: TranslateService,
        private toastr: ToastrService,
        public dialogRef: MatDialogRef<AppSettingsComponent>) { }

    ngOnInit() {
        this.settings = JSON.parse(JSON.stringify(this.settingsService.getSettings()));
        for (let i = 0; i < this.languageType.length; i++) {
            this.translateService.get(this.languageType[i].text).subscribe((txt: string) => { this.languageType[i].text = txt; });
        }
        for (let i = 0; i < this.authType.length; i++) {
            this.translateService.get(this.authType[i].text).subscribe((txt: string) => { this.authType[i].text = txt; });
        }
        this.translateService.get('dlg.app-auth-tooltip').subscribe((txt: string) => { this.authenticationTooltip = txt; });

        if (this.settings.secureEnabled) {
            this.authentication = this.settings.tokenExpiresIn;
        }
        if (Utils.isNullOrUndefined(this.settings.broadcastAll)) {
            this.settings.broadcastAll = true;
        }
        if (Utils.isNullOrUndefined(this.settings.logFull)) {
            this.settings.logFull = false;
        }
        if (!this.settings.smtp) {
            this.settings.smtp = new SmtpSettings();
        }
        this.settings.daqstore = this.settings.daqstore || new DaqStore();
        if (!this.settings.daqstore.credentials) {
            this.settings.daqstore.credentials = new StoreCredentials();
        }
    }

    onNoClick() {
        this.dialogRef.close();
    }

    onOkClick() {
        this.settings.secureEnabled = (this.authentication) ? true : false;
        this.settings.tokenExpiresIn = this.authentication;
        if (this.settingsService.setSettings(this.settings)) {
            this.settingsService.saveSettings();
        }
        this.dialogRef.close();
    }

    onLanguageChange(language) {
        this.settings.language = language;
    }

    onAlarmsClear() {
        this.settingsService.clearAlarms(true);
    }

    onSmtpTest() {
        this.smtpTesting = true;
        let msg = <MailMessage>{ from: this.settings.smtp.mailsender || this.settings.smtp.username, to: this.smtpTestAddress, subject: 'FUXA', text: 'TEST' };
        this.diagnoseService.sendMail(msg, this.settings.smtp).subscribe(() => {
            this.smtpTesting = false;
            var msg = '';
            this.translateService.get('msg.sendmail-success').subscribe((txt: string) => { msg = txt; });
            this.toastr.success(msg);
        }, error => {
            this.smtpTesting = false;
            if (error.message) {
                this.notifyError(error.message);
            } else {
                var msg = '';
                this.translateService.get('msg.sendmail-error').subscribe((txt: string) => { msg = txt; });
                this.notifyError(msg);
            }
        });
    }

    isSmtpTestReady() {
        if (this.smtpTesting) {
            return false;
        }
        if (!this.settings.smtp.host || !this.settings.smtp.host.length) {
            return false;
        }
        if (!this.settings.smtp.username || !this.settings.smtp.username.length) {
            return false;
        }
        if (!this.smtpTestAddress || !this.smtpTestAddress.length) {
            return false;
        }
        return true;
    }

    keyDownStopPropagation(event) {
        event.stopPropagation();
    }

    private notifyError(error: string) {
        this.toastr.error(error, '', {
            timeOut: 3000,
            closeButton: true
            // disableTimeOut: true
        });
    }
}
