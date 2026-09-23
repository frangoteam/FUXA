'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const alarmstorage = require('../../runtime/alarms/alarmstorage');
const alarms = require('../../runtime/alarms');
const Report = require('../../runtime/jobs/report');

function makeLogger() {
    return {
        info: () => {},
        warn: () => {},
        error: () => {}
    };
}

function makeStoredAlarm(id, type, ontime, value = 1) {
    return {
        getId: () => id,
        type,
        status: 'active',
        ontime,
        offtime: 0,
        acktime: 0,
        userack: '',
        value,
        toremove: false,
        subproperty: { group: 'default', text: id }
    };
}

function makeRuntime(settings, projectAlarms) {
    return {
        settings,
        logger: makeLogger(),
        project: {
            getAlarms: () => Promise.resolve(projectAlarms)
        },
        devices: {
            getDeviceIdFromTag: () => 'device-a'
        },
        checkPermission(userPermission, context) {
            if (userPermission === -1 || userPermission === 255 || !context) {
                return { show: true, enabled: true };
            }
            const contextPermission = settings.userRole ? context.permissionRoles : context.permission;
            if (settings.userRole) {
                if (!userPermission?.info?.roles) {
                    return { show: !contextPermission?.show?.length, enabled: !contextPermission?.enabled?.length };
                }
                return {
                    show: contextPermission?.show?.length ? userPermission.info.roles.some(role => contextPermission.show.includes(role)) : true,
                    enabled: contextPermission?.enabled?.length ? userPermission.info.roles.some(role => contextPermission.enabled.includes(role)) : true
                };
            }
            const showMask = contextPermission >> 8;
            const enabledMask = contextPermission & 255;
            return {
                show: showMask ? !!(showMask & userPermission) : true,
                enabled: enabledMask ? !!(enabledMask & userPermission) : true
            };
        }
    };
}

