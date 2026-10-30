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
(async () => {
    const mode = process.argv[1], calls = [], errors = [];
    const sandbox = sinon.createSandbox();
    const clock = sandbox.useFakeTimers({ now: new Date(2026, 0, 1, 0, 0, 0),
        toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    let manager, unrelatedRuns = 0;
    try {
        const saved = { id: 'scheduled', name: 'scheduled', mode: 'SERVER', sync: true, parameters: [],
            code: "$setTag('executed', true);",
            scheduling: { mode: 'scheduling', schedules: [{ type: 1, minute: 1 }] } };
        manager = scripts.create({ events: new EventEmitter(), settings: {},
            logger: { info() {}, warn() {}, error(e) { errors.push(e); } },
            devices: { setTagValue(...args) { calls.push(args); } },
            project: { async getScripts() { return [saved]; } } });
        manager.start();
        await clock.tickAsync(2100); // initialization and schedule loading
        const owned = Object.values(schedule.scheduledJobs);
        assert.equal(owned.length, 1);
        const unrelated = schedule.scheduleJob(new Date(2026, 0, 1, 0, 0, 30), () => { unrelatedRuns++; });
        if (mode !== 'ordinary') {
            await manager.stop();
            if (mode === 'repeated stop') await manager.stop();
            assert.equal(owned[0].nextInvocation(), null, 'stop must cancel the loaded script calendar job');
            assert.ok(unrelated.nextInvocation(), 'stop must preserve unrelated scheduler jobs');
        }
        if (mode === 'restart') {
            manager.start(); await clock.tickAsync(2100);
            assert.equal(Object.values(schedule.scheduledJobs).length, 1, 'restart loads exactly one script job');
        }
        await clock.tickAsync(60000);
        assert.equal(calls.length, mode === 'ordinary' || mode === 'restart' ? 1 : 0);
        assert.deepEqual(errors, []);
        if (mode !== 'restart') assert.equal(unrelatedRuns, 1);
    } finally {
        if (manager) await manager.stop();
        for (const job of Object.values(schedule.scheduledJobs)) job.cancel();
        sandbox.restore();
    }
    console.log('ok');
})().catch(error => { console.error(error); process.exitCode = 1; });
`;

describe('Script calendar jobs on manager stop', function () {
    for (const mode of ['stop', 'repeated stop', 'restart', 'ordinary']) {
        it(mode + ' with the actual scheduler and compiled script', function () {
            const child = spawnSync(process.execPath, ['--unhandled-rejections=strict', '-e', fixture, mode], {
                cwd: path.resolve(__dirname, '../..'), env: { PATH: process.env.PATH, TZ: 'UTC' },
                timeout: 4000, encoding: 'utf8', maxBuffer: 16000
            });
            assert.ifError(child.error);
            assert.equal(child.status, 0, child.stderr);
            assert.equal(child.stdout.trim(), 'ok');
        });
    }
});
