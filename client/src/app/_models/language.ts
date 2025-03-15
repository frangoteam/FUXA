export class Languages {
    default: Language;
    optionals: Language[] = [];
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
