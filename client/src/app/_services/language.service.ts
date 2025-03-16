import { Injectable } from '@angular/core';
import { ProjectService } from './project.service';
import { Language, Languages } from '../_models/language';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class LanguageService {

    localStorageItem = 'currentLanguage';
    languages: Languages;
    languageConfig: LanguageConfiguration;
    languageConfig$ = new BehaviorSubject<LanguageConfiguration>(null);

    constructor(
        public projectService: ProjectService
    ) {
        this.projectService.onLoadHmi.subscribe(() => {
            let storageLanguage = JSON.parse(localStorage.getItem(this.localStorageItem));
            this.languages = this.projectService.getLanguages();
            this.languageConfig = {
                currentLanguage: storageLanguage || this.languages.default || { id: 'EN', name: 'English' },
                ...this.languages
            };
		    this.setCurrentLanguage(this.languageConfig.currentLanguage);
        });
    }

    setCurrentLanguage(lang: Language): void {
        this.languageConfig.currentLanguage = lang;
        this.languageConfig$.next(this.languageConfig);
		localStorage.setItem(this.localStorageItem, JSON.stringify(lang));
    }
}

export interface LanguageConfiguration extends Languages {
    currentLanguage: Language;
}
