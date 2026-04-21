'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const api = require('../../api');

const SECRET = 'test-secret';

let expect;

function buildRuntime(settingsFile) {
    return {
        project: {},
        logger: {
            info: () => {},
            warn: () => {},
            error: () => {}
        },
        restart: () => Promise.resolve(true),
        users: {
            getUserCache: () => null
        },
        settings: {
            logApiLevel: 'none',
            apiMaxLength: '5mb',
            secureEnabled: true,
            secretCode: SECRET,
            tokenExpiresIn: '1h',
            enableRefreshCookieAuth: false,
            refreshTokenExpiresIn: '7d',
            userRole: true,
            nodeRedEnabled: false,
            nodeRedAuthMode: 'secure',
            nodeRedUnsafeModules: false,
            broadcastAll: false,
            logFull: false,
            swaggerEnabled: false,
            smtp: { host: '', password: 'smtp-secret' },
            daqstore: { credentials: { token: 'daq-token' } },
            alarms: { retention: 'none' },
            logs: { retention: 'none' },
            userSettingsFile: settingsFile,
            auth: {
                provider: 'ad',
                fallbackLocal: true,
                ad: {
                    enabled: true,
                    url: 'ldap://dc01.lab.local:389'
                }
            }
        }
    };
}

describe('Security - /api/settings with supertest', () => {
    let settingsFile;

    before(async () => {
        const chai = await import('chai');
        expect = chai.expect;
    });

    beforeEach(async () => {
        settingsFile = path.join(os.tmpdir(), `fuxa-settings-${Date.now()}-${Math.random()}.json`);
        const runtime = buildRuntime(settingsFile);
        await api.init({}, runtime);
    });

    afterEach(() => {
        if (settingsFile && fs.existsSync(settingsFile)) {
            fs.unlinkSync(settingsFile);
        }
    });

    it('preserves auth block when payload does not include auth', async () => {
        const adminToken = jwt.sign({ id: 'admin', groups: -1, roles: ['admin'] }, SECRET, { expiresIn: '1h' });
        const payload = {
            secureEnabled: true,
            tokenExpiresIn: '1h',
            broadcastAll: true,
            logFull: true,
            userRole: true,
            nodeRedEnabled: false,
            enableRefreshCookieAuth: false,
            refreshTokenExpiresIn: '7d',
            swaggerEnabled: false,
            smtp: { host: 'mail.local', password: '' },
            daqstore: { credentials: {} }
        };

        await request(api.apiApp)
            .post('/api/settings')
            .set('x-access-token', adminToken)
            .send(payload)
            .expect(200);

        const persisted = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
        expect(persisted.auth).to.exist;
        expect(persisted.auth.provider).to.equal('ad');
        expect(persisted.auth.ad.url).to.equal('ldap://dc01.lab.local:389');
    });

    it('rejects non-admin token', async () => {
        const userToken = jwt.sign({ id: 'user1', groups: 2, roles: ['operator'] }, SECRET, { expiresIn: '1h' });
        const payload = {
            secureEnabled: true,
            tokenExpiresIn: '1h'
        };

        const res = await request(api.apiApp)
            .post('/api/settings')
            .set('x-access-token', userToken)
            .send(payload)
            .expect(401);

        expect(res.body.error).to.equal('unauthorized_error');
        expect(fs.existsSync(settingsFile)).to.equal(false);
    });
});
