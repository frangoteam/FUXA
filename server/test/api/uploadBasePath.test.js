'use strict';

const http = require('http');
const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');

const projectsApi = require('../../api/projects');

let expect;

function request(server, payload) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(payload);
        const req = http.request({
            host: '127.0.0.1',
            port: server.address().port,
            method: 'POST',
            path: '/api/upload',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, (res) => {
            let responseBody = '';
            res.setEncoding('utf8');
            res.on('data', chunk => {
                responseBody += chunk;
            });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    body: responseBody ? JSON.parse(responseBody) : null
                });
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

describe('Project API - upload resource location', () => {
    let server;
    let uploadDir;

    before(async () => {
        const chai = await import('chai');
        expect = chai.expect;
    });

    beforeEach(async () => {
        uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fuxa-upload-'));

        const runtime = {
            settings: {
                httpUploadFileStatic: 'resources',
                uploadFileDir: uploadDir,
                appDir: uploadDir
            },
            project: {},
            logger: {
                error() {}
            }
        };

        function secureFnc(req, res, next) {
            next();
        }

        function checkGroupsFnc() {
            return -1;
        }

        projectsApi.init(runtime, secureFnc, checkGroupsFnc);

        const app = express();
        app.use(express.json({ limit: '1mb' }));
        app.use(projectsApi.app());

        server = await new Promise(resolve => {
            const listeningServer = app.listen(0, '127.0.0.1', () => resolve(listeningServer));
        });
    });

    afterEach(done => {
        fs.rmSync(uploadDir, { recursive: true, force: true });
        server.close(done);
    });

    it('returns a browser-relative resource URL for BASE_PATH deployments', async () => {
        const response = await request(server, {
            resource: {
                name: 'menu-icon.svg',
                fullPath: 'menu-icon.svg',
                type: 'svg',
                data: '<svg></svg>'
            }
        });

        expect(response.statusCode).to.equal(200);
        expect(response.body).to.deep.equal({ location: 'resources/menu-icon.svg' });
        expect(response.body.location.startsWith('/')).to.equal(false);
        expect(fs.existsSync(path.join(uploadDir, 'menu-icon.svg'))).to.equal(true);
    });
});
