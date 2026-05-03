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
        const app = makeApp(makeRuntime(calls, existingData), { id: 'alice', groups: 1 });

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

        expect(res.statusCode).to.equal(401);
        expect(calls.set).to.have.length(0);
    });

    it('allows scheduler settings writes from admin users', async () => {
        const calls = { set: [], delete: [] };
        const app = makeApp(makeRuntime(calls), { id: 'admin', groups: -1 });

        const res = await request(app, 'POST', '/api/scheduler', makeSchedulerBody());

        expect(res.statusCode).to.equal(200);
        expect(calls.set).to.have.length(1);
    });

    it('rejects scheduler deletes from authenticated non-admin users', async () => {
        const calls = { set: [], delete: [] };
        const app = makeApp(makeRuntime(calls), { id: 'alice', groups: 1 });

        const res = await request(app, 'DELETE', '/api/scheduler?id=sched-1');

        expect(res.statusCode).to.equal(401);
        expect(calls.delete).to.have.length(0);
    });
});
