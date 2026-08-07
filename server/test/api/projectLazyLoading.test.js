'use strict';

const http = require('http');
const express = require('express');
const sinon = require('sinon');

const projectsApi = require('../../api/projects');

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
                    body: body ? JSON.parse(body) : null
                });
            });
        });
        req.on('error', reject);
        req.end();
    });
}

describe('Project API - lazy view loading', () => {
    let server;
    let runtime;

    before(async () => {
        const chai = await import('chai');
        expect = chai.expect;
    });

    beforeEach(async () => {
        runtime = {
            settings: {
                lazyViewLoading: false
            },
            project: {
                getProject: sinon.stub().resolves({ hmi: { views: [{ id: 'v1', svgcontent: '<svg></svg>' }] } }),
                getProjectView: sinon.stub().resolves({ id: 'v1', svgcontent: '<svg></svg>' })
            },
            logger: {
                error() {}
            }
        };

        function secureFnc(req, res, next) {
            req.userId = 'user-1';
            next();
        }

        function checkGroupsFnc() {
            return ['admin'];
        }

        projectsApi.init(runtime, secureFnc, checkGroupsFnc);

        const app = express();
        app.use(projectsApi.app());

        server = await new Promise((resolve) => {
            const listeningServer = app.listen(0, '127.0.0.1', () => {
                resolve(listeningServer);
            });
        });
    });

    afterEach((done) => {
        server.close(done);
    });

    it('does not enable lazy views when the server setting is disabled', async () => {
        const response = await request(server, '/api/project?views=lazy');

        expect(response.statusCode).to.equal(200);
        expect(runtime.project.getProject.calledOnce).to.equal(true);
        expect(runtime.project.getProject.firstCall.args[2]).to.deep.equal({ lazyViews: false });
    });

    it('enables lazy views only when the server setting and request opt-in are both present', async () => {
        runtime.settings.lazyViewLoading = true;

        const response = await request(server, '/api/project?views=lazy');

        expect(response.statusCode).to.equal(200);
        expect(runtime.project.getProject.calledOnce).to.equal(true);
        expect(runtime.project.getProject.firstCall.args[2]).to.deep.equal({ lazyViews: true });
    });

    it('keeps normal project responses complete when the request does not opt in', async () => {
        runtime.settings.lazyViewLoading = true;

        const response = await request(server, '/api/project');

        expect(response.statusCode).to.equal(200);
        expect(runtime.project.getProject.calledOnce).to.equal(true);
        expect(runtime.project.getProject.firstCall.args[2]).to.deep.equal({ lazyViews: false });
    });

    it('returns a single full view from the view endpoint', async () => {
        const response = await request(server, '/api/project/view/v1');

        expect(response.statusCode).to.equal(200);
        expect(response.body).to.deep.equal({ id: 'v1', svgcontent: '<svg></svg>' });
        expect(runtime.project.getProjectView.calledOnceWithExactly('v1', ['admin'])).to.equal(true);
    });
});
