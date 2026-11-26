'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const scriptModuleFactory = require('../../runtime/scripts/msm');

describe('Server script syntax isolation', function () {
    it('loads valid scripts when another saved script has invalid syntax', async function () {
        const errors = [];
        const scriptModule = scriptModuleFactory.create(new EventEmitter(), {
            error(message) { errors.push(message); },
            warn() {}
        });
        const scripts = [
            {
                id: 'helper-id',
                name: 'helper',
                parameters: [{ name: 'value' }],
                sync: true,
                code: 'return value + 1;'
            },
            {
                id: 'broken-id',
                name: 'broken',
                parameters: [],
                sync: true,
                code: 'const value = ; return value;'
            },
            {
                id: 'caller-id',
                name: 'caller',
                parameters: [{ name: 'value' }],
                sync: false,
                code: 'return helper(value) * 2;'
            }
        ];

        const result = scriptModule.loadScripts(scripts);

        assert.deepEqual(result.messages, ['load.script broken error!']);
        assert.equal(scriptModule.runScript({ name: 'helper', parameters: [{ value: 4 }] }), 5);
        assert.equal(await scriptModule.runScript({ name: 'caller', parameters: [{ value: 4 }] }), 10);
        assert.equal(scriptModule.getScriptByName('broken'), undefined);
        assert.equal(errors.length, 1);
        assert.match(errors[0], /load\.script broken error:/);
    });
});
