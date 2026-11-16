const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sqlite = require('sqlite3');
const storage = require('../../runtime/storage/sqlite');

const execute = (db, sql) => new Promise((resolve, reject) => db.exec(sql, error => error ? reject(error) : resolve()));
const close = db => new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));

describe('DAQ archive device identity', function () {
    for (const [id, other] of [['a', 'line_a'], ['a', 'a_line'], ['line_a', 'other_line_a'], ['line_a', 'line_a_other'], ['line_a', null]]) {
        it('reads only ' + id + ' archives' + (other ? ', excluding ' + other : ' with underscores retained'), async function () {
            const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fuxa-archive-device-'));
            const timestamp = new Date(2026, 0, 1, 12).getTime();
            let node;
            try {
                const map = new sqlite.Database(path.join(directory, 'daq-map_' + id + '.db'));
                await execute(map, "CREATE TABLE data (mapid INTEGER PRIMARY KEY, id TEXT, name TEXT, type TEXT); INSERT INTO data VALUES (1, 'tag', 'Tag', 'number');");
                await close(map);
                const archives = path.join(directory, 'archive');
                fs.mkdirSync(archives);
                async function archive(device, suffix, value) {
                    const db = new sqlite.Database(path.join(archives, 'daq-data_' + device + '_' + suffix + '.db'));
                    try {
                        await execute(db, "CREATE TABLE data (dt INTEGER, id INTEGER, value TEXT); INSERT INTO data VALUES (" + timestamp + ", 1, '" + value + "');");
                    } finally { await close(db); }
                }
                await archive(id, '20260101000000_20260102000000', 'own');
                if (other) await archive(other, '20260101000000_20260102000000', 'foreign');
                await archive(id, '20250101000000_20250102000000', 'out-of-range');
                let resolveReady;
                const ready = new Promise(resolve => { resolveReady = resolve; });
                let initialized = 0;
                node = storage.create({ dbDir: directory, daqTokenizer: 0 }, {
                    info(message) {
                        if (message.includes('connected-to-data') || message.includes('load-map successful')) {
                            if (++initialized === 2) resolveReady();
                        }
                    }, warn() {}, error() {}
                }, id, { setValues() {} });
                await ready;
                assert.deepEqual(await node.getDaqValue('tag', timestamp - 1000, timestamp + 1000), [{dt: timestamp, value: 'own'}]);
            } finally {
                if (node) node.close();
                fs.rmSync(directory, { recursive: true, force: true });
            }
        });
    }
});
