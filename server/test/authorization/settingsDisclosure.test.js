'use strict';

const apiIndex = require('../../api');

let expect;

function makeSettings() {
    return {
        language: 'en',
        secureEnabled: true,
        secretCode: 'jwt-secret',
        smtp: {
            host: 'smtp.internal',
            port: 587,
            username: 'smtp-user',
            password: 'smtp-secret',
            mailsender: 'fuxa@example.com'
        },
        daqstore: {
            type: 'influxDB',
            url: 'http://influx.internal:8086',
            host: 'questdb.internal',
            database: 'fuxa',
            credentials: {
                username: 'daq-user',
                password: 'daq-secret'
            }
        }
    };
}

describe('Security - settings disclosure', () => {
    before(async () => {
        const chai = await import('chai');
        expect = chai.expect;
    });

    it('always removes passwords, credentials and the JWT secret', () => {
        const settings = makeSettings();

        for (const result of [
            apiIndex._getSanitizedSettings(settings),
            apiIndex._getPublicSettings(settings)
        ]) {
            expect(result).to.not.have.property('secretCode');
            expect(result.smtp).to.not.have.property('password');
            expect(result.daqstore).to.not.have.property('credentials');
        }

        expect(settings).to.deep.equal(makeSettings());
    });

    it('removes infrastructure connection details from public settings', () => {
        const publicSettings = apiIndex._getPublicSettings(makeSettings());

        expect(publicSettings.smtp).to.not.have.property('host');
        expect(publicSettings.smtp).to.not.have.property('port');
        expect(publicSettings.smtp).to.not.have.property('username');
        expect(publicSettings.smtp.mailsender).to.equal('fuxa@example.com');
        expect(publicSettings.daqstore).to.not.have.property('url');
        expect(publicSettings.daqstore).to.not.have.property('host');
        expect(publicSettings.daqstore).to.include({
            type: 'influxDB',
            database: 'fuxa'
        });
    });

    it('keeps non-secret connection details available to admins', () => {
        const adminSettings = apiIndex._getSanitizedSettings(makeSettings());

        expect(adminSettings.smtp).to.include({
            host: 'smtp.internal',
            port: 587,
            username: 'smtp-user'
        });
        expect(adminSettings.daqstore).to.include({
            url: 'http://influx.internal:8086',
            host: 'questdb.internal'
        });
    });
});
