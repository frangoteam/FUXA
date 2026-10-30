'use strict';
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const sinon = require('sinon');

for (const [name, modulePath, delay] of [
    ['alarms', '../../runtime/alarms', 1000],
    ['notifications', '../../runtime/notificator', 20000],
    ['scripts', '../../runtime/scripts', 1000]
]) {
    describe(`${name} manager polling start lifecycle`, function () {
        let sandbox, active, created, manager;
        beforeEach(function () {
            sandbox = sinon.createSandbox(); active = new Set(); created = [];
            sandbox.stub(global, 'setInterval').callsFake((callback, interval) => {
                const timer = { callback, interval }; created.push(timer); active.add(timer); return timer;
            });
            sandbox.stub(global, 'clearInterval').callsFake(timer => active.delete(timer));
            manager = require(modulePath).create({ events: new EventEmitter(), settings: {},
                logger: { info() {}, warn() {}, error() {} } });
        });
        afterEach(async function () {
            try { await manager.stop(); } finally { sandbox.restore(); }
        });
        async function assertSettled(promise) {
            let settled = false;
            promise.then(() => { settled = true; });
            await Promise.resolve();
            assert.equal(settled, true, 'start must settle after registering its polling timer');
        }
        it('settles startup while retaining the original polling interval', async function () {
            const started = manager.start();
            assert.equal(created.length, 1); assert.equal(created[0].interval, delay);
            await assertSettled(started);
        });
        it('retains one stoppable timer across repeated starts', async function () {
            manager.start(); manager.start();
            assert.equal(active.size, 1, 'repeated start must not orphan a timer');
            await manager.stop(); assert.equal(active.size, 0);
            await manager.stop(); assert.equal(active.size, 0);
        });
        it('restarts with one fresh timer and settled completion', async function () {
            manager.start(); const previous = created[0]; await manager.stop();
            await assertSettled(manager.start());
            assert.equal(active.size, 1); assert.equal(active.has(previous), false);
            assert.equal(created.length, 2);
        });
        it('rejects a timer-registration error and can start after recovery', async function () {
            const error = new Error('controlled timer registration failure');
            global.setInterval.onFirstCall().throws(error);
            await assert.rejects(manager.start(), reason => reason === error);
            assert.equal(active.size, 0);
            manager.start(); assert.equal(active.size, 1);
        });
    });
}
