export class Languages {
    default: Language;
    options: Language[] = [];
}

export const APP_LANGUAGES = [
    { text: 'dlg.app-language-de', value: 'de' },
    { text: 'dlg.app-language-en', value: 'en' },
    { text: 'dlg.app-language-es', value: 'es' },
    { text: 'dlg.app-language-fr', value: 'fr' },
    { text: 'dlg.app-language-ko', value: 'ko' },
    { text: 'dlg.app-language-pt', value: 'pt' },
    { text: 'dlg.app-language-ru', value: 'ru' },
    { text: 'dlg.app-language-sv', value: 'sv' },
    { text: 'dlg.app-language-tr', value: 'tr' },
    { text: 'dlg.app-language-ua', value: 'ua' },
    { text: 'dlg.app-language-zh-cn', value: 'zh-cn' },
    { text: 'dlg.app-language-ja', value: 'ja' },
    { text: 'dlg.app-language-zh-tw', value: 'zh-tw' }
];

export class Language {
    id: string;
    name: string;
}

export class LanguageText {
    id: string;
    name: string;
    group: string;
    value: string;
    translations: { [languageId: string]: string };
}

export const LANGUAGE_TEXT_KEY_PREFIX = '@';
