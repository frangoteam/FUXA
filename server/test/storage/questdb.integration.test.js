const assert = require('node:assert/strict');

// Runs against a real QuestDB only when QUESTDB_HOST is set, for example:
//   QUESTDB_HOST=127.0.0.1 npx mocha test/storage/questdb.integration.test.js
// Expects the default ports (8812 PGWire, 9000 HTTP) and admin/quest credentials.
const host = process.env.QUESTDB_HOST;

(host ? describe : describe.skip)('QuestDB integration (real server)', function () {
    this.timeout(30000);
    const tableName = `fuxa_it_${Date.now()}`;
    const errors = [];
    let originalTz;
    let storage;
    let pool;

    before(() => {
        originalTz = process.env.TZ;
        // A non-UTC server zone exposes local-time parsing of QuestDB timestamps.
        process.env.TZ = 'Europe/Helsinki';
        const { Pool } = require('pg');
        pool = new Pool({ host, port: 8812, database: 'qdb', user: 'admin', password: 'quest' });
        storage = require('../../runtime/storage/questdb').create({
            daqstore: { host, tableName, configurationString: `http::addr=${host}:9000;` },
        }, { info() {}, warn() {}, error(message) { errors.push(message); } });
    });

    after(async () => {
        storage?.close();
        if (pool) {
            await pool.query(`DROP TABLE IF EXISTS ${tableName}`).catch(() => {});
            await pool.end();
        }
        if (originalTz === undefined) {
            delete process.env.TZ;
        } else {
            process.env.TZ = originalTz;
        }
    });

    it('reads samples back at the UTC instant they were written', async () => {
        assert.equal(new Date(Date.UTC(2026, 10, 11)).getTimezoneOffset(), -120);
        const t0 = Date.UTC(2026, 10, 11, 10, 0, 0, 123);
        const write = (value, timestamp) => storage.addDaqValues({
            power: { id: 'power', value, timestamp, daq: { enabled: true } },
        }, 'Meter', 'device-1');
        write(42, t0);
        write(43, t0 + 1000);
        write(99, t0 + 2 * 3600e3); // outside the queried range

        // WAL tables apply writes asynchronously; wait until all three rows are visible.
        for (let i = 0; i < 100; i++) {
            const result = await pool.query(`SELECT count() AS c FROM ${tableName}`).catch(() => null);
            if (result && Number(result.rows[0].c) === 3) {
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const rows = await storage.getDaqValue('power', t0 - 3600e3, t0 + 3600e3);
        assert.deepEqual(rows, [
            { dt: t0, value: 42 },
            { dt: t0 + 1000, value: 43 },
        ]);
        assert.deepEqual(errors, []);
    });
});
