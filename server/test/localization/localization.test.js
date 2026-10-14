'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const localization = require('../../runtime/localization');

describe('runtime localization', function () {
    let expect;
    let i18nPath;
    let service;

    before(async function () {
        ({ expect } = await import('chai'));
    });

    beforeEach(function () {
        i18nPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fuxa-i18n-'));
        fs.writeFileSync(path.join(i18nPath, 'en.json'), JSON.stringify({
            'frontend.label': 'Frontend only',
            server: {
                'notification-login': 'User {{user}} logged in',
                'notification-logout': 'User {{user}} logged out'
            }
        }));
        fs.writeFileSync(path.join(i18nPath, 'it.json'), JSON.stringify({
            server: {
                'notification-login': 'Utente {{user}} ha effettuato l’accesso'
            }
        }));
        service = localization.create();
        service.init({ i18nPath });
    });

    afterEach(function () {
        fs.rmSync(i18nPath, { recursive: true, force: true });
    });

    it('lists languages from the frontend locale files', function () {
        expect(service.getLanguages()).to.deep.equal(['en', 'it']);
    });

    it('translates server messages and interpolates parameters', function () {
        expect(service.translate('it', 'notification-login', { user: 'Mario' })).to.equal('Utente Mario ha effettuato l’accesso');
        expect(service.translate('en', 'notification-logout', { user: 'Mario' })).to.equal('User Mario logged out');
    });

    it('falls back to English and then to the key', function () {
        expect(service.translate('it', 'notification-logout', { user: 'Mario' })).to.equal('User Mario logged out');
        expect(service.translate(undefined, 'notification-login', { user: 'Mario' })).to.equal('User Mario logged in');
        expect(service.translate('', 'notification-logout', { user: 'Mario' })).to.equal('User Mario logged out');
        expect(service.translate('unknown', 'notification-missing')).to.equal('notification-missing');
    });

    it('does not expose frontend-only messages', function () {
        expect(service.translate('en', 'frontend.label')).to.equal('frontend.label');
    });

    it('warns once when a locale catalogue is missing', function () {
        const emptyPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fuxa-i18n-empty-'));
        const warnings = [];
        const emptyService = localization.create();
        emptyService.init({
            i18nPath: emptyPath,
            logger: { warn: message => warnings.push(message) }
        });

        try {
            emptyService.translate('en', 'notification-login');
            emptyService.translate('en', 'notification-login');
            expect(warnings.filter(message => message.includes('catalogue-missing'))).to.have.length(1);
        } finally {
            fs.rmSync(emptyPath, { recursive: true, force: true });
        }
    });
});
