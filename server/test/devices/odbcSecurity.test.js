'use strict';

const assert = require('assert');
const EventEmitter = require('events');
const Module = require('module');

describe('ODBC security handling', function () {
    let originalLoad;
    let connectCalls;

    before(function () {
        const fakeConnection = {
            close() { },
            tables: async () => [{ TABLE_NAME: 'T1' }]
        };
        originalLoad = Module._load;
        Module._load = function (request) {
            if (request === 'odbc') {
                return {
                    connect: async (config) => {
                        connectCalls.push(config);
                        return fakeConnection;
                    },
                    pool: async () => ({ close() { } })
                };
            }
            return originalLoad.apply(this, arguments);
        };
        delete require.cache[require.resolve('../../runtime/devices/odbc')];
    });

    after(function () {
        Module._load = originalLoad;
        delete require.cache[require.resolve('../../runtime/devices/odbc')];
    });

    beforeEach(function () {
        connectCalls = [];
    });

    function createClient(getProperty) {
        const driver = require('../../runtime/devices/odbc');
        const events = new EventEmitter();
        const statuses = [];
        events.on('device-status:changed', (evt) => statuses.push(evt.status));
        const client = driver.create({
            id: 'db1',
            name: 'ODBC test',
            enabled: true,
            property: { address: 'DSN=test' },
            tags: {}
        }, { info() { }, warn() { }, error() { } }, events);
        client.bindGetProperty(getProperty);
        return { client, statuses };
    }

    function getTables(getProperty) {
        const driver = require('../../runtime/devices/odbc');
        return driver.getTables({ id: 'db1', address: 'DSN=test' }, getProperty, {});
    }

    it('connects when no security row exists', async function () {
        const { client, statuses } = createClient(async () => undefined);
        await client.connect();
        assert.strictEqual(connectCalls.length, 1);
        assert.strictEqual(connectCalls[0].connectionString, 'DSN=test');
        assert.ok(statuses.includes('connect-ok'));
    });

    it('uses uid and pwd from the security row', async function () {
        const { client, statuses } = createClient(async () => ({ id: 'db1', value: '{"uid":"u","pwd":"p"}' }));
        await client.connect();
        assert.strictEqual(connectCalls[0].connectionString, 'DSN=test;UID=u;PWD=p');
        assert.ok(statuses.includes('connect-ok'));
    });

    it('connects when the stored security value is invalid', async function () {
        const { client, statuses } = createClient(async () => ({ id: 'db1', value: 'null' }));
        await client.connect();
        assert.strictEqual(connectCalls[0].connectionString, 'DSN=test');
        assert.ok(statuses.includes('connect-ok'));
    });

    it('lists tables when no security row exists', async function () {
        const tables = await getTables(async () => undefined);
        assert.deepStrictEqual(tables, ['T1']);
        assert.strictEqual(connectCalls[0].connectionString, 'DSN=test');
    });

    it('uses uid and pwd when listing tables', async function () {
        const tables = await getTables(async () => ({ id: 'db1', value: '{"uid":"u","pwd":"p"}' }));
        assert.deepStrictEqual(tables, ['T1']);
        assert.strictEqual(connectCalls[0].connectionString, 'DSN=test;UID=u;PWD=p');
    });

    it('lists tables when the stored security value is invalid', async function () {
        const tables = await getTables(async () => ({ id: 'db1', value: 'null' }));
        assert.deepStrictEqual(tables, ['T1']);
        assert.strictEqual(connectCalls[0].connectionString, 'DSN=test');
    });
});
