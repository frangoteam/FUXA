'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const alarmstorage = require('../../runtime/alarms/alarmstorage');
const alarms = require('../../runtime/alarms');

function makeLogger() {
    return {
        info: () => {},
        warn: () => {},
        error: () => {}
    };
}

function makeStoredAlarm(id, type) {
    return {
        getId: () => id,
        type,
        status: 'N',
        ontime: 1710000000000,
        offtime: 0,
        acktime: 0,
        userack: '',
        value: 1,
        toremove: false,
        subproperty: { group: 'default', text: id }
    };
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

function makeProjectAlarm(name, variableId, property) {
    return {
        name,
        property: Object.assign({ variableId }, property),
        highhigh: { enabled: true, checkdelay: 1, timedelay: 0, min: 90, max: 100, ackmode: 'ackactive', text: `${name} highhigh` },
        high: { enabled: false },
        low: { enabled: false },
        info: { enabled: false }
    };
}

describe('Alarms status authorization', () => {
    let expect;
    let workDir;
    let manager;

    before(async () => {
        const chai = await import('chai');
        expect = chai.expect;
    });

    afterEach(() => {
        if (manager) {
            manager.stop();
        }
        alarmstorage.close();
        if (workDir) {
            try { fs.rmSync(workDir, { recursive: true, force: true }); } catch (_) {}
        }
        workDir = null;
        manager = null;
    });

    async function initManager(settings, projectAlarms) {
        workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fuxa-alarm-status-'));
        const runtime = makeRuntime(Object.assign({ workDir }, settings), projectAlarms);
        manager = alarms.create(runtime);
        await alarmstorage.init(runtime.settings, runtime.logger);
        await alarmstorage.setAlarms(projectAlarms.map(alarm => makeStoredAlarm(`${alarm.name}^~^highhigh`, 'highhigh')));
        manager.start();
        await delay(2300);
        manager.stop();
    }

    it('filters alarm status counts by group permission bitmask', async () => {
        const alarmA = makeProjectAlarm('visible-alarm', 'device-a^~^tag-a', { permission: 1 << 8 });
        const alarmB = makeProjectAlarm('hidden-alarm', 'device-a^~^tag-b', { permission: 2 << 8 });

        await initManager({ secureEnabled: true, userRole: false }, [alarmA, alarmB]);

        const visibleToGroup1 = await manager.getAlarmsStatus(1);
        const visibleToGroup2 = await manager.getAlarmsStatus(2);
        const visibleToGroup3 = await manager.getAlarmsStatus(4);

        expect(visibleToGroup1.highhigh).to.equal(1);
        expect(visibleToGroup2.highhigh).to.equal(1);
        expect(visibleToGroup3.highhigh).to.equal(0);
        expect(visibleToGroup1.actions).to.deep.equal([]);
        expect(visibleToGroup2.actions).to.deep.equal([]);
    });

    it('filters alarm status counts by role permission', async () => {
        const alarmA = makeProjectAlarm('operator-alarm', 'device-a^~^tag-a', { permissionRoles: { show: ['operator'], enabled: [] } });
        const alarmB = makeProjectAlarm('engineer-alarm', 'device-a^~^tag-b', { permissionRoles: { show: ['engineer'], enabled: [] } });

        await initManager({ secureEnabled: true, userRole: true }, [alarmA, alarmB]);

        const operatorStatus = await manager.getAlarmsStatus({ info: { roles: ['operator'] }, groups: 1 });
        const engineerStatus = await manager.getAlarmsStatus({ info: { roles: ['engineer'] }, groups: 2 });
        const viewerStatus = await manager.getAlarmsStatus({ info: { roles: ['viewer'] }, groups: 4 });

        expect(operatorStatus.highhigh).to.equal(1);
        expect(engineerStatus.highhigh).to.equal(1);
        expect(viewerStatus.highhigh).to.equal(0);
    });

    it('keeps admin alarm status unfiltered', async () => {
        const alarmA = makeProjectAlarm('visible-alarm', 'device-a^~^tag-a', { permission: 1 << 8 });
        const alarmB = makeProjectAlarm('hidden-alarm', 'device-a^~^tag-b', { permission: 2 << 8 });

        await initManager({ secureEnabled: true, userRole: false }, [alarmA, alarmB]);

        const adminStatus = await manager.getAlarmsStatus(-1);

        expect(adminStatus.highhigh).to.equal(2);
    });
});
