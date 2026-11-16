'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const sinon = require('sinon');
const alarms = require('../../runtime/alarms');
const storage = require('../../runtime/alarms/alarmstorage');
const flush = () => new Promise(resolve => setImmediate(resolve));
const id = name => `${name}^~^highhigh`;

describe('Alarm acknowledgement permission preflight', () => {
    let workDir, manager;
    afterEach(async () => {
        if (manager) await manager.stop();
        await storage.close();
        sinon.restore();
        if (workDir) fs.rmSync(workDir, { recursive: true, force: true });
        manager = null;
    });

    async function fixture(roleMode = false, reversed = false) {
        workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fuxa-ack-permission-'));
        const events = new EventEmitter();
        let initialized;
        const ready = new Promise(resolve => { initialized = resolve; });
        const names = reversed ? ['restricted', 'permitted'] : ['permitted', 'restricted'];
        const definitions = names.map(name => ({
            name, property: {
                variableId: `device^~^${name}`, permission: name === 'permitted' ? 1 : 2,
                permissionRoles: { enabled: [name === 'permitted' ? 'operator' : 'engineer'] }
            },
            highhigh: { enabled: true, min: 90, max: 100, checkdelay: 1, timedelay: 0, ackmode: 'ackactive', text: name },
            high: { enabled: false }, low: { enabled: false }, info: { enabled: false }
        }));
        const runtime = {
            settings: { workDir, secureEnabled: true, userRole: roleMode }, events,
            logger: { info(message) { if (message === 'alarms.alarmstorage-init-successful!') initialized(); }, warn() {}, error() {} },
            devices: { getDeviceIdFromTag: () => 'device' },
            project: { getAlarms: async () => definitions },
            // Controlled identity and permission decisions; no login or provider activity.
            checkPermission(permission, context) {
                const enabled = permission === -1 || (roleMode
                    ? context.permissionRoles.enabled.some(role => permission.info.roles.includes(role))
                    : !!(context.permission & permission));
                return { show: true, enabled };
            }
        };
        manager = alarms.create(runtime);
        let tick;
        const timer = sinon.stub(global, 'setInterval').callsFake(callback => { tick = callback; return null; });
        manager.start();
        timer.restore();
        tick();
        await ready;
        await flush();
        await storage.setAlarms(names.map(name => ({
            getId: () => id(name), type: 'highhigh', status: 'N', ontime: 1700000000000,
            offtime: 0, acktime: 0, userack: '', value: 1,
            subproperty: { text: name, group: 'test' }
        })));
        const loaded = new Promise(resolve => events.once('alarms-status:changed', resolve));
        tick();
        await loaded;
        await flush();
        return roleMode ? { info: { roles: ['operator'] } } : 1;
    }

    function current() { return manager.getAlarmsValues(null, -1); }
    async function history() { return storage.getAlarmsHistory(0, Number.MAX_SAFE_INTEGER); }

    for (const roleMode of [false, true]) {
        for (const reversed of [false, true]) {
            it(`preserves a rejected bulk acknowledgement (${roleMode ? 'roles' : 'groups'}, restricted ${reversed ? 'first' : 'last'})`, async () => {
                const permission = await fixture(roleMode, reversed);
                const before = current();
                const storedBefore = await history();
                await assert.rejects(manager.setAlarmAck(null, 'operator-user', permission), error => error.code === 401);
                assert.deepEqual(current(), before);
                assert.deepEqual(await history(), storedBefore);
                await manager.setAlarmAck(null, 'admin-user', -1);
                const rows = await history();
                assert.equal(rows.length, 2);
                assert.ok(rows.every(row => row.acktime > 0 && row.userack === 'admin-user'));
            });
        }
    }
    it('acknowledges a permitted individual without changing the restricted alarm', async () => {
        const permission = await fixture();
        assert.equal(await manager.setAlarmAck(id('permitted'), 'operator-user', permission), true);
        const rows = await history();
        assert.equal(rows.find(row => row.nametype === id('permitted')).userack, 'operator-user');
        assert.equal(rows.find(row => row.nametype === id('restricted')).acktime, 0);
    });
    it('acknowledges the complete batch for an administrator', async () => {
        await fixture();
        assert.equal(await manager.setAlarmAck(null, 'admin-user', -1), true);
        assert.ok((await history()).every(row => row.userack === 'admin-user'));
    });
    it('rejects a restricted individual without changing memory or history', async () => {
        const permission = await fixture();
        const before = current();
        const rows = await history();
        await assert.rejects(manager.setAlarmAck(id('restricted'), 'operator-user', permission), error => error.code === 401);
        assert.deepEqual(current(), before);
        assert.deepEqual(await history(), rows);
    });
    it('returns false for an unknown alarm without modifying history', async () => {
        const permission = await fixture();
        const rows = await history();
        assert.equal(await manager.setAlarmAck(id('unknown'), 'operator-user', permission), false);
        assert.deepEqual(await history(), rows);
    });
});
