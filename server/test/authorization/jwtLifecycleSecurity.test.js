'use strict';

const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');

const apiIndex = require('../../api');
const authApi = require('../../api/auth');
const usersApi = require('../../api/users');

const SECRET = 'jwt-lifecycle-secret';

let expect;

function request(server, options) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            host: '127.0.0.1',
            port: server.address().port,
            method: options.method || 'GET',
            path: options.path,
            headers: options.headers || {}
        }, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                let json = null;
                try {
                    json = body ? JSON.parse(body) : null;
                } catch (err) {
                    json = null;
                }
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body,
                    json
                });
            });
        });
        req.on('error', reject);
        req.end(options.body || undefined);
    });
}

function listen(app) {
    return new Promise((resolve) => {
        const server = app.listen(0, '127.0.0.1', () => {
            resolve(server);
        });
    });
}

describe('Security - JWT lifecycle', () => {
    before(async () => {
        const chai = await import('chai');
        expect = chai.expect;
    });

    it('rejects refresh cookies for deleted users instead of reusing token groups', async () => {
        const runtime = {
            project: {},
            settings: {
                secureEnabled: true,
                enableRefreshCookieAuth: true
            },
            users: {
                getUsers() {
                    return Promise.resolve();
                }
            },
            logger: {
                error() {},
                info() {}
            }
        };

        authApi.init(runtime, SECRET, '1h', true, '7d');
        const app = express();
        app.use(authApi.app());
        const server = await listen(app);

        try {
            const refreshToken = jwt.sign({ id: 'admin', groups: -1, type: 'refresh' }, SECRET, { expiresIn: '7d' });
            const response = await request(server, {
                method: 'POST',
                path: '/api/refresh',
                headers: {
                    Cookie: `fuxa_refresh=${refreshToken}`
                }
            });

            expect(response.statusCode).to.equal(401);
            expect(response.json.message).to.equal('Invalid refresh token');
        } finally {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    it('refreshes access tokens with current stored groups after demotion', async () => {
        const runtime = {
            project: {},
            settings: {
                secureEnabled: true,
                enableRefreshCookieAuth: true
            },
            users: {
                getUsers() {
                    return Promise.resolve([
                        {
                            username: 'admin',
                            fullname: 'Administrator',
                            groups: 1,
                            info: '{}'
                        }
                    ]);
                }
            },
            logger: {
                error() {},
                info() {}
            }
        };

        authApi.init(runtime, SECRET, '1h', true, '7d');
        const app = express();
        app.use(authApi.app());
        const server = await listen(app);

        try {
            const refreshToken = jwt.sign({ id: 'admin', groups: -1, type: 'refresh' }, SECRET, { expiresIn: '7d' });
            const response = await request(server, {
                method: 'POST',
                path: '/api/refresh',
                headers: {
                    Cookie: `fuxa_refresh=${refreshToken}`
                }
            });

            expect(response.statusCode).to.equal(200);
            expect(response.json.data.groups).to.equal(1);

            const decodedAccess = jwt.verify(response.json.data.token, SECRET);
            expect(decodedAccess.groups).to.equal(1);
        } finally {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    it('refreshes access tokens with groups zero after role clear', async () => {
        const runtime = {
            project: {},
            settings: {
                secureEnabled: true,
                enableRefreshCookieAuth: true
            },
            users: {
                getUsers() {
                    return Promise.resolve([
                        {
                            username: 'admin',
                            fullname: 'Administrator',
                            groups: 0,
                            info: '{"roles":[]}'
                        }
                    ]);
                }
            },
            logger: {
                error() {},
                info() {}
            }
        };

        authApi.init(runtime, SECRET, '1h', true, '7d');
        const app = express();
        app.use(authApi.app());
        const server = await listen(app);

        try {
            const refreshToken = jwt.sign({ id: 'admin', groups: -1, type: 'refresh' }, SECRET, { expiresIn: '7d' });
            const response = await request(server, {
                method: 'POST',
                path: '/api/refresh',
                headers: {
                    Cookie: `fuxa_refresh=${refreshToken}`
                }
            });

            expect(response.statusCode).to.equal(200);
            expect(response.json.data.groups).to.equal(0);
            expect(response.json.data.info).to.equal('{"roles":[]}');

            const decodedAccess = jwt.verify(response.json.data.token, SECRET);
            expect(decodedAccess.groups).to.equal(0);
        } finally {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    it('does not expose password hashes from the users endpoint', async () => {
        const runtime = {
            project: {},
            users: {
                getUsers() {
                    return Promise.resolve([
                        {
                            username: 'admin',
                            fullname: 'Administrator',
                            password: '$2a$10$hash',
                            groups: -1,
                            info: '{}'
                        }
                    ]);
                }
            },
            logger: {
                error() {}
            }
        };

        function secureFnc(req, res, next) {
            req.userId = 'admin';
            req.userGroups = -1;
            next();
        }

        function checkGroupsFnc() {
            return -1;
        }

        usersApi.init(runtime, secureFnc, checkGroupsFnc);
        const app = express();
        app.use(usersApi.app());
        const server = await listen(app);

        try {
            const response = await request(server, {
                path: '/api/users'
            });

            expect(response.statusCode).to.equal(200);
            expect(response.json[0]).to.not.have.property('password');
            expect(response.body).to.not.contain('$2a$10$hash');
        } finally {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    it('heartbeat reissues tokens with current stored groups after demotion', async () => {
        const runtime = {
            project: {},
            settings: {
                secureEnabled: true,
                secretCode: SECRET,
                tokenExpiresIn: '1h',
                logApiLevel: 'none'
            },
            users: {
                getUserCache(username) {
                    if (username === 'alice') {
                        return { groups: 2, info: {} };
                    }
                    return null;
                },
                getUsers() {
                    return Promise.resolve([
                        {
                            username: 'alice',
                            groups: 2,
                            info: '{"roles":["operator"]}'
                        }
                    ]);
                }
            },
            logger: {
                error() {},
                info() {},
                warn() {}
            }
        };

        await apiIndex.init(null, runtime);
        const server = await listen(apiIndex.apiApp);

        try {
            const staleAdminToken = jwt.sign({ id: 'alice', groups: -1 }, SECRET, { expiresIn: '1h' });
            const response = await request(server, {
                method: 'POST',
                path: '/api/heartbeat',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': staleAdminToken
                },
                body: JSON.stringify({ params: true })
            });

            expect(response.statusCode).to.equal(200);
            expect(response.json.message).to.equal('tokenRefresh');
            expect(response.json.data.groups).to.equal(2);
            expect(response.json.data.info).to.equal('{"roles":["operator"]}');

            const decodedAccess = jwt.verify(response.json.token, SECRET);
            expect(decodedAccess.groups).to.equal(2);
        } finally {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    it('heartbeat refuses to reissue tokens for deleted users', async () => {
        const runtime = {
            project: {},
            settings: {
                secureEnabled: true,
                secretCode: SECRET,
                tokenExpiresIn: '1h',
                logApiLevel: 'none'
            },
            users: {
                getUserCache() {
                    return null;
                },
                getUsers() {
                    return Promise.resolve();
                }
            },
            logger: {
                error() {},
                info() {},
                warn() {}
            }
        };

        await apiIndex.init(null, runtime);
        const server = await listen(apiIndex.apiApp);

        try {
            const staleAdminToken = jwt.sign({ id: 'alice', groups: -1 }, SECRET, { expiresIn: '1h' });
            const response = await request(server, {
                method: 'POST',
                path: '/api/heartbeat',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': staleAdminToken
                },
                body: JSON.stringify({ params: true })
            });

            expect(response.statusCode).to.equal(401);
            expect(response.json.message).to.equal('Unauthorized!');
        } finally {
            await new Promise((resolve) => server.close(resolve));
        }
    });
});
