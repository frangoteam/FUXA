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
    settings = new AppSettings();

    constructor(private settingsService: SettingsService,
        private translateService: TranslateService,
        public dialogRef: MatDialogRef<AppSettingsComponent>) { }

    ngOnInit() {
        this.settings = this.settingsService.getSettings();
        for (let i = 0; i < this.languageType.length; i++) {
            this.translateService.get(this.languageType[i].text).subscribe((txt: string) => { this.languageType[i].text = txt });
        }
    }

    onNoClick() {
        this.dialogRef.close();
    }

    onOkClick() {
        this.settingsService.setLanguage(this.settings.language);
        this.dialogRef.close();
    }

    onLanguageChange(language) {
        this.settings.language = language;
    }
}
