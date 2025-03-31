import { Injectable } from '@angular/core';
import { ProjectService } from './project.service';
import { Language, LANGUAGE_TEXT_KEY_PREFIX, Languages, LanguageText } from '../_models/language';
import { BehaviorSubject } from 'rxjs';
import { UserInfo } from '../users/user-edit/user-edit.component';
import { AuthService } from './auth.service';

@Injectable({
    providedIn: 'root'
})
export class LanguageService {
    localStorageItem = 'currentLanguage';
    languages: Languages;
    languageConfig: LanguageConfiguration;
    languageConfig$ = new BehaviorSubject<LanguageConfiguration>(null);
    texts: { [id: string]: LanguageText } = {};

    constructor(
        public projectService: ProjectService,
        private authService: AuthService
    ) {
        this.projectService.onLoadHmi.subscribe(() => {
            let storageLanguage = this.getStorageLanguage();
            this.languages = this.projectService.getLanguages();
            this.languageConfig = {
                currentLanguage: storageLanguage || this.languages?.default || { id: 'EN', name: 'English' },
                ...this.languages
            };
            const user = this.authService.getUser();
            const userLanguageId = new UserInfo(user?.info).languageId;
            if (userLanguageId) {
                this.languageConfig.currentLanguage ??= this.getLanguage(userLanguageId);
            }
		    this.setCurrentLanguage(this.languageConfig.currentLanguage);
            this.texts = this.projectService.getTexts().reduce((acc, text) => {
                acc[text.name] = text;
                return acc;
              }, {} as { [id: string]: LanguageText });
        });
    }

    setCurrentLanguage(lang: Language): void {
        const username = this.authService.getUser()?.username || '';
        this.languageConfig.currentLanguage = lang;
        this.languageConfig$.next(this.languageConfig);
		localStorage.setItem(`${this.localStorageItem}-${username}`, JSON.stringify(lang));
    }

    private getStorageLanguage(): Language {
        const username = this.authService.getUser()?.username || '';
        return JSON.parse(localStorage.getItem(`${this.localStorageItem}-${username}`));
    }

    getTranslation(textKey: string): string {
        if (!textKey || !textKey.startsWith(LANGUAGE_TEXT_KEY_PREFIX)) {
            return null;
        }
        const text = this.texts[textKey.substring(1)];
        if (text) {
            if (text.translations[this.languageConfig.currentLanguage.id]) {
                return text.translations[this.languageConfig.currentLanguage.id];
            } else {
                return text.value;
            }
        }
        return null;
    }

    getLanguage(id: string) {
        if (this.languages?.default?.id === id) {
            return this.languages.default;
        }
        return this.languages?.options?.find(lang => lang.id === id);
    }
}

export interface LanguageConfiguration extends Languages {
    currentLanguage: Language;
}
