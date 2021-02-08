import { Injectable } from '@angular/core';

import { TranslateService } from '@ngx-translate/core';

import { AppSettings } from '../_models/settings';

@Injectable({
    providedIn: 'root'
})
export class SettingsService {

    private appSettings = new AppSettings();

    constructor(private fuxaLanguage: TranslateService) { 
    }
    
    init() {
        // this language will be used as a fallback when a translation isn't found in the current language
		this.fuxaLanguage.setDefaultLang('en');
		// the lang to use, if the lang isn't available, it will use the current loader to get them
		this.fuxaLanguage.use('en');        
        // to load saved settings
        this.setLanguage(this.appSettings.language);
    }

    getSettings() {
        return this.appSettings;
    }

    setLanguage(language) {
		this.fuxaLanguage.use(language);
    }
}
