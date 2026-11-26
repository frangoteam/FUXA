'use strict';

const { EventEmitter } = require('events');
const schedule = require('node-schedule');
const sinon = require('sinon');
const schedulerService = require('../../runtime/scheduler/scheduler-service');

function makeLogger() {
    return { info() {}, warn() {}, error() {} };
}

function schedulerData(devices) {
    const schedules = {};
    for (const device of devices) {
        schedules[device.name] = [{
            id: `event-${device.name}`,
            deviceName: device.name,
            variableId: device.variableId,
            startTime: '23:59',
            endTime: '23:59',
            days: [true, true, true, true, true, true, true]
        }];
    }
    return {
        settings: { devices: devices.map(device => ({ ...device })), deviceActions: [] },
        schedules
    };
}

function makeFixture(initialDevices) {
    const rows = new Map([['scheduler-1', schedulerData(initialDevices)]]);
    const writes = [];
    const project = {
        hmi: { views: [{ items: {
            'scheduler-1': {
                id: 'scheduler-1',
                type: 'svg-ext-own_ctrl-scheduler',
                property: { devices: initialDevices.map(device => ({ ...device })), deviceActions: [] }
            }
        } }] }
    };
    const runtime = {
        project: { getProject: async () => project },
        schedulerStorage: {
            getAllSchedulers: async () => Array.from(rows, ([id, data]) => ({ id, data: structuredClone(data) })),
            getSchedulerData: async id => rows.has(id) ? structuredClone(rows.get(id)) : null,
            setSchedulerData: async (id, data) => {
                rows.set(id, structuredClone(data));
                return { changes: 1 };
            },
            deleteSchedulerData: async id => ({ changes: rows.delete(id) ? 1 : 0 })
        },
        devices: {
            setTagValue: async (id, value) => { writes.push({ id, value }); return true; },
            getDeviceIdFromTag: id => id.split('.')[0],
            getDeviceValue: () => null,
            getDevicesValues: () => ({})
        },
        events: new EventEmitter(),
        io: new EventEmitter(),
        scriptsMgr: { runScript: async () => {} },
        logger: makeLogger()
    };
    return { runtime, rows, writes, project };
}

describe('Scheduler persistence reconciliation', () => {
    let expect;
    let scheduleJobStub;
    let jobs;

    before(async () => {
        const chai = await import('chai');
        expect = chai.expect;
    });

    beforeEach(() => {
        jobs = [];
        scheduleJobStub = sinon.stub(schedule, 'scheduleJob').callsFake(() => {
            const job = { cancel: sinon.spy(() => true) };
            jobs.push(job);
            return job;
        });
    });

    afterEach(() => {
        schedulerService.stopAllSchedulers();
        scheduleJobStub.restore();
    });

    it('drops removed devices and cancels/rebuilds their jobs when the project view is saved', async () => {
        const pump = { name: 'Pump', variableId: 'device.pump' };
        const lamp = { name: 'Lamp', variableId: 'device.lamp' };
        const { runtime, rows, writes, project } = makeFixture([pump, lamp]);
        await schedulerService.init({}, runtime.logger, runtime);
        await schedulerService.loadSchedulers();
        expect(jobs).to.have.length(4);

        project.hmi.views[0].items['scheduler-1'].property.devices = [pump];
        await schedulerService.reconcileProjectSchedulers();

        const persisted = await runtime.schedulerStorage.getSchedulerData('scheduler-1');
        expect(persisted.settings.devices.map(device => device.name)).to.deep.equal(['Pump']);
        expect(Object.keys(persisted.schedules)).to.deep.equal(['Pump']);
        expect(writes).to.deep.include({ id: 'device.lamp', value: 0 });
        expect(jobs.slice(0, 4).every(job => job.cancel.called)).to.equal(true);
        expect(jobs.slice(4).every(job => !job.cancel.called)).to.equal(true);
        expect(jobs).to.have.length(6); // Rebuilt jobs belong only to the remaining device.
        expect(rows.has('scheduler-1')).to.equal(true);
    });

    it('deletes orphaned scheduler data and stops its jobs when the control is removed', async () => {
        const pump = { name: 'Pump', variableId: 'device.pump' };
        const { runtime, rows, writes, project } = makeFixture([pump]);
        await schedulerService.init({}, runtime.logger, runtime);
        await schedulerService.loadSchedulers();
        expect(jobs).to.have.length(2);

        project.hmi.views[0].items = {};
        await schedulerService.reconcileProjectSchedulers();

        expect(await runtime.schedulerStorage.getSchedulerData('scheduler-1')).to.equal(null);
        expect(rows.has('scheduler-1')).to.equal(false);
        expect(writes).to.deep.include({ id: 'device.pump', value: 0 });
        expect(jobs.every(job => job.cancel.called)).to.equal(true);
    });

    it('reconciles orphaned persisted rows before recreating jobs at startup', async () => {
        const pump = { name: 'Pump', variableId: 'device.pump' };
        const { runtime, rows, writes, project } = makeFixture([pump]);
        project.hmi.views[0].items = {};
        await schedulerService.init({}, runtime.logger, runtime);

        await schedulerService.loadSchedulers();

        expect(rows.has('scheduler-1')).to.equal(false);
        expect(writes).to.deep.include({ id: 'device.pump', value: 0 });
        expect(scheduleJobStub.called).to.equal(false);
    });

    it('keeps scheduler devices and schedules when the project device inventory no longer contains them', async () => {
        const pump = { name: 'Pump', variableId: 'device.pump' };
        const { runtime, project } = makeFixture([pump]);
        project.devices = {};
        await schedulerService.init({}, runtime.logger, runtime);

        await schedulerService.reconcileProjectSchedulers();

        const persisted = await runtime.schedulerStorage.getSchedulerData('scheduler-1');
        expect(persisted.settings.devices).to.deep.equal([pump]);
        expect(persisted.schedules.Pump).to.have.length(1);
    });
});
