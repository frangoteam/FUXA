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
    const sandbox = sinon.createSandbox(), errors = [], infos = [], calls = [], callbacks = [];
    let poll, manager;
    try {
        sandbox.stub(global, 'setInterval').callsFake(callback => { poll = callback; return {}; });
        sandbox.stub(global, 'clearInterval');
        sandbox.stub(schedule, 'gracefulShutdown').resolves();
        sandbox.stub(schedule, 'scheduleJob').callsFake((rule, callback) => { callbacks.push(callback); return { cancel() {} }; });
        sandbox.useFakeTimers({ now: 10000, toFake: ['Date'] });
        const code = outcome === 'flaky'
            ? "global.__scheduledAttempt = (global.__scheduledAttempt || 0) + 1; $setTag('executed', true); " +
                "if (global.__scheduledAttempt <= 2 || global.__scheduledAttempt === 5) " +
                "return Promise.reject(new Error('controlled scheduled failure ' + global.__scheduledAttempt)); " +
                "return Promise.resolve(42);"
            : outcome === 'independent'
                ? "$setTag('executed', true); return Promise.reject(new Error('first script failure'));"
            : "$setTag('executed', true); return " +
                (outcome === 'reject' ? "Promise.reject(new Error('controlled scheduled failure'));" : "42;");
        const script = { id: 'scheduled', name: 'scheduled', mode: 'SERVER', parameters: [],
            sync: outcome === 'sync',
            code,
            scheduling: mode === 'cron' ? { mode: 'scheduling', schedules: [{ type: 1, minute: 5 }] } : { mode, interval: 1 } };
        const projectScripts = outcome === 'independent'
            ? [script, { ...script, id: 'scheduled-2', name: 'scheduledTwo',
                code: "$setTag('executed-2', true); return Promise.reject(new Error('second script failure'));" }]
            : [script];
        manager = scripts.create({ events: new EventEmitter(), settings: {},
            logger: { info(message) { infos.push(message); }, warn() {}, error(error) { errors.push(error); } },
            devices: { setTagValue(...args) { calls.push(args); } },
            project: { async getScripts() { return projectScripts; } } });
        manager.start();
        const settle = () => new Promise(resolve => setImmediate(resolve));
        poll(); await settle(); // actual module initialization
        poll(); await settle(); // compile actual saved script and load schedule
        sandbox.clock.setSystemTime(12000);
        const run = async (time) => {
            if (mode === 'cron') { assert.equal(callbacks.length, 1); callbacks[0](); }
            else { sandbox.clock.setSystemTime(time); poll(); }
            await settle();
        };
        await run(12000);
        if (outcome === 'independent') {
            assert.deepEqual(errors.map(error => error.message || error), ['first script failure', 'second script failure']);
            await run(14000);
            assert.equal(errors.length, 2, 'each failed script must suppress only its own repeated rejection');
            assert.equal(calls.length, 4);
        } else if (outcome === 'flaky') {
            assert.equal(errors.length, 1);
            assert.equal(errors[0].message || errors[0], 'controlled scheduled failure 1');
            await run(14000);
            assert.equal(errors.length, 1, 'a changed rejection must be suppressed while the script remains failed');
            await run(16000);
            assert.deepEqual(infos.filter(message => message.includes('recovered')), ['Scheduled script scheduled recovered']);
            await run(18000);
            assert.equal(infos.filter(message => message.includes('recovered')).length, 1, 'continued success must not repeat recovery');
            await run(20000);
            assert.equal(errors.length, 2, 'a failure after recovery must be logged again');
            assert.equal(errors[1].message || errors[1], 'controlled scheduled failure 5');
            assert.equal(calls.length, 5);
        } else if (outcome === 'reject') {
            assert.deepEqual(calls, [['executed', true]]);
            assert.equal(errors.length, 1, 'the rejected scheduled execution must be logged');
            assert.equal(errors[0].message || errors[0], 'controlled scheduled failure');
        } else {
            assert.deepEqual(calls, [['executed', true]]);
            assert.deepEqual(errors, []);
        }
        if (mode !== 'cron' && outcome !== 'flaky' && outcome !== 'independent') {
            poll(); await settle(); assert.equal(calls.length, 1, 'same-tick poll must retain the interval/start boundary');
        }
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

    for (const mode of ['interval', 'cron']) {
        it(`${mode}: suppresses repeated failures and logs one recovery`, function () {
            const child = spawnSync(process.execPath, ['--unhandled-rejections=strict', '-e', fixture, mode, 'flaky'], {
                cwd: path.resolve(__dirname, '../..'), env: { PATH: process.env.PATH },
                encoding: 'utf8', timeout: 4000, maxBuffer: 16000
            });
            assert.ifError(child.error);
            assert.equal(child.status, 0, child.stderr);
            assert.equal(child.stdout.trim(), 'ok');
        });
    }

    it('tracks repeated failures independently for each scheduled script', function () {
        const child = spawnSync(process.execPath, ['--unhandled-rejections=strict', '-e', fixture, 'interval', 'independent'], {
            cwd: path.resolve(__dirname, '../..'), env: { PATH: process.env.PATH },
            encoding: 'utf8', timeout: 4000, maxBuffer: 16000
        });
        assert.ifError(child.error);
        assert.equal(child.status, 0, child.stderr);
        assert.equal(child.stdout.trim(), 'ok');
    });
});
