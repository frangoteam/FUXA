'use strict';

const http = require('http');
const express = require('express');

const usersApi = require('../../api/users');

let expect;

function request(server, path) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            host: '127.0.0.1',
            port: server.address().port,
            method: 'GET',
            path
        }, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    body
                });
            });
        });
        req.on('error', reject);
        req.end();
    });
}

describe('Security - API path normalization', () => {
    let server;
    let usersRequested;

    before(async () => {
        const chai = await import('chai');
        expect = chai.expect;

        const runtime = {
            project: {},
            users: {
                getUsers() {
                    usersRequested = true;
                    return Promise.resolve([
                        {
                            username: 'admin',
                            password: '$2a$10$hash'
                        }
                    ]);
                },
                getRoles() {
                    usersRequested = true;
                    return Promise.resolve([{ id: 1, name: 'admin' }]);
                }
            },
            logger: {
                error() {}
            }
        };

        function secureFnc(req, res, next) {
            req.userId = 'guest';
            req.userGroups = ['guest'];
            next();
        }

        function checkGroupsFnc(req) {
            return req.userGroups;
        }

        usersApi.init(runtime, secureFnc, checkGroupsFnc);

        const app = express();
        app.use(usersApi.app());

        server = await new Promise((resolve) => {
            const listeningServer = app.listen(0, '127.0.0.1', () => {
                resolve(listeningServer);
            });
        });
    });

    after((done) => {
        server.close(done);
    });

    beforeEach(() => {
        usersRequested = false;
    });

    it('rejects direct unauthenticated users access', async () => {
        const response = await request(server, '/api/users');

        expect(response.statusCode).to.equal(401);
        expect(usersRequested).to.equal(false);
    });

    it('does not route dot-segment variants to users endpoint', async () => {
        for (const path of ['/api/./users', '/api/project/../users']) {
            usersRequested = false;

            const response = await request(server, path);

            expect(response.statusCode).to.equal(404);
            expect(usersRequested).to.equal(false);
            expect(response.body).to.not.contain('$2a$10$hash');
        }
    });

    it('does not route dot-segment variants to roles endpoint', async () => {
        const response = await request(server, '/api/./roles');

        expect(response.statusCode).to.equal(404);
        expect(usersRequested).to.equal(false);
    });
});
