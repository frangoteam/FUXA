'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const sinon = require('sinon');
const notificator = require('../../runtime/notificator');
const flush = () => new Promise(resolve => setImmediate(resolve));

function gate() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

describe('Alarm notification check completion', () => {
    let clock, manager, runtime, pending, sent, alarms, receiver;
    beforeEach(async () => {
        clock = sinon.useFakeTimers({ now: 1700000000000, toFake: ['Date'] });
        receiver = 'operator@example.test';
        pending = [];
        sent = [];
        alarms = [{ status: 'N', type: 'high' }];
        runtime = {
            events: new EventEmitter(), settings: {},
            logger: { info() {}, warn: sinon.spy(), error: sinon.spy() },
            project: { getNotifications: async () => [{
                id: 'alarm-notification', name: 'Alarm notification', enabled: true,
                type: 'alarm', receiver, delay: 0, interval: 0,
                subscriptions: { high: true, low: true }, mode: 1
            }] },
            alarmsMgr: {
                getAlarmsValues: () => alarms,
                getAlarmsString: category => `Active ${category} alarms`
            }
        };
        manager = runtime.notificatorMgr = notificator.create(runtime);
        for (const method of ['sendMail', 'postMessage']) {
            sinon.stub(manager, method).callsFake(message => {
                const delivery = gate();
                sent.push({ method, message });
                pending.push(delivery);
                return delivery.promise;
            });
        }
        manager.forceCheck();
        await flush(); // INIT
        manager.forceCheck();
        await flush(); // LOAD
        manager.forceCheck();
        await flush(); // establish delay start
        clock.tick(1);
    });
    afterEach(async () => {
        for (const delivery of pending) delivery.resolve();
        await flush();
        await manager.stop();
        sinon.restore();
    });
    it('does not duplicate mail while the first delivery is pending', async () => {
        manager.forceCheck();
        await flush();
        assert.equal(sent.length, 1);
        runtime.events.emit('alarms-status:changed');
        await flush();
        assert.equal(sent.length, 1);
        assert.equal(runtime.logger.warn.callCount, 1);
        pending[0].resolve();
        await flush();
        manager.forceCheck();
        await flush();
        assert.equal(sent.length, 1);
    });
    it('keeps the check busy until the last category finishes', async () => {
        alarms.push({ status: 'N', type: 'low' });
        manager.forceCheck();
        await flush(); // high sends; low establishes delay start
        assert.equal(sent.length, 1);
        pending[0].resolve();
        await flush();
        clock.tick(1);
        manager.forceCheck();
        await flush();
        assert.equal(sent.length, 2);
        runtime.events.emit('alarms-status:changed');
        await flush();
        assert.equal(sent.length, 2);
        pending[1].resolve();
        await flush();
        manager.forceCheck();
        await flush();
        assert.equal(sent.length, 2);
    });
    it('keeps the check busy after one category fails until the others finish', async () => {
        alarms.push({ status: 'N', type: 'low' });
        manager.reset();
        manager.forceCheck();
        await flush(); // LOAD
        manager.forceCheck();
        await flush(); // establish both delay starts
        clock.tick(1);
        manager.forceCheck();
        await flush();
        assert.equal(sent.length, 2);
        runtime.logger.error = sinon.stub().throws(new Error('controlled unexpected failure'));
        pending[0].reject(new Error('controlled delivery failure'));
        await flush();
        runtime.events.emit('alarms-status:changed');
        await flush();
        assert.equal(sent.length, 2);
        assert.equal(runtime.logger.warn.callCount, 1);
        pending[1].resolve();
        await flush();
        manager.forceCheck();
        await flush();
        assert.equal(runtime.logger.warn.callCount, 1);
    });
    it('does not duplicate webhook delivery while it is pending', async () => {
        receiver = 'https://example.test/notify?content=${content}';
        manager.reset();
        manager.forceCheck();
        await flush();
        manager.forceCheck();
        await flush();
        clock.tick(1);
        manager.forceCheck();
        await flush();
        assert.equal(sent.length, 1);
        assert.equal(sent[0].method, 'postMessage');
        assert.equal(sent[0].message, 'https://example.test/notify?content=Active high alarms');
        manager.forceCheck();
        await flush();
        assert.equal(sent.length, 1);
        pending[0].resolve();
        await flush();
        manager.forceCheck();
        await flush();
        assert.equal(sent.length, 1);
    });
    it('releases checks with no active alarms before the next alarm', async () => {
        alarms = [];
        manager.forceCheck();
        await flush();
        assert.equal(sent.length, 0);
        alarms = [{ status: 'N', type: 'high' }];
        manager.forceCheck();
        await flush();
        clock.tick(1);
        manager.forceCheck();
        await flush();
        assert.equal(sent.length, 1);
    });
    it('releases the check after a rejected delivery so it can retry', async () => {
        manager.forceCheck();
        await flush();
        pending[0].reject(new Error('controlled delivery failure'));
        await flush();
        assert.equal(runtime.logger.error.callCount, 1);
        manager.forceCheck();
        await flush();
        assert.equal(sent.length, 2);
        pending[1].resolve();
        await flush();
        manager.forceCheck();
        await flush();
        assert.equal(sent.length, 2);
    });
    it('can reset an inactive category after delivery finishes', async () => {
        manager.forceCheck();
        await flush();
        pending[0].resolve();
        await flush();
        alarms = [];
        manager.forceCheck();
        await flush();
        alarms = [{ status: 'N', type: 'high' }];
        manager.forceCheck();
        await flush();
        clock.tick(1);
        manager.forceCheck();
        await flush();
        assert.equal(sent.length, 2);
    });
});
