import { Injectable } from '@angular/core';
import { ProjectService } from './project.service';
import { Language, Languages } from '../_models/language';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class LanguageService {

    languages: Languages;
    languageConfig: LanguageConfiguration;
    languageConfig$ = new BehaviorSubject<LanguageConfiguration>(null);

    constructor(
        public projectService: ProjectService
    ) {
        this.projectService.onLoadHmi.subscribe(() => {
            this.languages = this.projectService.getLanguages();
            this.languageConfig = {
                currentLanguage: this.languages.default || { id: 'EN', name: 'English' },
                ...this.languages
            };
		    this.languageConfig$.next(this.languageConfig);
        });
    }

    setCurrentLanguage(lang: Language): void {
        this.languageConfig.currentLanguage = lang;
        this.languageConfig$.next(this.languageConfig);
    }
}

export interface LanguageConfiguration extends Languages {
    currentLanguage: Language;
}
