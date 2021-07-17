import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import { environment } from '../../environments/environment';
import { TranslateService } from '@ngx-translate/core';
import { EndPointApi } from '../_helpers/endpointapi';
import { ToastrService } from 'ngx-toastr';
import { AppSettings } from '../_models/settings';

@Injectable({
    providedIn: 'root'
})
export class SettingsService {

    private appSettings = new AppSettings();
    private endPointConfig: string = EndPointApi.getURL();

    private editModeLocked = false;

    constructor(private http: HttpClient,
        private fuxaLanguage: TranslateService,
        private translateService: TranslateService,
        private toastr: ToastrService) { 
    }
    
    init() {
        // this language will be used as a fallback when a translation isn't found in the current language
		this.fuxaLanguage.setDefaultLang('en');
		// the lang to use, if the lang isn't available, it will use the current loader to get them
		this.fuxaLanguage.use('en');        
        // to load saved settings
        if (environment.serverEnabled) {
            this.http.get<any>(this.endPointConfig + '/api/settings').subscribe(result => {
                this.setSettings(result);
            }, error => {
                console.error('settings.service err: ' + error);
            });
        }
        // this.setLanguage(this.appSettings.language);
    }

    getSettings() {
        return this.appSettings;
    }

    setSettings(settings: AppSettings) {
        var dirty = false;
        if (settings.language && settings.language != this.appSettings.language) {
            this.fuxaLanguage.use(settings.language);
            this.appSettings.language = settings.language;
            dirty = true;
        }
        if (settings.uiPort && settings.uiPort != this.appSettings.uiPort) {
            this.appSettings.uiPort = settings.uiPort;
            dirty = true;
        }
        if (settings.secureEnabled != this.appSettings.secureEnabled || settings.tokenExpiresIn != this.appSettings.tokenExpiresIn) {
            this.appSettings.secureEnabled = settings.secureEnabled;
            this.appSettings.tokenExpiresIn = settings.tokenExpiresIn;
            dirty = true;
        }
        return dirty;
    }

    saveSettings() {
        if (environment.serverEnabled) {
            let header = new HttpHeaders({ 'Content-Type': 'application/json' });
            this.http.post<AppSettings>(this.endPointConfig + '/api/settings', this.appSettings, { headers: header }).subscribe(result => {
            }, err => {
                this.notifySaveError(err);
            });
        }
    }

    private notifySaveError(err: any) {
        let msg = '';
        this.translateService.get('msg.settings-save-error').subscribe((txt: string) => { msg = txt });
        if (err.status === 401) {
            this.translateService.get('msg.settings-save-unauthorized').subscribe((txt: string) => { msg = txt });
        }
        this.toastr.error(msg, '', {
            timeOut: 3000,
            closeButton: true,
            disableTimeOut: true
        });
    }

    //#region Editor Mode Check
    lockEditMode() {
        this.editModeLocked = true;
    }

    unlockEditMode() {
        this.editModeLocked = false;
    }

    isEditModeLocked(): boolean {
        return this.editModeLocked;
    }

    notifyEditorLocked() {
        var msg = '';
        this.translateService.get('msg.editor-mode-locked').subscribe((txt: string) => { msg = txt });
        this.toastr.warning(msg, '', {
            timeOut: 3000,
            closeButton: true,
            disableTimeOut: false
        });
    }
    //#endregion
}
