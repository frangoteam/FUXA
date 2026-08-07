'use strict';

const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');

const authJwt = require('../../api/jwt-helper');
const { createNodeRedAuthMiddleware } = require('../../integrations/node-red');

const SECRET = 'node-red-security-test-secret';

function makeResponse() {
    return {
        statusCode: 200,
        body: null,
        cookies: [],
        clearedCookies: [],
        redirectUrl: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
        cookie(name, value, options) {
            this.cookies.push({ name, value, options });
        },
        clearCookie(name) {
            this.clearedCookies.push(name);
        },
        redirect(url) {
            this.redirectUrl = url;
        }
    };
}

function makeRequest(headers = {}, overrides = {}) {
    return {
        baseUrl: '/nodered',
        headers,
        query: {},
        method: 'POST',
        originalUrl: '/nodered/flows',
        ...overrides
    };
}

function request(app, path, headers = {}) {
    return new Promise((resolve, reject) => {
        const server = app.listen(0, '127.0.0.1', () => {
            const req = http.request({
                host: '127.0.0.1',
                port: server.address().port,
                method: 'GET',
                path,
                headers
            }, (res) => {
                let body = '';
                res.setEncoding('utf8');
                res.on('data', chunk => { body += chunk; });
                res.on('end', () => {
                    server.close(() => resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body
                    }));
                });
            });
            req.on('error', err => server.close(() => reject(err)));
            req.end();
        });
    });
}

describe('Node-RED secure mode authorization', () => {
    let expect;
    let middleware;

    function makeMiddleware(settings = {}) {
        return createNodeRedAuthMiddleware({
            settings: {
                secureEnabled: true,
                nodeRedAuthMode: 'secure',
                ...settings
            },
            runtime: {
                apiKeys: {
                    getApiKeys: () => Promise.resolve([{ id: 'key-1', key: 'valid-api-key' }])
                }
            },
            logger: {
                error() {}
            },
            authJwt
        });
    }

    before(async () => {
        const chai = await import('chai');
        expect = chai.expect;
        authJwt.init(true, SECRET, 60 * 60);
        middleware = makeMiddleware();
    });

    async function authorize(headers, overrides, authMiddleware = middleware) {
        const req = makeRequest(headers, overrides);
        const res = makeResponse();
        let allowed = false;

        await authMiddleware(req, res, () => {
            allowed = true;
        });

        return { allowed, res };
    }

    it('rejects a valid guest JWT', async () => {
        const result = await authorize({ 'x-access-token': authJwt.getGuestToken() });

        expect(result.allowed).to.equal(false);
        expect(result.res.statusCode).to.equal(403);
    });

    it('allows an authenticated user with numeric groups', async () => {
        const token = jwt.sign({ id: 'operator', groups: 2 }, SECRET, { expiresIn: '1h' });
        const result = await authorize({ 'x-access-token': token });

        expect(result.allowed).to.equal(true);
        expect(result.res.statusCode).to.equal(200);
    });

    it('allows an authenticated role-based user without groups in the JWT', async () => {
        const token = jwt.sign({ id: 'role-user' }, SECRET, { expiresIn: '1h' });
        const result = await authorize({ 'x-access-token': token });

        expect(result.allowed).to.equal(true);
        expect(result.res.statusCode).to.equal(200);
    });

    it('allows an authenticated user with no assigned groups', async () => {
        const token = jwt.sign({ id: 'no-group-user', groups: 0 }, SECRET, { expiresIn: '1h' });
        const result = await authorize({ 'x-access-token': token });

        expect(result.allowed).to.equal(true);
        expect(result.res.statusCode).to.equal(200);
    });

    it('rejects a signed refresh token', async () => {
        const token = jwt.sign({ id: 'operator', type: 'refresh' }, SECRET, { expiresIn: '1h' });
        const result = await authorize({ 'x-access-token': token });

        expect(result.allowed).to.equal(false);
        expect(result.res.statusCode).to.equal(403);
    });

    it('allows a valid API key', async () => {
        const result = await authorize({ 'x-api-key': 'valid-api-key' });

        expect(result.allowed).to.equal(true);
        expect(result.res.statusCode).to.equal(200);
    });

    it('rejects missing and invalid credentials', async () => {
        const missing = await authorize();
        const invalid = await authorize({ 'x-access-token': 'invalid-token' });

        expect(missing.allowed).to.equal(false);
        expect(missing.res.statusCode).to.equal(401);
        expect(invalid.allowed).to.equal(false);
        expect(invalid.res.statusCode).to.equal(401);
    });

    it('preserves query-token login, cookie creation and clean redirect', async () => {
        const token = jwt.sign({ id: 'operator', groups: 2 }, SECRET, { expiresIn: '1h' });
        const result = await authorize({}, {
            method: 'GET',
            query: { token, tab: 'flows' },
            originalUrl: `/nodered/?token=${token}&tab=flows`,
            headers: { host: 'localhost' }
        });

        expect(result.allowed).to.equal(false);
        expect(result.res.cookies).to.have.length(1);
        expect(result.res.cookies[0].name).to.equal('nodered_auth');
        expect(result.res.redirectUrl).to.equal('/nodered/?tab=flows');
    });

    it('preserves authenticated cookie access', async () => {
        const token = jwt.sign({ id: 'operator', groups: 2 }, SECRET, { expiresIn: '1h' });
        const result = await authorize({ cookie: `other=value; nodered_auth=${token}` });

        expect(result.allowed).to.equal(true);
    });

    it('clears an invalid authentication cookie', async () => {
        const result = await authorize({ cookie: 'nodered_auth=invalid-token' });

        expect(result.allowed).to.equal(false);
        expect(result.res.statusCode).to.equal(401);
        expect(result.res.clearedCookies).to.deep.equal(['nodered_auth']);
    });

    it('keeps dashboard routes public', async () => {
        const result = await authorize({}, { baseUrl: '/dashboard' });

        expect(result.allowed).to.equal(true);
    });

    it('preserves legacy-open access without credentials', async () => {
        const result = await authorize({}, {}, makeMiddleware({ nodeRedAuthMode: 'legacy-open' }));

        expect(result.allowed).to.equal(true);
    });

    it('preserves access without credentials when FUXA security is disabled', async () => {
        const result = await authorize({}, {}, makeMiddleware({ secureEnabled: false }));

        expect(result.allowed).to.equal(true);
    });

    it('enforces the same policy when mounted by Express', async () => {
        const app = express();
        app.use('/nodered', middleware, (req, res) => res.status(200).send('allowed'));

        const guest = await request(app, '/nodered/flows', {
            'x-access-token': authJwt.getGuestToken()
        });
        const userToken = jwt.sign({ id: 'operator', groups: 2 }, SECRET, { expiresIn: '1h' });
        const user = await request(app, `/nodered/?token=${userToken}`);

        expect(guest.statusCode).to.equal(403);
        expect(user.statusCode).to.equal(302);
        expect(user.headers.location).to.equal('/nodered/');
        expect(user.headers['set-cookie'][0]).to.contain('nodered_auth=');
    });
});
