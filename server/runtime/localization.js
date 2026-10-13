'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_LANGUAGE = 'en';
const DEFAULT_I18N_PATH = path.resolve(__dirname, '../../client/dist/assets/i18n');

function createLocalization(options = {}) {
    let i18nPath = options.i18nPath || DEFAULT_I18N_PATH;
    let logger = options.logger || null;
    const catalogues = new Map();
    let languages = null;

    function warn(message) {
        if (logger && typeof logger.warn === 'function') {
            logger.warn(message);
        }
    }

    function normalizeLanguage(language) {
        return typeof language === 'string' ? language.trim().toLowerCase() : '';
    }

    function getLanguages() {
        if (languages) {
            return languages;
        }
        try {
            languages = fs.readdirSync(i18nPath)
                .filter(file => file.endsWith('.json'))
                .map(file => file.slice(0, -5).toLowerCase())
                .sort();
        } catch (err) {
            languages = [];
            warn(`localization.catalogue-directory-unavailable: ${i18nPath} (${err.message})`);
        }
        return languages;
    }

    function loadCatalogue(language) {
        if (catalogues.has(language)) {
            return catalogues.get(language);
        }

        let messages = {};
        const filePath = path.join(i18nPath, `${language}.json`);
        try {
            const catalogueText = fs.readFileSync(filePath, 'utf8');
            let frontendCatalogue;
            try {
                frontendCatalogue = JSON.parse(catalogueText);
            } catch (err) {
                warn(`localization.catalogue-invalid: ${filePath} (${err.message})`);
                catalogues.set(language, messages);
                return messages;
            }
            if (frontendCatalogue.server && typeof frontendCatalogue.server === 'object') {
                messages = frontendCatalogue.server;
            } else {
                warn(`localization.server-namespace-missing: ${filePath}`);
            }
        } catch (err) {
            warn(`localization.catalogue-missing: ${filePath} (${err.message})`);
        }

        catalogues.set(language, messages);
        return messages;
    }

    function getMessage(catalogue, key) {
        return key.split('.').reduce((value, part) => {
            if (!value || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, part)) {
                return undefined;
            }
            return value[part];
        }, catalogue);
    }

    function translate(language, key, params = {}) {
        if (typeof key !== 'string' || !key) {
            return '';
        }

        const selectedLanguage = normalizeLanguage(language) || DEFAULT_LANGUAGE;
        const availableLanguages = getLanguages();
        if (selectedLanguage && !availableLanguages.includes(selectedLanguage)) {
            warn(`localization.language-unavailable: ${selectedLanguage}; using ${DEFAULT_LANGUAGE}`);
        }
        const resolvedLanguage = availableLanguages.includes(selectedLanguage) ? selectedLanguage : DEFAULT_LANGUAGE;
        let message = getMessage(loadCatalogue(resolvedLanguage), key);

        if (typeof message !== 'string' && resolvedLanguage !== DEFAULT_LANGUAGE) {
            message = getMessage(loadCatalogue(DEFAULT_LANGUAGE), key);
        }
        if (typeof message !== 'string') {
            warn(`localization.key-missing: ${key} (language: ${resolvedLanguage})`);
            return key;
        }

        return message.replace(/{{\s*([\w.-]+)\s*}}/g, (placeholder, name) => {
            const value = name.split('.').reduce((result, part) => {
                if (!result || typeof result !== 'object' || !Object.prototype.hasOwnProperty.call(result, part)) {
                    return undefined;
                }
                return result[part];
            }, params);
            return value === undefined || value === null ? placeholder : String(value);
        });
    }

    function init(config = {}) {
        i18nPath = config.i18nPath || DEFAULT_I18N_PATH;
        logger = config.logger || null;
        catalogues.clear();
        languages = null;
    }

    return { init, translate, getLanguages };
}

module.exports = createLocalization();
module.exports.create = createLocalization;