function makeProjectAlarm(name, variableId, property, highhigh = {}) {
    return {
        name,
        property: Object.assign({ variableId }, property),
        highhigh: Object.assign({
            enabled: true,
            checkdelay: 1,
            timedelay: 0,
            min: 90,
            max: 100,
            ackmode: 'ackactive',
            text: `${name} highhigh`,
            group: 'default',
            bkcolor: '#ffffff',
            color: '#000000'
        }, highhigh),
        high: { enabled: false },
        low: { enabled: false },
        info: { enabled: false }
    };
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

describe('Alarms history', () => {
    let expect;
    let workDir;
    let manager;
    let storageOpen;

    before(async () => {
        const chai = await import('chai');
        expect = chai.expect;
    });

    afterEach(() => {
        if (manager) {
            manager.stop();
        }
        if (storageOpen) {
            alarmstorage.close();
        }
        if (workDir) {
            try { fs.rmSync(workDir, { recursive: true, force: true }); } catch (_) {}
        }
        workDir = null;
        manager = null;
        storageOpen = false;
    });

    async function initManager(settings, projectAlarms, storedAlarms) {
        workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fuxa-alarm-history-'));
        const runtime = makeRuntime(Object.assign({ workDir }, settings), projectAlarms);
        manager = alarms.create(runtime);
        await alarmstorage.init(runtime.settings, runtime.logger);
        storageOpen = true;
        await alarmstorage.setAlarms(storedAlarms || projectAlarms.map((alarm, index) =>
            makeStoredAlarm(`${alarm.name}^~^highhigh`, 'highhigh', 1710000000000 + index)
        ));
        manager.start();
        await delay(2300);
        manager.stop();
    }

    describe('manager history', () => {
        it('maps stored alarm rows to alarm history entries', async () => {
            const projectAlarm = makeProjectAlarm(
                'temperature-alarm',
                'device-a^~^temperature',
                {},
                { text: 'Temperature high', group: 'boiler', bkcolor: '#ff0000', color: '#ffffff' }
            );

            await initManager({}, [projectAlarm], [
                makeStoredAlarm('temperature-alarm^~^highhigh', 'highhigh', 1710000000000, 42)
            ]);

            const history = await manager.getAlarmsHistory({ start: 0, end: Number.MAX_SAFE_INTEGER });

            expect(history).to.have.length(1);
            expect(history[0]).to.include({
                name: 'temperature-alarm',
                type: 'highhigh',
                status: 'active',
                text: 'temperature-alarm^~^highhigh',
                group: 'default',
                value: '42',
                bkcolor: '#ff0000',
                color: '#ffffff'
            });
            expect(history[0].ontime).to.equal(1710000000000);
        });

        it('returns only history entries inside the requested time range', async () => {
            const alarmA = makeProjectAlarm('old-alarm', 'device-a^~^tag-a', {});
            const alarmB = makeProjectAlarm('current-alarm', 'device-a^~^tag-b', {});

            await initManager({}, [alarmA, alarmB], [
                makeStoredAlarm('old-alarm^~^highhigh', 'highhigh', 1710000000000),
                makeStoredAlarm('current-alarm^~^highhigh', 'highhigh', 1710000001000)
            ]);

            const history = await manager.getAlarmsHistory({ start: 1710000001000, end: 1710000001000 });

            expect(history.map(alarm => alarm.name)).to.deep.equal(['current-alarm']);
        });
    });

    describe('authorization', () => {
        it('filters alarm history by group permission bitmask', async () => {
            const alarmA = makeProjectAlarm('visible-alarm', 'device-a^~^tag-a', { permission: 1 << 8 });
            const alarmB = makeProjectAlarm('hidden-alarm', 'device-a^~^tag-b', { permission: 2 << 8 });

            await initManager({ secureEnabled: true, userRole: false }, [alarmA, alarmB]);

            const group1History = await manager.getAlarmsHistory({ start: 0, end: Number.MAX_SAFE_INTEGER }, 1);
            const group2History = await manager.getAlarmsHistory({ start: 0, end: Number.MAX_SAFE_INTEGER }, 2);
            const group3History = await manager.getAlarmsHistory({ start: 0, end: Number.MAX_SAFE_INTEGER }, 4);

            expect(group1History.map(alarm => alarm.name)).to.deep.equal(['visible-alarm']);
            expect(group2History.map(alarm => alarm.name)).to.deep.equal(['hidden-alarm']);
            expect(group3History).to.deep.equal([]);
        });

        it('filters alarm history by role permission', async () => {
            const alarmA = makeProjectAlarm('operator-alarm', 'device-a^~^tag-a', { permissionRoles: { show: ['operator'], enabled: [] } });
            const alarmB = makeProjectAlarm('engineer-alarm', 'device-a^~^tag-b', { permissionRoles: { show: ['engineer'], enabled: [] } });

            await initManager({ secureEnabled: true, userRole: true }, [alarmA, alarmB]);

            const operatorHistory = await manager.getAlarmsHistory({ start: 0, end: Number.MAX_SAFE_INTEGER }, { info: { roles: ['operator'] }, groups: 1 });
            const engineerHistory = await manager.getAlarmsHistory({ start: 0, end: Number.MAX_SAFE_INTEGER }, { info: { roles: ['engineer'] }, groups: 2 });
            const viewerHistory = await manager.getAlarmsHistory({ start: 0, end: Number.MAX_SAFE_INTEGER }, { info: { roles: ['viewer'] }, groups: 4 });

            expect(operatorHistory.map(alarm => alarm.name)).to.deep.equal(['operator-alarm']);
            expect(engineerHistory.map(alarm => alarm.name)).to.deep.equal(['engineer-alarm']);
            expect(viewerHistory).to.deep.equal([]);
        });

        it('keeps admin alarm history unfiltered', async () => {
            const alarmA = makeProjectAlarm('visible-alarm', 'device-a^~^tag-a', { permission: 1 << 8 });
            const alarmB = makeProjectAlarm('hidden-alarm', 'device-a^~^tag-b', { permission: 2 << 8 });

            await initManager({ secureEnabled: true, userRole: false }, [alarmA, alarmB]);

            const adminHistory = await manager.getAlarmsHistory({ start: 0, end: Number.MAX_SAFE_INTEGER }, -1);

            expect(adminHistory.map(alarm => alarm.name).sort()).to.deep.equal(['hidden-alarm', 'visible-alarm']);
        });
    });

    describe('report integration', () => {
        it('loads alarm history with admin permission', async () => {
            workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fuxa-report-alarms-'));
            const calls = [];
            const runtime = {
                settings: { reportsDir: workDir },
                logger: makeLogger(),
                alarmsMgr: {
                    getAlarmsHistory: (query, permission) => {
                        calls.push({ query, permission });
                        return Promise.resolve([{
                            name: 'hidden-alarm',
                            type: 'highhigh',
                            status: 'active',
                            text: 'Hidden alarm',
                            group: 'default',
                            ontime: 1710000000000,
                            bkcolor: '#ffffff',
                            color: '#000000'
                        }]);
                    }
                }
            };
            const report = Report.create({
                name: 'alarm-report',
                scheduling: 'none',
                docproperty: {},
                content: {
                    items: [{
                        type: 'alarms',
                        range: 'day',
                        size: 8,
                        propertyText: { ontime: 'On time', text: 'Text' },
                        property: { ontime: true, text: true },
                        priority: { highhigh: true },
                        priorityText: { highhigh: 'High high' },
                        statusText: { active: 'Active' }
                    }]
                }
            }, runtime);

            const filepath = await report.execute(new Date(2024, 2, 10, 2, 30, 0), true);

            expect(calls).to.have.length(1);
            expect(calls[0].permission).to.equal(-1);
            expect(fs.existsSync(filepath)).to.equal(true);
        });
    });
});
