export class Languages {
    default: Language;
    options: Language[] = [];
}
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
