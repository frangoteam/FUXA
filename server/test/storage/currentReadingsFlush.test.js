const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sinon = require('sinon');
const sqlite = require('sqlite3');
const currentStorage = require('../../runtime/storage/sqlite/currentstorage');

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

describe('Current readings flush ownership', function () {
    let directory, storage, flush, database, sandbox, statements;
    beforeEach(async function () {
        directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fuxa-current-readings-'));
        sandbox = sinon.createSandbox();
        statements = [];
        const ready = deferred();
        sandbox.stub(global, 'setInterval').callsFake(callback => { flush = callback; ready.resolve(); return {}; });
        const prepare = sqlite.Database.prototype.prepare;
        sandbox.stub(sqlite.Database.prototype, 'prepare').callsFake(function (...args) {
            database = this;
            const statement = prepare.apply(this, args);
            statements.push(statement);
            return statement;
        });
        storage = currentStorage.create({ dbDir: directory }, { info() {}, error() {} });
        await ready.promise;
    });
    afterEach(async function () {
        sandbox.restore();
        // Also clean up statements leaked by the old implementation on failure.
        for (const statement of statements) await new Promise(resolve => statement.finalize(() => resolve()));
        if (database) await new Promise((resolve, reject) => database.close(error => error ? reject(error) : resolve()));
        else storage.close();
        database = null;
        fs.rmSync(directory, {recursive: true, force: true});
    });
    function reading(value) { return {id: 'tag', deviceId: 'device', value}; }
    async function values() { return storage.getValuesByDeviceId('device'); }
    function holdFirstWrite() {
        const entered = deferred(), release = deferred();
        const run = sqlite.Statement.prototype.run;
        let held = false;
        sandbox.stub(sqlite.Statement.prototype, 'run').callsFake(function (...args) {
            const callback = args.pop();
            if (held) return run.call(this, ...args, callback);
            held = true;
            return run.call(this, ...args, function (error) {
                entered.resolve();
                release.promise.then(() => callback.call(this, error));
            });
        });
        return { entered: entered.promise, release: release.resolve };
    }
    for (const reuseObject of [false, true]) {
        it('retains a replacement queued during a write' + (reuseObject ? ' using the same caller object' : ''), async function () {
            const tag = reading('old');
            storage.setValues([tag]);
            const gate = holdFirstWrite();
            const pending = flush();
            await gate.entered;
            tag.value = 'new';
            storage.setValues([reuseObject ? tag : reading('new')]);
            gate.release();
            await pending;
            await flush();
            assert.deepEqual(await values(), [{id: 'tag', value: 'new'}]);
        });
    }
    it('does not start overlapping flushes while a write is pending', async function () {
        storage.setValues([reading('old')]);
        const gate = holdFirstWrite();
        const pending = flush();
        await gate.entered;
        storage.setValues([reading('new')]);
        let overlappingReturned = false;
        const overlapping = flush().then(() => { overlappingReturned = true; });
        await overlapping;
        assert.equal(overlappingReturned, true);
        const preparationsWhilePending = statements.length;
        gate.release();
        await pending;
        assert.equal(preparationsWhilePending, 1);
        await flush();
        assert.deepEqual(await values(), [{id: 'tag', value: 'new'}]);
    });
    it('retries a failed write without discarding a newer queued reading', async function () {
        storage.setValues([reading('old')]);
        const run = sqlite.Statement.prototype.run;
        let failed = false;
        sandbox.stub(sqlite.Statement.prototype, 'run').callsFake(function (...args) {
            if (!failed) {
                failed = true;
                storage.setValues([reading('new')]);
                args[args.length - 1](new Error('synthetic write failure'));
                return this;
            }
            return run.apply(this, args);
        });
        await flush();
        await flush();
        assert.deepEqual(await values(), [{id: 'tag', value: 'new'}]);
    });
    it('retains a reading after a real SQLite rejection and retries it', async function () {
        storage.setValues([reading('initial')]);
        await flush();
        const execute = sql => new Promise((resolve, reject) => database.exec(sql, error => error ? reject(error) : resolve()));
        await execute("CREATE TRIGGER reject_reading BEFORE INSERT ON currentValues WHEN NEW.value = 'rejected' BEGIN SELECT RAISE(FAIL, 'synthetic constraint'); END;");
        storage.setValues([reading('rejected')]);
        await flush();
        assert.deepEqual(await values(), [{id: 'tag', value: 'initial'}]);
        await execute('DROP TRIGGER reject_reading;');
        await flush();
        assert.deepEqual(await values(), [{id: 'tag', value: 'rejected'}]);
    });
    it('does not restore cleared readings from the remainder of a pending batch', async function () {
        storage.setValues([reading('old'), {id: 'other', deviceId: 'device', value: 'second'}]);
        const gate = holdFirstWrite();
        const pending = flush();
        await gate.entered;
        await storage.clearAll();
        gate.release();
        await pending;
        await flush();
        assert.deepEqual(await values(), []);
    });
    it('writes ordinary batches and replaces an earlier queued value', async function () {
        storage.setValues([reading('old')]);
        storage.setValues([reading('new'), {id: 'other', deviceId: 'device', value: 'second'}]);
        await flush();
        assert.deepEqual((await values()).sort((a, b) => a.id.localeCompare(b.id)), [
            {id: 'other', value: 'second'}, {id: 'tag', value: 'new'}
        ]);
        await flush();
        assert.equal((await values()).length, 2);
    });
});
