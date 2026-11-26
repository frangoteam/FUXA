'use strict';
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3');
const calculator = require('../../runtime/storage/calculator');

// Owned in-memory SQLite fixtures exercise the historian's inclusive BETWEEN
// query contract and actual calculator dispatch, not a running DAQ application.
describe('DAQ aggregation at inclusive interval endpoints', function () {
    let db;
    const run = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, err => err ? reject(err) : resolve()));
    const rows = (from, to) => new Promise((resolve, reject) => db.all(
        'SELECT dt, value FROM data WHERE dt BETWEEN ? AND ? ORDER BY dt ASC', [from, to],
        (err, result) => err ? reject(err) : resolve(result)));
    beforeEach(async function () {
        db = new sqlite3.Database(':memory:');
        await run('CREATE TABLE data (dt INTEGER, value REAL)');
    });
    afterEach(function () { return new Promise((resolve, reject) => db.close(err => err ? reject(err) : resolve())); });
    for (const interval of ['min5', 'hour', 'day']) {
        const begin = new Date(2026, 0, 15).getTime();
        const end = interval === 'day' ? new Date(2026, 0, 16).getTime() : begin + (interval === 'hour' ? 3600000 : 300000);
        for (const fnc of ['min', 'max', 'sum', 'average']) {
            it(`${fnc}/${interval} aggregates samples exactly at the inclusive upper bound`, async function () {
                await run('INSERT INTO data VALUES (?, ?), (?, ?), (?, ?)', [begin, 2, end, 7, end + 1, 999]);
                if (fnc === 'average') await run('INSERT INTO data VALUES (?, ?)', [end, 9]);
                const values = await rows(begin, end);
                assert.deepEqual(values.map(row => row.value), fnc === 'average' ? [2, 7, 9] : [2, 7]);
                const expected = {min: 7, max: 7, sum: 7, average: 8}[fnc];
                assert.deepEqual(calculator.getFunctionValues(values, begin, end, fnc, interval), {[begin]: 2, [end]: expected});
            });
            it(`${fnc}/${interval} handles a single-timestamp range`, async function () {
                await run('INSERT INTO data VALUES (?, ?)', [begin, -3]);
                if (fnc === 'average') await run('INSERT INTO data VALUES (?, ?)', [begin, -5]);
                const expected = {min: -3, max: -3, sum: -3, average: -4}[fnc];
                assert.deepEqual(calculator.getFunctionValues(await rows(begin, begin), begin, begin, fnc, interval), {[begin]: expected});
            });
            it(`${fnc}/${interval} preserves ordinary interior samples`, async function () {
                await run('INSERT INTO data VALUES (?, ?), (?, ?)', [begin, 2, begin + 1000, 4]);
                const expected = {min: 2, max: 4, sum: 6, average: 3}[fnc];
                assert.deepEqual(calculator.getFunctionValues(await rows(begin, end - 1), begin, end - 1, fnc, interval), {[begin]: expected});
            });
        }
    }
});
