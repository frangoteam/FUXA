'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const fixture = String.raw`
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const sinon = require('sinon');
const schedule = require('node-schedule');
const scripts = require('./runtime/scripts');
const [mode, outcome] = process.argv.slice(1);
(async () => {
    const sandbox = sinon.createSandbox(), errors = [], calls = [], callbacks = [];
    let poll, manager;
    try {
        sandbox.stub(global, 'setInterval').callsFake(callback => { poll = callback; return {}; });
        sandbox.stub(global, 'clearInterval');
        sandbox.stub(schedule, 'gracefulShutdown').resolves();
        sandbox.stub(schedule, 'scheduleJob').callsFake((rule, callback) => { callbacks.push(callback); return { cancel() {} }; });
        sandbox.useFakeTimers({ now: 10000, toFake: ['Date'] });
        const script = { id: 'scheduled', name: 'scheduled', mode: 'SERVER', parameters: [],
            sync: outcome === 'sync',
            code: "$setTag('executed', true); return " + (outcome === 'reject' ? "Promise.reject(new Error('controlled scheduled failure'));" : "42;"),
            scheduling: mode === 'cron' ? { mode: 'scheduling', schedules: [{ type: 1, minute: 5 }] } : { mode, interval: 1 } };
        manager = scripts.create({ events: new EventEmitter(), settings: {},
            logger: { info() {}, warn() {}, error(error) { errors.push(error); } },
            devices: { setTagValue(...args) { calls.push(args); } },
            project: { async getScripts() { return [script]; } } });
        manager.start();
        const settle = () => new Promise(resolve => setImmediate(resolve));
        poll(); await settle(); // actual module initialization
        poll(); await settle(); // compile actual saved script and load schedule
        sandbox.clock.setSystemTime(12000);
        if (mode === 'cron') { assert.equal(callbacks.length, 1); callbacks[0](); }
        else poll();
        await settle();
        assert.deepEqual(calls, [['executed', true]]);
        if (outcome === 'reject') {
            assert.equal(errors.length, 1, 'the rejected scheduled execution must be logged');
            assert.equal(errors[0].message || errors[0], 'controlled scheduled failure');
        } else assert.deepEqual(errors, []);
        if (mode !== 'cron') { poll(); await settle(); assert.equal(calls.length, 1, 'same-tick poll must retain the interval/start boundary'); }
    } finally {
        if (manager) await manager.stop();
        sandbox.restore();
    }
    console.log('ok');
})().catch(error => { console.error(error); process.exitCode = 1; });
`;

describe('Scheduled script Promise rejection handling', function () {
    for (const mode of ['interval', 'start', 'cron']) {
        for (const outcome of ['reject', 'async', 'sync']) {
            it(`${mode}: handles ${outcome} execution through the actual script module`, function () {
                const child = spawnSync(process.execPath, ['--unhandled-rejections=strict', '-e', fixture, mode, outcome], {
                    cwd: path.resolve(__dirname, '../..'), env: { PATH: process.env.PATH },
                    encoding: 'utf8', timeout: 4000, maxBuffer: 16000
                });
                assert.ifError(child.error);
                assert.equal(child.status, 0, child.stderr);
                assert.equal(child.stdout.trim(), 'ok');
            });
        }
    }
});
