import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

import { SettingsService } from '../../_services/settings.service';
import { TranslateService } from '@ngx-translate/core';

import { AppSettings } from '../../_models/settings';

@Component({
    selector: 'app-app-settings',
    templateUrl: './app-settings.component.html',
    styleUrls: ['./app-settings.component.css']
})
export class AppSettingsComponent implements OnInit {

    languageType = [ { text: 'dlg.app-language-en', value: 'en' }, { text: 'dlg.app-language-ru', value: 'ru' } ];
    authType = [ { text: 'dlg.app-auth-disabled', value: '' }, { text: 'dlg.app-auth-expiration-15m', value: '15m' }, 
                        { text: 'dlg.app-auth-expiration-1h', value: '1h' }, { text: 'dlg.app-auth-expiration-3h', value: '3h' },
                        { text: 'dlg.app-auth-expiration-1d', value: '1d' }];
    settings = new AppSettings();
    authentication = '';
    authenticationTooltip = '';

    constructor(private settingsService: SettingsService,
        private translateService: TranslateService,
        public dialogRef: MatDialogRef<AppSettingsComponent>) { }

    ngOnInit() {
        this.settings = JSON.parse(JSON.stringify(this.settingsService.getSettings()));
        for (let i = 0; i < this.languageType.length; i++) {
            this.translateService.get(this.languageType[i].text).subscribe((txt: string) => { this.languageType[i].text = txt });
        }
        for (let i = 0; i < this.authType.length; i++) {
            this.translateService.get(this.authType[i].text).subscribe((txt: string) => { this.authType[i].text = txt });
        }
        this.translateService.get('dlg.app-auth-tooltip').subscribe((txt: string) => { this.authenticationTooltip = txt });

        if (this.settings.secureEnabled) {
            this.authentication = this.settings.tokenExpiresIn;
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
}
