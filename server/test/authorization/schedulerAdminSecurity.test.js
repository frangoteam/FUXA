'use strict';

const http = require('http');
const express = require('express');

const schedulerApi = require('../../api/scheduler');

function makeLogger() {
    return {
        info: () => {},
        warn: () => {},
        error: () => {}
    };
}

function makeRuntime(calls, existingData = null) {
    return {
        project: {},
        settings: { secureEnabled: true },
        logger: makeLogger(),
        schedulerStorage: {
            getSchedulerData: () => Promise.resolve(existingData),
            setSchedulerData: (id, data) => {
                calls.set.push({ id, data });
                return Promise.resolve({ changes: 1 });
            },
            deleteSchedulerData: (id) => {
                calls.delete.push(id);
                return Promise.resolve({ changes: 1 });
            }
        },
        schedulerService: {
            updateScheduler: () => {},
            removeScheduler: () => Promise.resolve()
        }
    };
}

function makeApp(runtime, user) {
    const app = express();
    app.use(express.json());

    schedulerApi.init(
        runtime,
        (req, res, next) => {
            req.userId = user.id;
            req.userGroups = user.groups;
            req.isAuthenticated = user.id !== 'guest';
            next();
        },
        (req) => req.userGroups
    );

    app.use(schedulerApi.app());
    return app;
}

function request(app, method, path, body) {
    return new Promise((resolve, reject) => {
        const server = app.listen(0, () => {
            const data = body ? JSON.stringify(body) : '';
            const options = {
                method,
                port: server.address().port,
                path,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            };

            const req = http.request(options, (res) => {
                let responseBody = '';
                res.setEncoding('utf8');
                res.on('data', chunk => { responseBody += chunk; });
                res.on('end', () => {
                    server.close(() => {
                        resolve({ statusCode: res.statusCode, body: responseBody });
                    });
                });
            });

            req.on('error', (err) => {
                server.close(() => reject(err));
            });

            if (data) {
                req.write(data);
            }
            req.end();
        });
    });
}

function makeSchedulerBody() {
    return {
        id: 'sched-1',
        data: {
            schedules: {
                dev1: [{
                    id: 'evt1',
                    deviceName: 'dev1',
                    startTime: '00:00',
                    days: [true, true, true, true, true, true, true]
                }]
            },
            settings: {
                devices: [{ name: 'dev1', variableId: 'device.tag' }],
                deviceActions: [{
                    deviceName: 'dev1',
                    action: 'onSetValue',
                    actoptions: { variable: { variableId: 'device.tag' } },
                    actparam: '1'
                }]
            }
        }
    };
}

