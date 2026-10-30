const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sqlite = require('sqlite3');
const storage = require('../../runtime/storage/sqlite');

const execute = (db, sql) => new Promise((resolve, reject) => db.exec(sql, error => error ? reject(error) : resolve()));
const close = db => new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
const insert = (db, values) => new Promise((resolve, reject) => db.run('INSERT INTO data VALUES (?, 1, ?)', values, error => error ? reject(error) : resolve()));

async function readValues(source, values) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fuxa-daq-strings-'));
    const timestamp = new Date(2026, 0, 1, 12).getTime();
    let node;
    try {
        const map = new sqlite.Database(path.join(directory, 'daq-map_device.db'));
        try {
            await execute(map, "CREATE TABLE data (mapid INTEGER PRIMARY KEY, id TEXT, name TEXT, type TEXT); INSERT INTO data VALUES (1, 'tag', 'Tag', 'string');");
        } finally { await close(map); }
        let filename = path.join(directory, 'daq-data_device_.db');
        if (source === 'archive') {
            fs.mkdirSync(path.join(directory, 'archive'));
            filename = path.join(directory, 'archive', 'daq-data_device_20260101000000_20260102000000.db');
        }
        const data = new sqlite.Database(filename);
        try {
            await execute(data, 'CREATE TABLE data (dt INTEGER, id INTEGER, value TEXT)');
            for (let index = 0; index < values.length; index++) await insert(data, [timestamp + index, values[index]]);
        } finally { await close(data); }
        let readyResolve;
        const ready = new Promise(resolve => { readyResolve = resolve; });
        let initialized = 0;
        const errors = [];
        node = storage.create({dbDir: directory, daqTokenizer: 0}, {
            info(message) {
                if (message.includes('connected-to-data') || message.includes('load-map successful')) {
                    if (++initialized === 2) readyResolve();
                }
            }, error(message) { errors.push(message); }, warn() {}
        }, 'device', {setValues() {}});
        await ready;
        const rows = await node.getDaqValue('tag', timestamp, timestamp + values.length);
        assert.deepEqual(errors, []);
        return {rows, timestamp};
    } finally {
        if (node) node.close();
        fs.rmSync(directory, {recursive: true, force: true});
    }
}

describe('DAQ string value decoding', function () {
    for (const source of ['current', 'archive']) {
        it('preserves prototype-named strings in ' + source + ' reads and JSON output', async function () {
            const values = ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__', '__defineGetter__', 'isPrototypeOf'];
            const {rows, timestamp} = await readValues(source, values);
            const expected = values.map((value, index) => ({dt: timestamp + index, value}));
            assert.deepEqual(rows, expected);
            assert.deepEqual(JSON.parse(JSON.stringify(rows)), expected);
        });
        it('retains boolean decoding and ordinary values in ' + source + ' reads', async function () {
            const values = ['true', 'false', 'RUN', '', '123', 'TRUE', null];
            const {rows, timestamp} = await readValues(source, values);
            const decoded = [true, false, 'RUN', '', '123', 'TRUE', null];
            assert.deepEqual(rows, decoded.map((value, index) => ({dt: timestamp + index, value})));
        });
    }
});
