const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sqlite = require('sqlite3');
const sinon = require('sinon');
const storageModule = require('../../runtime/storage/sqlite');

const execute = (db, sql) => new Promise((resolve, reject) => db.exec(sql, error => error ? reject(error) : resolve()));
const close = db => new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));

describe('DAQ archive query connection cleanup', function () {
    for (const mode of ['rows', 'empty', 'invalid schema', 'repeated failures']) {
        it('closes archive connections after ' + mode, async function () {
            const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fuxa-archive-cleanup-'));
            const sandbox = sinon.createSandbox();
            const opened = new Set(), closing = new Set(), closed = [];
            let node;
            try {
                const map = new sqlite.Database(path.join(directory, 'daq-map_device.db'));
                await execute(map, "CREATE TABLE data (mapid INTEGER PRIMARY KEY, id TEXT, name TEXT, type TEXT); INSERT INTO data VALUES (1, 'tag', 'Tag', 'number');");
                await close(map);
                const archiveDirectory = path.join(directory, 'archive');
                fs.mkdirSync(archiveDirectory);
                const archive = new sqlite.Database(path.join(archiveDirectory, 'daq-data_device_20260101000000_20260102000000.db'));
                const invalid = mode === 'invalid schema' || mode === 'repeated failures';
                await execute(archive, invalid ? 'CREATE TABLE data (dt INTEGER, id INTEGER);' : 'CREATE TABLE data (dt INTEGER, id INTEGER, value TEXT);');
                const timestamp = new Date(2026, 0, 1, 12).getTime();
                if (mode === 'rows') await execute(archive, `INSERT INTO data VALUES (${timestamp}, 1, 'true');`);
                await close(archive);
                const all = sqlite.Database.prototype.all;
                sandbox.stub(sqlite.Database.prototype, 'all').callsFake(function (...args) {
                    if (path.dirname(this.filename) === archiveDirectory) opened.add(this);
                    return all.apply(this, args);
                });
                const originalClose = sqlite.Database.prototype.close;
                sandbox.stub(sqlite.Database.prototype, 'close').callsFake(function (...args) {
                    if (opened.has(this)) {
                        closing.add(this);
                        closed.push(new Promise(resolve => this.once('close', resolve)));
                    }
                    return originalClose.apply(this, args);
                });
                sandbox.stub(console, 'error');
                let resolveReady;
                const ready = new Promise(resolve => { resolveReady = resolve; });
                let initialized = 0;
                node = storageModule.create({ dbDir: directory, daqTokenizer: 0 }, {
                    info(message) {
                        if (message.includes('connected-to-data') || message.includes('load-map successful')) {
                            if (++initialized === 2) resolveReady();
                        }
                    }, error() {}, warn() {}
                }, 'device', { setValues() {} });
                await ready;
                const repetitions = mode === 'repeated failures' ? 3 : 1;
                for (let i = 0; i < repetitions; i++) {
                    const result = node.getDaqValue('tag', timestamp - 1000, timestamp + 1000);
                    if (invalid) await assert.rejects(result, error => error.code === 'SQLITE_ERROR' && /no such column: value/.test(error.message));
                    else assert.deepEqual(await result, mode === 'rows' ? [{ dt: timestamp, value: true }] : []);
                }
                assert.equal(opened.size, repetitions);
                assert.equal(closing.size, opened.size, 'every archive query must close its own connection');
                await Promise.all(closed);
                for (const db of opened) assert.equal(db.open, false);
            } finally {
                sandbox.restore();
                for (const db of opened) if (db.open && !closing.has(db)) await close(db);
                if (node) node.close();
                fs.rmSync(directory, { recursive: true, force: true });
            }
        });
    }
});
