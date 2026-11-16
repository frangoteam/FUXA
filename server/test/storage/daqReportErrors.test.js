const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

// Child isolation makes an unhandled conversion rejection a test failure,
// without installing a handler that would conceal it from the process.
const fixture = String.raw`
const assert = require('node:assert/strict');
const Module = require('node:module');
const target = require('node:path').resolve('runtime/storage/daqstorage.js');
const mode = process.argv[1];
const from = new Date(2026, 0, 15).getTime();
const rows = [{dt: from + 1000, value: '2'}, {dt: from + 2000, value: '4'}];
const driver = {
    setCall() { return this; },
    getDaqMap(id) { return {[id]: true}; },
    getDaqValue() {
        if (mode === 'source-error') return Promise.reject(new Error('synthetic source failure'));
        return Promise.resolve(mode === 'invalid-rows' ? null : rows);
    }
};
const load = Module._load;
Module._load = function(request, parent, isMain) {
    if (parent && parent.filename === target) {
        if (['./sqlite', './influxdb', './tdengine'].includes(request)) return {create() { return driver; }};
        if (request === './sqlite/currentstorage') return {create() { return {}; }};
    }
    return load.call(this, request, parent, isMain);
};
const storage = require('./runtime/storage/daqstorage');
Module._load = load;
storage.init({}, {info() {}, warn() {}, error() {}}, {});
storage.addDaqNode('device', () => {});
(async () => {
    let options = null;
    if (mode === 'unknown-function') options = {functions: ['unsupported'], formats: [2], interval: 'hour'};
    if (mode === 'missing-formats') options = {functions: ['average'], interval: 'hour'};
    if (mode === 'average') options = {functions: ['average'], formats: [2], interval: 'hour'};
    const result = storage.getNodesValues(mode === 'empty' ? [] : ['tag'], from, from + 60000, options);
    if (['unknown-function', 'missing-formats', 'invalid-rows'].includes(mode)) {
        await assert.rejects(result, TypeError);
    } else if (mode === 'source-error') {
        await assert.rejects(result, error => Array.isArray(error) && error.join(',') === 'ERR,ERR');
    } else if (mode === 'average') {
        assert.equal((await result)[0][1], '3');
    } else if (mode === 'empty') {
        assert.deepEqual(await result, ['']);
    } else {
        const values = (await result).tag;
        assert.deepEqual(values.map(row => row.y), [null, '2', '4', null]);
        assert.equal(values[1].x.getTime(), from + 1000);
    }
    console.log('ok');
})().catch(error => { console.error(error); process.exitCode = 1; });
`;

describe('DAQ result conversion failures', function () {
    for (const mode of ['unknown-function', 'missing-formats', 'invalid-rows', 'source-error', 'average', 'chart', 'empty']) {
        it('settles the caller promise without an unhandled rejection: ' + mode, function () {
            const child = spawnSync(process.execPath, ['--unhandled-rejections=strict', '-e', fixture, mode], {
                cwd: path.resolve(__dirname, '../..'),
                env: {PATH: process.env.PATH, TZ: 'UTC'},
                timeout: 4000,
                encoding: 'utf8',
                maxBuffer: 16000,
            });
            assert.ifError(child.error);
            assert.equal(child.status, 0, child.stderr);
            assert.equal(child.stdout.trim(), 'ok');
        });
    }
});
