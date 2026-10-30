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
    let manager, unrelatedRuns = 0, removed = false;
    try {
        const saved = { id: 'scheduled', name: 'scheduled', mode: 'SERVER', sync: true, parameters: [],
            code: "$setTag('executed', true);",
            scheduling: { mode: 'scheduling', schedules: [{ type: 1, minute: 1 }] } };
        let unrelated;
        if (mode === 'initial load') unrelated = schedule.scheduleJob(new Date(2026, 0, 1, 0, 0, 30), () => { unrelatedRuns++; });
        manager = scripts.create({ events: new EventEmitter(), settings: {},
            logger: { info() {}, warn() {}, error(e) { errors.push(e); } },
            devices: { setTagValue(...args) { calls.push(args); } },
            project: { async getScripts() { return removed ? [] : [saved]; } } });
        manager.start();
        await clock.tickAsync(2100); // initialization and schedule loading
        if (mode === 'initial load') assert.ok(unrelated.nextInvocation(), 'initial load must preserve unrelated jobs');
        const owned = Object.values(schedule.scheduledJobs).filter(job => job !== unrelated);
        assert.equal(owned.length, 1);
        unrelated = unrelated || schedule.scheduleJob(new Date(2026, 0, 1, 0, 0, 30), () => { unrelatedRuns++; });
        if (mode === 'reload' || mode === 'remove') {
            removed = mode === 'remove';
            if (removed) manager.removeScript(saved); else manager.updateScript(saved);
            await clock.tickAsync(1000);
            assert.equal(owned[0].nextInvocation(), null, 'reload must cancel the previous owned job');
            assert.ok(unrelated.nextInvocation(), 'reload must preserve unrelated jobs');
            assert.equal(Object.values(schedule.scheduledJobs).length, removed ? 1 : 2);
        } else if (mode !== 'ordinary' && mode !== 'initial load') {
            await manager.stop();
            if (mode === 'repeated stop') await manager.stop();
            assert.equal(owned[0].nextInvocation(), null, 'stop must cancel the loaded script calendar job');
            assert.ok(unrelated.nextInvocation(), 'stop must preserve unrelated scheduler jobs');
        }
        if (mode === 'restart') {
            manager.start(); await clock.tickAsync(2100);
            assert.equal(Object.values(schedule.scheduledJobs).length, 2, 'restart retains the unrelated job and loads one script job');
        }
        await clock.tickAsync(60000);
        assert.equal(calls.length, ['ordinary', 'restart', 'initial load', 'reload'].includes(mode) ? 1 : 0);
        assert.deepEqual(errors, []);
        assert.equal(unrelatedRuns, 1);
    } finally {
        if (manager) await manager.stop();
        for (const job of Object.values(schedule.scheduledJobs)) job.cancel();
        sandbox.restore();
    }
    console.log('ok');
})().catch(error => { console.error(error); process.exitCode = 1; });
`;

describe('Script calendar jobs on manager stop', function () {
    for (const mode of ['stop', 'repeated stop', 'restart', 'ordinary', 'initial load', 'reload', 'remove']) {
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