describe('Scheduler API authorization', () => {
    let expect;

    before(async () => {
        const chai = await import('chai');
        expect = chai.expect;
    });

    it('preserves scheduler settings when authenticated non-admin users update schedules', async () => {
        const existingData = makeSchedulerBody().data;
        const calls = { set: [], delete: [] };
        const runtime = makeRuntime(calls, existingData);
        runtime.project.getProject = () => Promise.resolve({ hmi: { views: [{ items: {
            'sched-1': { id: 'sched-1', property: { devices: [{ name: 'dev1' }] } }
        } }] } });
        runtime.checkPermission = () => ({ show: true, enabled: true });
        const app = makeApp(runtime, { id: 'alice', groups: 1 });

        const tamperedBody = makeSchedulerBody();
        tamperedBody.data.schedules.dev1[0].startTime = '12:00';
        tamperedBody.data.settings.deviceActions = [{
            deviceName: 'dev1',
            action: 'onRunScript',
            actoptions: { script: { id: 'evil' } }
        }];

        const res = await request(app, 'POST', '/api/scheduler', tamperedBody);

        expect(res.statusCode).to.equal(200);
        expect(calls.set).to.have.length(1);
        expect(calls.set[0].data.schedules.dev1[0].startTime).to.equal('12:00');
        expect(calls.set[0].data.settings.deviceActions).to.deep.equal(existingData.settings.deviceActions);
    });

    it('rejects scheduler writes from authenticated non-admin users when no admin settings exist', async () => {
        const calls = { set: [], delete: [] };
        const app = makeApp(makeRuntime(calls), { id: 'alice', groups: 1 });

        const res = await request(app, 'POST', '/api/scheduler', makeSchedulerBody());

        expect(res.statusCode).to.equal(403);
        expect(calls.set).to.have.length(0);
    });

    it('allows an authenticated user with scheduler permissions to create scheduler data', async () => {
        const calls = { set: [], delete: [] };
        const runtime = makeRuntime(calls);
        runtime.project.getProject = () => Promise.resolve({ hmi: { views: [{ items: {
            'sched-1': { id: 'sched-1', property: {
                devices: [{ name: 'dev1', variableId: 'device.tag' }],
                deviceActions: []
            } }
        } }] } });
        runtime.checkPermission = (userPermission, resource) => {
            expect(userPermission).to.equal(1);
            expect(resource).to.be.an('object');
            return { show: true, enabled: true };
        };
        const app = makeApp(runtime, { id: 'alice', groups: 1 });

        const res = await request(app, 'POST', '/api/scheduler', makeSchedulerBody());

        expect(res.statusCode, res.body).to.equal(200);
        expect(calls.set).to.have.length(1);
        expect(calls.set[0].data.settings.devices).to.deep.equal([
            { name: 'dev1', variableId: 'device.tag' }
        ]);
    });

    it('allows a user with role-based scheduler permissions to create scheduler data', async () => {
        const calls = { set: [], delete: [] };
        const runtime = makeRuntime(calls);
        runtime.settings.userRole = true;
        runtime.project.getProject = () => Promise.resolve({ hmi: { views: [{ items: {
            'sched-1': { id: 'sched-1', property: {
                permissionRoles: { show: ['operator'], enabled: ['operator'] },
                devices: [{ name: 'dev1', variableId: 'device.tag', permissionRoles: {
                    show: ['operator'], enabled: ['operator']
                } }],
                deviceActions: []
            } }
        } }] } });
        let receivedRoleContext = false;
        runtime.checkPermission = (userPermission, resource) => {
            if (userPermission?.info?.roles?.includes('operator') && resource.permissionRoles) {
                receivedRoleContext = true;
            }
            return { show: true, enabled: true };
        };
        const app = makeApp(runtime, {
            id: 'alice',
            groups: { info: { roles: ['operator'] } }
        });

        const res = await request(app, 'POST', '/api/scheduler', makeSchedulerBody());

        expect(res.statusCode).to.equal(200);
        expect(calls.set).to.have.length(1);
        expect(receivedRoleContext).to.equal(true);
    });

    it('rejects direct scheduler schedule writes from a guest even when the control has no restrictions', async () => {
        const calls = { set: [], delete: [] };
        const existingData = makeSchedulerBody().data;
        const app = makeApp(makeRuntime(calls, existingData), { id: 'guest', groups: ['guest'] });
        const body = makeSchedulerBody();
        body.data.schedules.dev1[0].startTime = '12:00';

        const res = await request(app, 'POST', '/api/scheduler', body);

        expect(res.statusCode).to.equal(401);
        expect(calls.set).to.have.length(0);
    });

    it('fails closed for authenticated scheduler writes when secure mode has no permission checker', async () => {
        const calls = { set: [], delete: [] };
        const existingData = makeSchedulerBody().data;
        const app = makeApp(makeRuntime(calls, existingData), { id: 'alice', groups: 1 });
        const body = makeSchedulerBody();
        body.data.schedules.dev1[0].startTime = '12:00';

        const res = await request(app, 'POST', '/api/scheduler', body);

        expect(res.statusCode).to.equal(403);
        expect(calls.set).to.have.length(0);
    });

    it('allows scheduler settings writes from admin users', async () => {
        const calls = { set: [], delete: [] };
        const app = makeApp(makeRuntime(calls), { id: 'admin', groups: -1 });

        const res = await request(app, 'POST', '/api/scheduler', makeSchedulerBody());

        expect(res.statusCode).to.equal(200);
        expect(calls.set).to.have.length(1);
    });

    it('rejects scheduler deletes from authenticated users without scheduler edit permission', async () => {
        const calls = { set: [], delete: [] };
        const runtime = makeRuntime(calls, makeSchedulerBody().data);
        runtime.project.getProject = () => Promise.resolve({ hmi: { views: [{ items: {
            'sched-1': { id: 'sched-1', property: { permission: 0x102, devices: [
                { name: 'dev1', variableId: 'device.tag', permission: 0x101 }
            ] } }
        } }] } });
        runtime.checkPermission = (_userPermission, resource) => resource.permission === 0x102
            ? { show: true, enabled: false }
            : { show: true, enabled: true };
        let removeCalls = 0;
        runtime.schedulerService.removeScheduler = async () => { removeCalls++; };
        const app = makeApp(runtime, { id: 'alice', groups: 1 });

        const res = await request(app, 'DELETE', '/api/scheduler?id=sched-1');

        expect(res.statusCode).to.equal(403);
        expect(calls.delete).to.have.length(0);
        expect(removeCalls).to.equal(0);
    });

    it('allows an authenticated user with scheduler and device edit permissions to delete scheduler data', async () => {
        const calls = { set: [], delete: [] };
        const runtime = makeRuntime(calls, makeSchedulerBody().data);
        runtime.project.getProject = () => Promise.resolve({ hmi: { views: [{ items: {
            'sched-1': { id: 'sched-1', property: { permission: 0x101, devices: [
                { name: 'dev1', variableId: 'device.tag', permission: 0x101 }
            ] } }
        } }] } });
        runtime.checkPermission = () => ({ show: true, enabled: true });
        let removeCalls = 0;
        runtime.schedulerService.removeScheduler = async () => { removeCalls++; };
        const app = makeApp(runtime, { id: 'alice', groups: 1 });

        const res = await request(app, 'DELETE', '/api/scheduler?id=sched-1');

        expect(res.statusCode).to.equal(200);
        expect(calls.delete).to.deep.equal(['sched-1']);
        expect(removeCalls).to.equal(1);
    });

    it('does not let a user delete scheduler data when a persisted device is read-only', async () => {
        const calls = { set: [], delete: [] };
        const existingData = makeSchedulerBody().data;
        existingData.settings.devices[0].permission = 'read-only';
        const runtime = makeRuntime(calls, existingData);
        runtime.project.getProject = () => Promise.resolve({ hmi: { views: [{ items: {
            'sched-1': { id: 'sched-1', property: { permission: 'editable', devices: [] } }
        } }] } });
        runtime.checkPermission = (_permission, property) => ({
            show: true,
            enabled: property.permission !== 'read-only'
        });
        let removeCalls = 0;
        runtime.schedulerService.removeScheduler = async () => { removeCalls++; };
        const app = makeApp(runtime, { id: 'alice', groups: 1 });

        const res = await request(app, 'DELETE', '/api/scheduler?id=sched-1');

        expect(res.statusCode).to.equal(403);
        expect(calls.delete).to.have.length(0);
        expect(removeCalls).to.equal(0);
    });

    it('applies role-based permissions when deleting scheduler data', async () => {
        const calls = { set: [], delete: [] };
        const runtime = makeRuntime(calls, makeSchedulerBody().data);
        runtime.settings.userRole = true;
        runtime.project.getProject = () => Promise.resolve({ hmi: { views: [{ items: {
            'sched-1': { id: 'sched-1', property: { permissionRoles: {
                show: ['operator'], enabled: ['operator']
            }, devices: [{ name: 'dev1', variableId: 'device.tag', permissionRoles: {
                show: ['operator'], enabled: ['operator']
            } }] } }
        } }] } });
        let receivedRoleContext = false;
        runtime.checkPermission = (userPermission, resource) => {
            if (userPermission?.info?.roles?.includes('operator') && resource.permissionRoles) {
                receivedRoleContext = true;
            }
            return { show: true, enabled: true };
        };
        let removeCalls = 0;
        runtime.schedulerService.removeScheduler = async () => { removeCalls++; };
        const app = makeApp(runtime, {
            id: 'alice',
            groups: { info: { roles: ['operator'] } }
        });

        const res = await request(app, 'DELETE', '/api/scheduler?id=sched-1');

        expect(res.statusCode).to.equal(200);
        expect(calls.delete).to.deep.equal(['sched-1']);
        expect(removeCalls).to.equal(1);
        expect(receivedRoleContext).to.equal(true);
    });

    it('allows reading a visible scheduler in read-only mode but rejects schedule writes', async () => {
        const existingData = makeSchedulerBody().data;
        const calls = { set: [], delete: [] };
        const runtime = makeRuntime(calls, existingData);
        runtime.project.getProject = () => Promise.resolve({ hmi: { views: [{ items: {
            scheduler: { id: 'sched-1', property: { permission: 'show-only', devices: [{ name: 'dev1' }] } }
        } }] } });
        runtime.checkPermission = (_permission, property) => property.permission === 'show-only'
            ? { show: true, enabled: false }
            : { show: true, enabled: true };
        const app = makeApp(runtime, { id: 'alice', groups: 1 });

        const get = await request(app, 'GET', '/api/scheduler?id=sched-1');
        expect(get.statusCode).to.equal(200);

        const body = makeSchedulerBody();
        body.data.schedules.dev1[0].startTime = '12:00';
        const post = await request(app, 'POST', '/api/scheduler', body);
        expect(post.statusCode).to.equal(403);
        expect(calls.set).to.have.length(0);
    });

    it('hides a scheduler when the user lacks show permission', async () => {
        const calls = { set: [], delete: [] };
        const runtime = makeRuntime(calls, makeSchedulerBody().data);
        runtime.project.getProject = () => Promise.resolve({ hmi: { views: [{ items: {
            scheduler: { id: 'sched-1', property: { permission: 'hidden', devices: [] } }
        } }] } });
        runtime.checkPermission = () => ({ show: false, enabled: false });
        const app = makeApp(runtime, { id: 'alice', groups: 1 });

        const res = await request(app, 'GET', '/api/scheduler?id=sched-1');
        expect(res.statusCode).to.equal(403);
    });

    it('rejects edits to a device that is visible but read-only', async () => {
        const existingData = makeSchedulerBody().data;
        const calls = { set: [], delete: [] };
        const runtime = makeRuntime(calls, existingData);
        runtime.project.getProject = () => Promise.resolve({ hmi: { views: [{ items: {
            scheduler: { id: 'sched-1', property: { permission: 'editable', devices: [
                { name: 'dev1', permission: 'device-readonly' }
            ] } }
        } }] } });
        runtime.checkPermission = (_permission, property) => ({
            show: true,
            enabled: property.permission !== 'device-readonly'
        });
        const app = makeApp(runtime, { id: 'alice', groups: 1 });

        const body = makeSchedulerBody();
        body.data.schedules.dev1[0].startTime = '12:00';
        const res = await request(app, 'POST', '/api/scheduler', body);
        expect(res.statusCode).to.equal(403);
        expect(calls.set).to.have.length(0);
    });

    it('evaluates scheduler permissions using the user roles context', async () => {
        const existingData = makeSchedulerBody().data;
        const calls = { set: [], delete: [] };
        const runtime = makeRuntime(calls, existingData);
        runtime.project.getProject = () => Promise.resolve({ hmi: { views: [{ items: {
            scheduler: { id: 'sched-1', property: {
                permissionRoles: { show: ['operator'], enabled: ['operator'] },
                devices: [{ name: 'dev1' }]
            } }
        } }] } });
        let receivedRoleContext = false;
        runtime.checkPermission = (userPermission, resource) => {
            if (userPermission?.info?.roles?.includes('operator') && resource.permissionRoles) {
                receivedRoleContext = true;
            }
            return { show: true, enabled: true };
        };
        const app = makeApp(runtime, { id: 'alice', groups: { info: { roles: ['operator'] } } });

        const body = makeSchedulerBody();
        body.data.schedules.dev1[0].startTime = '12:00';
        const res = await request(app, 'POST', '/api/scheduler', body);
        expect(res.statusCode).to.equal(200);
        expect(calls.set).to.have.length(1);
        expect(receivedRoleContext).to.equal(true);
    });
});
