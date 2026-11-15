'use strict';

const http = require('http');
const express = require('express');
const assert = require('assert');
const projectsApi = require('../../api/projects');

function request(server, path = '/api/project', headers = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request({ host: '127.0.0.1', port: server.address().port, method: 'GET', path, headers }, res => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, body: body ? JSON.parse(body) : null }));
        });
        req.on('error', reject);
        req.end();
    });
}

describe('Project API sensitive data filtering', function () {
    let server;
    let project;
    let runtime;

    beforeEach(async function () {
        project = {
            devices: {
                opc: { id: 'opc', name: 'OPC', type: 'OPCUA', enabled: true, tags: { t1: { id: 't1', name: 'Tag', address: 'ns=1;s=x' } }, property: { endpoint: 'opc.tcp://host', security: { mode: 'basic', username: 'device-user', password: 'device-pass', privateKey: 'private-key', certificate: 'certificate-data' } } },
                mqtt: { id: 'mqtt', name: 'MQTT', type: 'MQTTclient', property: { host: 'broker', options: { username: 'mqtt-user', password: 'mqtt-pass' } } }
            },
            server: { id: '0', name: 'FUXA Server', type: 'FuxaServer', endpoint: 'internal', secret: 'server-secret' },
            scripts: [
                { id: 'server-script', name: 'ServerAction', mode: 'SERVER', code: 'server-secret-code', parameters: [{ name: 'credential', type: 'value', value: 'script-secret' }] },
                { id: 'client-script', name: 'ClientAction', mode: 'CLIENT', code: 'client-code', parameters: [] }
            ],
            notifications: [{ id: 'n1', receiver: 'private@example.com', options: { webhookToken: 'webhook-secret', headers: { Authorization: 'header-secret' } } }],
            reports: [{ id: 'r1', receiver: 'report-private@example.com', options: { apiToken: 'report-secret' } }],
            recipes: [
                { id: 'visible-recipe', name: 'Visible recipe', permission: 1, entries: [] },
                { id: 'hidden-recipe', name: 'Hidden recipe', permission: 2, entries: [] },
                { id: 'unreferenced-recipe', name: 'Unreferenced recipe', entries: [] }
            ],
            hmi: { views: [{
                id: 'v1', name: 'View', svgcontent: '<svg/>', items: {
                    recipeWidget: { id: 'recipeWidget', type: 'svg-ext-own_ctrl-recipe', property: { recipeId: 'visible-recipe' } }
                }
            }] }
        };
        runtime = {
            settings: { secureEnabled: true, userRole: false, lazyViewLoading: false },
            project: { getProject: async () => project, getProjectView: async () => project.hmi.views[0] },
            checkPermission(permission, recipe) { return { show: recipe.id !== 'hidden-recipe', enabled: true }; },
            logger: { error() {} }
        };
        let userId = 'guest';
        let permission = 0;
        let userGroups = ['guest'];
        projectsApi.init(runtime, (req, res, next) => { req.userId = userId; req.userGroups = userGroups; next(); }, () => permission);
        const app = express();
        app.use(projectsApi.app());
        server = await new Promise(resolve => {
            const listeningServer = app.listen(0, '127.0.0.1', () => resolve(listeningServer));
        });
        this.setUser = (id, value, groups = id === 'guest' ? ['guest'] : []) => { userId = id; permission = value; userGroups = groups; };
        this.setRoleModel = value => { runtime.settings.userRole = value; };
        this.setSecurity = value => { runtime.settings.secureEnabled = value; };
    });

    afterEach(function (done) { server.close(done); });

    it('filters guest responses while preserving non-sensitive runtime configuration', async function () {
        const original = JSON.stringify(project);
        const response = await request(server);
        const body = JSON.stringify(response.body);
        for (const secret of ['device-user', 'device-pass', 'private-key', 'certificate-data', 'mqtt-user', 'mqtt-pass', 'server-secret', 'server-secret-code', 'script-secret', 'webhook-secret', 'header-secret', 'private@example.com', 'report-private@example.com', 'report-secret']) {
            assert.equal(body.includes(secret), false, `response contained ${secret}`);
        }
        assert.equal(response.statusCode, 200);
        assert.equal(response.body.devices.opc.property.endpoint, 'opc.tcp://host');
        assert.equal(response.body.devices.opc.tags.t1.address, 'ns=1;s=x');
        assert.equal(response.body.server.name, 'FUXA Server');
        assert.equal(response.body.server.secret, undefined);
        assert.equal(response.body.scripts.find(script => script.id === 'client-script').code, 'client-code');
        assert.equal(response.body.scripts.find(script => script.id === 'server-script').code, undefined);
        assert.equal(response.body.notifications[0].receiver, undefined);
        assert.deepEqual(response.body.recipes.map(recipe => recipe.id), ['visible-recipe']);
        assert.equal(JSON.stringify(project), original);
    });

    it('returns the complete project to an administrator', async function () {
        this.setUser('admin', 255);
        const response = await request(server);
        assert.equal(response.body.devices.opc.property.security.password, 'device-pass');
        assert.equal(response.body.server.secret, 'server-secret');
        assert.equal(response.body.scripts[0].code, 'server-secret-code');
        assert.equal(response.body.notifications[0].receiver, 'private@example.com');
        assert.equal(response.body.reports[0].receiver, 'report-private@example.com');
        assert.equal(response.body.recipes.length, 3);
    });

    it('does not treat a Guest identity as admin even with an administrative permission value', async function () {
        this.setUser('admin', 255, ['guest']);
        const response = await request(server);
        assert.equal(response.body.scripts[0].code, undefined);
        assert.equal(response.body.devices.opc.property.security.password, undefined);
        assert.equal(response.body.server.secret, undefined);
    });

    it('preserves the complete project when security is disabled', async function () {
        this.setSecurity(false);
        const response = await request(server);
        assert.equal(response.body.devices.opc.property.security.password, 'device-pass');
        assert.equal(response.body.scripts[0].code, 'server-secret-code');
        assert.equal(response.body.notifications[0].receiver, 'private@example.com');
        assert.equal(response.body.server.secret, 'server-secret');
    });

    it('filters authenticated non-admins under both permission models', async function () {
        this.setUser('operator', 1);
        for (const roleModel of [false, true]) {
            this.setRoleModel(roleModel);
            const response = await request(server);
            const body = JSON.stringify(response.body);
            assert.equal(body.includes('device-pass'), false);
            assert.equal(body.includes('webhook-secret'), false);
            assert.equal(response.body.devices.opc.property.endpoint, 'opc.tcp://host');
        }
    });

    it('filters a request carrying an invalid-token-shaped header without rejecting Guest access', async function () {
        const response = await request(server, '/api/project', { 'x-access-token': 'invalid-token' });
        assert.equal(response.statusCode, 200);
        assert.equal(JSON.stringify(response.body).includes('device-pass'), false);
    });

    it('does not mutate the source project while filtering a project view', async function () {
        const original = JSON.stringify(project);
        const response = await request(server, '/api/project/view/v1');
        assert.equal(response.statusCode, 200);
        assert.equal(JSON.stringify(project), original);
    });
});
