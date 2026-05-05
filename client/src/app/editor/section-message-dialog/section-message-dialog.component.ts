import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { AppSettings } from '../../_models/settings';
import { SettingsService } from '../../_services/settings.service';

export interface SectionMessageDialogData {
    titleKey: string;
    messageKey: string;
    hideLabelKey: string;
    actionLabelKey?: string;
    routePath?: string;
    absoluteUrl?: string;
    settingKey: 'hideDevicePluginsNotice';
}

@Component({
    selector: 'app-section-message-dialog',
    templateUrl: './section-message-dialog.component.html',
    styleUrls: ['./section-message-dialog.component.scss']
})
export class SectionMessageDialogComponent implements OnInit {
    hideMessage = false;

    constructor(
        public dialogRef: MatDialogRef<SectionMessageDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: SectionMessageDialogData,
        private router: Router,
        private settingsService: SettingsService
    ) { }

    ngOnInit() {
        this.hideMessage = !!this.settingsService.getSettings()?.editorSectionMessages?.[this.data.settingKey];
    }

    onNoClick(): void {
        this.savePreference();
        this.dialogRef.close();
    }

    openSection(): void {
        this.savePreference();
        this.dialogRef.close();
        if (this.data.routePath) {
            this.router.navigateByUrl(this.data.routePath);
        }
    }

    private savePreference(): void {
        const settings = new AppSettings();
        Object.assign(settings, this.settingsService.getSettings());
        settings.editorSectionMessages = {
            ...this.settingsService.getSettings()?.editorSectionMessages,
            [this.data.settingKey]: !!this.hideMessage
        };
        if (this.settingsService.setSettings(settings)) {
            this.settingsService.saveSettings();
        }
    }
}
