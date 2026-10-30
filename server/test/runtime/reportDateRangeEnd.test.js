'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Report = require('../../runtime/jobs/report');

// Actual report builder and PDF stream; controlled storage, no database or email.
describe('Report calendar range endpoints', function () {
    let directory;
    beforeEach(function () { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fuxa-report-range-')); });
    afterEach(function () { fs.rmSync(directory, {recursive: true, force: true}); });
    const cases = [
        ['day', [2026, 0, 1], [2025, 11, 31], [2025, 11, 31]],
        ['day', [2026, 2, 9], [2026, 2, 8], [2026, 2, 8]], // New York spring DST
        ['day', [2026, 10, 2], [2026, 10, 1], [2026, 10, 1]], // New York fall DST
        ['week', [2026, 0, 5], [2025, 11, 29], [2026, 0, 4]],
        ['month', [2024, 2, 1], [2024, 1, 1], [2024, 1, 29]],
        ['month', [2026, 0, 1], [2025, 11, 1], [2025, 11, 31]]
    ];
    for (const [range, current, first, last] of cases) {
        it(range + ' includes the final millisecond before ' + current.join('-'), async function () {
            const begin = new Date(...first).getTime(), end = new Date(...last, 23, 59, 59, 999).getTime();
            const calls = [], selected = [], records = [begin - 1, begin, end - 998, end, end + 1];
            function select(from, to) {
                calls.push([from, to]);
                const included = records.filter(time => time >= from && time <= to);
                selected.push(included); return included;
            }
            const runtime = {
                settings: {reportsDir: directory}, logger: {info() {}, error() {}},
                devices: {getTagFormat() { return 0; }},
                daqStorage: {async getNodesValues(ids, from, to) { return select(from, to).map(time => [String(time)]); }},
                alarmsMgr: {async getAlarmsHistory(query, permission) {
                    assert.equal(permission, -1);
                    return select(query.start, query.end).map(time => ({text: String(time), type: 'high', status: 'active'}));
                }}
            };
            const report = Report.create({name: 'range', scheduling: 'none', docproperty: {}, content: {items: [
                {type: 'table', range, size: 8, interval: 0,
                    columns: [{type: 1, tag: {id: 'tag', name: 'Value'}, function: null, width: '*'}]},
                {type: 'alarms', range, size: 8, propertyText: {text: 'Text'}, property: {text: true},
                    priority: {high: true}, priorityText: {high: 'High'}, statusText: {active: 'Active'}}
            ]}}, runtime);
            const pdf = fs.readFileSync(await report.execute(new Date(...current, 2, 30), true));
            assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
            assert.match(pdf.subarray(-20).toString(), /%%EOF/);
            assert.deepEqual(calls, [[begin, end], [begin, end]], 'DAQ and alarm queries cover the full period');
            assert.deepEqual(selected, [[begin, end - 998, end], [begin, end - 998, end]], 'retain fractional-second records, exclude next period');
        });
    }
    it('preserves an unspecified range as the exact execution timestamp', async function () {
        const now = new Date(2026, 4, 12, 10, 11, 12, 345), calls = [];
        const runtime = {settings: {reportsDir: directory}, logger: {info() {}, error() {}},
            devices: {getTagFormat() { return 0; }}, daqStorage: {async getNodesValues(ids, from, to) { calls.push([from, to]); return [['value']]; }}};
        const report = Report.create({name: 'instant', scheduling: 'none', docproperty: {}, content: {items: [
            {type: 'table', size: 8, columns: [{type: 1, tag: {id: 'tag'}, width: '*'}]}
        ]}}, runtime);
        assert.ok(fs.existsSync(await report.execute(now, true)));
        assert.deepEqual(calls, [[now.getTime(), now.getTime()]]);
    });
});
