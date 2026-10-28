'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const express = require('express');
const sqlite = require('sqlite3');
const projectsApi = require('../../api/projects');

function request(server, method, route, value) {
    return new Promise((resolve, reject) => {
        const req = http.request({host: '127.0.0.1', port: server.address().port, method, path: route,
            headers: {'Content-Type': 'application/json'}}, res => {
            let body = '';
            res.on('data', chunk => { body += chunk; });
            res.on('end', () => resolve({status: res.statusCode, body: body ? JSON.parse(body) : null}));
        });
        req.on('error', reject);
        req.end(value ? JSON.stringify(value) : undefined);
    });
}

describe('Project API - save lazy view summaries', function () {
    let directory, project, storage, server, originalDevices;
    const views = [
        {id: 'v1', name: 'Main', type: 'svg', profile: {width: 1024}, svgcontent: '<svg><rect id="one"/></svg>', items: {one: {id: 'one', type: 'rect'}}},
        {id: 'v2', name: 'Second', type: 'svg', profile: {width: 800}, svgcontent: '<svg><circle id="two"/></svg>', items: {two: {id: 'two', type: 'circle'}}}
    ];
    beforeEach(async function () {
        originalDevices = process.env.DEVICES;
        delete process.env.DEVICES;
        directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fuxa-lazy-save-'));
        delete require.cache[require.resolve('../../runtime/project')];
        delete require.cache[require.resolve('../../runtime/project/prjstorage')];
        project = require('../../runtime/project');
        storage = require('../../runtime/project/prjstorage');
        const logger = {info() {}, error() {}, warn() {}};
        const runtime = {project, logger, settings: {lazyViewLoading: true},
            checkPermission: () => ({enabled: true, show: true}), restart: () => project.load()};
        await project.init({workDir: directory, appDir: directory}, logger, runtime);
        await project.setProject({hmi: {views}, devices: {device: {id: 'device', tags: {old: {id: 'old'}}}}});
        await project.load();
        projectsApi.init(runtime, (req, res, next) => { req.userId = 'fixture-admin'; next(); }, () => 255);
        const app = express();
        app.use(express.json());
        app.use(projectsApi.app());
        server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    });
    afterEach(async function () {
        if (server) await new Promise(resolve => server.close(resolve));
        const originalClose = sqlite.Database.prototype.close;
        try {
            await new Promise((resolve, reject) => {
                sqlite.Database.prototype.close = function () { return originalClose.call(this, err => err ? reject(err) : resolve()); };
                storage.close();
            });
        } finally {
            sqlite.Database.prototype.close = originalClose;
            fs.rmSync(directory, {recursive: true, force: true});
            if (originalDevices === undefined) delete process.env.DEVICES;
            else process.env.DEVICES = originalDevices;
        }
    });
    it('preserves unloaded view content while saving a new device tag', async function () {
        const summary = (await request(server, 'GET', '/api/project?views=lazy')).body;
        assert.equal(summary.hmi.views[0].lazy, true);
        assert.equal(summary.hmi.views[0].svgcontent, undefined);
        summary.devices.device.tags.added = {id: 'added', type: 'number'};
        assert.equal((await request(server, 'POST', '/api/project', summary)).status, 200);
        for (const view of views) assert.deepEqual((await request(server, 'GET', '/api/project/view/' + view.id)).body, view);
        assert.ok(project.getDevices().device.tags.added);
        const persisted = await storage.getSection(storage.TableType.VIEWS);
        assert.deepEqual(persisted.map(row => JSON.parse(row.value)).sort((a, b) => a.id.localeCompare(b.id)), views);
    });
    it('keeps edited full views and lazy metadata without mutating the caller', async function () {
        const summary = (await request(server, 'GET', '/api/project?views=lazy')).body;
        summary.hmi.views[0] = {...views[0], svgcontent: '<svg>edited</svg>'};
        summary.hmi.views[1].name = 'Renamed';
        const before = JSON.stringify(summary);
        await project.setProject(summary);
        assert.equal(JSON.stringify(summary), before);
        await project.load();
        assert.deepEqual(await project.getProjectView('v1', ['admin']), summary.hmi.views[0]);
        assert.deepEqual(await project.getProjectView('v2', ['admin']), {...views[1], name: 'Renamed'});
    });
    it('rejects an unknown lazy view before deleting stored project sections', async function () {
        const before = await storage.getSection(storage.TableType.VIEWS);
        const beforeDevices = await storage.getSection(storage.TableType.DEVICES);
        const summary = (await request(server, 'GET', '/api/project?views=lazy')).body;
        summary.hmi.views.push({id: 'missing', name: 'Missing', lazy: true});
        const response = await request(server, 'POST', '/api/project', summary);
        assert.equal(response.status, 400);
        assert.equal(response.body.error, 'lazy_view_not_found');
        assert.deepEqual(await storage.getSection(storage.TableType.VIEWS), before);
        assert.deepEqual(await storage.getSection(storage.TableType.DEVICES), beforeDevices);
        assert.deepEqual(await project.getProjectView('v1', ['admin']), views[0]);
    });
    it('still replaces views from a complete imported project', async function () {
        const imported = {id: 'new', name: 'Imported', type: 'svg', svgcontent: '<svg>new</svg>', items: {}};
        assert.equal((await request(server, 'POST', '/api/project', {devices: {}, hmi: {views: [imported]}})).status, 200);
        assert.deepEqual(await project.getProjectView('new', ['admin']), imported);
        assert.equal(await project.getProjectView('v1', ['admin']), null);
    });
});
