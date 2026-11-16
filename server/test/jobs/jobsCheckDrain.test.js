'use strict';
const assert = require('node:assert/strict');
const sinon = require('sinon');
const Jobs = require('../../runtime/jobs');
const Report = require('../../runtime/jobs/report');
const Cleaner = require('../../runtime/jobs/cleaner');
const turn = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

describe('jobs manager drains failed check batches', function () {
    let sandbox, manager, tick, first, second, calls, errors;
    beforeEach(async function () {
        sandbox = sinon.createSandbox();
        first = deferred(); second = deferred(); calls = [0, 0]; errors = [];
        sandbox.stub(global, 'setInterval').callsFake(callback => { tick = callback; return {}; });
        sandbox.stub(global, 'clearInterval');
        sandbox.stub(Cleaner, 'create').returns({ getProperty: () => ({}), execute: () => Promise.resolve() });
        sandbox.stub(Report, 'create').callsFake(property => ({
            getProperty: () => property,
            execute() {
                const index = property.id === 'a' ? 0 : 1;
                calls[index]++;
                return calls[index] === 1 ? [first, second][index].promise : Promise.resolve();
            }
        }));
        manager = Jobs.create({ events: {}, logger: { info() {}, warn() {}, error(value) { errors.push(value); } },
            project: { getReports: () => Promise.resolve([{ id: 'a', scheduling: 'day' }, { id: 'b', scheduling: 'day' }]) } });
        manager.start(); // Existing start promise is deliberately outside this contract.
        tick(); await turn(); // INIT
        tick(); await turn(); // LOAD
        tick(); await turn(); // First scheduled batch
        assert.deepEqual(calls, [1, 1]);
    });
    afterEach(async function () {
        first.resolve(); second.resolve(); await turn();
        await manager.stop(); sandbox.restore();
    });
    async function forceCheck() {
        assert.equal(manager.forceReport({ id: 'a' }), true);
        tick(); await turn();
    }
    for (const failing of [0, 1]) {
        it(`does not rerun a pending report after report ${failing} rejects`, async function () {
            const gates = [first, second];
            gates[failing].reject(new Error('controlled first failure'));
            await turn();
            await forceCheck();
            assert.deepEqual(calls, [1, 1], 'a failed sibling must not unlock the running batch');
            gates[1 - failing].resolve(); await turn();
            await forceCheck();
            assert.deepEqual(calls, [2, 2], 'the next batch must be allowed after all jobs settle');
            assert.equal(errors.length, 1);
            assert.match(errors[0], /controlled first failure/);
        });
    }
    it('keeps successful batches busy until all jobs complete', async function () {
        first.resolve(); await turn(); await forceCheck();
        assert.deepEqual(calls, [1, 1]);
        second.resolve(); await turn(); await forceCheck();
        assert.deepEqual(calls, [2, 2]); assert.deepEqual(errors, []);
    });
    it('retains the first rejection when another job also fails', async function () {
        second.reject(new Error('first temporal failure')); await turn();
        first.reject(new Error('later failure')); await turn();
        await forceCheck();
        assert.deepEqual(calls, [2, 2]);
        assert.equal(errors.length, 1);
        assert.match(errors[0], /first temporal failure/);
        assert.doesNotMatch(errors[0], /later failure/);
    });
});
