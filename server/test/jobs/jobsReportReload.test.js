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
const report = id => ({ id, scheduling: 'day' });

describe('jobs manager report edits during loading', function () {
    let sandbox, manager, tick, reads, gates, executions;
    beforeEach(async function () {
        sandbox = sinon.createSandbox(); reads = 0; gates = []; executions = [];
        sandbox.stub(global, 'setInterval').callsFake(callback => { tick = callback; return {}; });
        sandbox.stub(global, 'clearInterval');
        sandbox.stub(Cleaner, 'create').returns({ getProperty: () => null, execute: () => Promise.resolve() });
        sandbox.stub(Report, 'create').callsFake(property => ({ getProperty: () => property,
            execute() { executions.push(property.id); return Promise.resolve(); } }));
        manager = Jobs.create({ events: {}, logger: { info() {}, warn() {}, error() {} },
            project: { getReports() { reads++; const gate = deferred(); gates.push(gate); return gate.promise; } } });
        manager.start(); // Startup completion is a separate contract.
        tick(); await turn(); // INIT -> LOAD
        tick(); await turn(); // Pending project read
        assert.equal(reads, 1);
    });
    afterEach(async function () {
        gates.forEach(gate => gate.resolve([])); await turn();
        await manager.stop(); sandbox.restore();
    });
    for (const resets of [1, 3]) {
        it(`reloads the latest reports after ${resets} edit notification(s) during a read`, async function () {
            for (let i = 0; i < resets; i++) manager.reset();
            gates[0].resolve([report('deleted-or-replaced')]); await turn();
            tick(); await turn();
            assert.equal(reads, 2, 'the edit must trigger a fresh project read');
            assert.deepEqual(executions, [], 'stale reports must not run before reloading');
            gates[1].resolve([report('latest')]); await turn();
            assert.equal(manager.forceReport({ id: 'deleted-or-replaced' }), false);
            assert.equal(manager.forceReport({ id: 'latest' }), true);
            tick(); await turn();
            assert.deepEqual(executions, ['latest']);
        });
    }
    it('retains an edit queued after the project read resolves', async function () {
        gates[0].resolve([report('previous')]);
        await Promise.resolve(); // Project results processed; manager completion still queued.
        manager.reset(); await turn();
        tick(); await turn(); assert.equal(reads, 2);
        gates[1].resolve([report('edited')]); await turn();
        assert.equal(manager.forceReport({ id: 'previous' }), false);
        assert.equal(manager.forceReport({ id: 'edited' }), true);
    });
    it('keeps ordinary loading and subsequent idle checks unchanged', async function () {
        gates[0].resolve([report('current')]); await turn();
        assert.equal(manager.forceReport({ id: 'current' }), true);
        tick(); await turn();
        assert.deepEqual(executions, ['current']); assert.equal(reads, 1);
    });
    it('retries after an edited project read rejects', async function () {
        manager.reset(); gates[0].reject(new Error('controlled project read failure')); await turn();
        tick(); await turn(); assert.equal(reads, 2);
        gates[1].resolve([report('recovered')]); await turn();
        assert.equal(manager.forceReport({ id: 'recovered' }), true);
        tick(); await turn(); assert.deepEqual(executions, ['recovered']);
    });
});
