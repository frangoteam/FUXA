import { Injectable, Output, EventEmitter } from '@angular/core';

import { environment } from '../../environments/environment';
import { SettingsService } from './settings.service';

@Injectable()
export class AppService {

    @Output() onShowModeChanged: EventEmitter<string> = new EventEmitter();
    @Output() onShowLoading: EventEmitter<boolean> = new EventEmitter();

    private static APP_DEMO = 'demo';
    private static APP_CLIENT = 'client';

    private showMode: string;

    constructor(private settingsService: SettingsService) {
    }

    setShowMode(mode: string): string {
        if (mode === 'editor' && this.settingsService.isEditModeLocked()) {
            this.settingsService.notifyEditorLocked();
            return this.showMode;
        } else {
            this.showMode = mode;
            this.onShowModeChanged.emit(this.showMode);
            return this.showMode;
        }
    }

    lockEditMode() {
        this.settingsService.lockEditMode();
    }

    unlockEditMode() {
        this.settingsService.unlockEditMode();
    }

    showLoading(show: boolean) {
        this.onShowLoading.emit(show);
    }

    get isDemoApp() {
        return (environment.type === AppService.APP_DEMO);
    }

    get isClientApp() {
        return (environment.type === AppService.APP_CLIENT);
    }
}
