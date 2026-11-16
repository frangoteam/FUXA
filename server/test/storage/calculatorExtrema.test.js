'use strict';

const assert = require('node:assert/strict');
const calculator = require('../../runtime/storage/calculator');
const utils = require('../../runtime/utils');

describe('DAQ interval extrema', () => {
    const from = new Date(2026, 0, 15, 12).getTime();
    const to = from + 60000;

    function calculate(fnc, interval, samples) {
        const values = samples.map((value, index) => ({ dt: from + index * 1000, value }));
        return calculator.getFunctionValues(values, from, to, fnc, interval);
    }

    for (const interval of ['min5', 'hour', 'day']) {
        const bucket = interval === 'day' ? new Date(2026, 0, 15).getTime() : from;
        for (const fnc of ['min', 'max']) {
            for (const samples of [[0, 0], fnc === 'min' ? [4, 0, 2] : [-4, 0, -2], fnc === 'min' ? [0, -2] : [0, 2]]) {
                it(`calculates ${fnc} through zero for ${interval} samples ${samples}`, () => {
                    const expected = samples.length === 2 ? samples[1] : 0;
                    assert.deepEqual(calculate(fnc, interval, samples), { [bucket]: expected });
                });
            }
            it(`retains the empty ${fnc} sentinel for ${interval}`, () => {
                const sentinel = fnc === 'min' ? Number.MAX_VALUE : utils.SMALLEST_NEGATIVE_INTEGER;
                assert.deepEqual(calculate(fnc, interval, []), { [bucket]: sentinel });
            });
            it(`calculates nonzero ${fnc} values for ${interval}`, () => {
                assert.deepEqual(calculate(fnc, interval, [4, -2, 8]), { [bucket]: fnc === 'min' ? -2 : 8 });
            });
        }
        it(`keeps a single zero in both extrema for ${interval}`, () => {
            for (const fnc of ['min', 'max']) {
                assert.deepEqual(calculate(fnc, interval, [0]), { [bucket]: 0 });
            }
        });
    }
});
