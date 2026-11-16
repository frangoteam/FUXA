'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sinon = require('sinon');
const sqlite3 = require('sqlite3');
const daqstorage = require('../../runtime/storage/sqlite/index');
const turn = () => new Promise(resolve => setImmediate(resolve));

async function until(predicate, description) {
    const deadline = Date.now() + 2000;
    while (!predicate()) {
        assert.ok(Date.now() < deadline, `Timed out waiting for ${description}`);
        await turn();
    }
}

for (const holdMapLoad of [false, true]) {
    describe(`DaqNode error handling (${holdMapLoad ? 'gated' : 'ordinary'} initialization)`, function () {
        let sandbox, dbDir, node, closed, closes, collected, unhandled, onRejection;
        beforeEach(function () {
            sandbox = sinon.createSandbox();
            dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fuxa-daqtest-'));
            closed = false; closes = []; collected = { info: [], warnings: [], errors: [] }; unhandled = [];
            onRejection = reason => unhandled.push(reason);
            process.on('unhandledRejection', onRejection);
            const nativeClose = sqlite3.Database.prototype.close;
            sandbox.stub(sqlite3.Database.prototype, 'close').callsFake(function (...args) {
                if (this.filename.startsWith(dbDir + path.sep)) {
                    closes.push(new Promise(resolve => this.once('close', resolve)));
                }
                return nativeClose.apply(this, args);
            });
        });
        afterEach(async function () {
            try {
                if (node && !closed) node.close();
                await Promise.all(closes);
            } finally {
                process.removeListener('unhandledRejection', onRejection);
                sandbox.restore();
                fs.rmSync(dbDir, { recursive: true, force: true });
            }
        });
        async function readyWithMappedTag() {
            let releaseMap;
            if (holdMapLoad) {
                const nativeAll = sqlite3.Database.prototype.all;
                sandbox.stub(sqlite3.Database.prototype, 'all').callsFake(function (...args) {
                    if (this.filename.startsWith(dbDir + path.sep) && args[0] === 'SELECT mapid, id, name, type FROM data') {
                        const callback = args.pop();
                        args.push(function (...result) { releaseMap = () => callback.apply(this, result); });
                    }
                    return nativeAll.apply(this, args);
                });
            }
            node = daqstorage.create({ dbDir, daqTokenizer: 0 }, {
                info: message => collected.info.push(message),
                warn: message => collected.warnings.push(message),
                error: message => collected.errors.push(message)
            }, 'dev-errors', null);
            const tags = { tag1: { id: 'tag1', name: 'Tag 1', type: 'number', daq: { enabled: true }, value: 42 } };
            node.setCall(() => tags.tag1);
            if (holdMapLoad) {
                await until(() => releaseMap, 'real SQLite map query callback');
                node.addDaqValues(tags, 'device', 'dev-errors');
                assert.deepEqual(node.getDaqMap(), {}, 'values before initialization must not create a mapping');
                releaseMap();
            }
            await until(() => collected.info.some(x => x.includes('connected-to-data')) &&
                collected.info.some(x => x.includes('load-map successful')), 'data connection and loaded map');
            node.addDaqValues(tags, 'device', 'dev-errors');
            await until(() => node.getDaqMap().tag1, 'tag mapping');
            assert.equal(closes.length, 0);
            node.close(); closed = true;
            assert.equal(closes.length, 2, 'observe both real database close events');
            await Promise.all(closes);
            return tags;
        }
        it('logs the actual SQLite write error after closing the database', async function () {
            const tags = await readyWithMappedTag();
            node.addDaqValues(tags, 'device', 'dev-errors');
            await until(() => collected.errors.some(x => x.includes('addDaqfnc failed!')), 'write failure');
            const error = collected.errors.find(x => x.includes('addDaqfnc failed!'));
            assert.match(error, /SQLITE_MISUSE/);
            assert.doesNotMatch(error, /undefined/);
            await turn(); await turn();
            assert.deepEqual(unhandled, []);
        });
        it('handles rejected orphan writes in the overload branch', async function () {
            const tags = await readyWithMappedTag();
            node.addDaqValues(tags, 'device', 'dev-errors');
            node.addDaqValues(tags, 'device', 'dev-errors');
            assert.equal(collected.warnings.filter(x => x.includes('data-overload')).length, 1,
                'the second synchronous call must exercise the overload branch');
            await until(() => collected.errors.some(x => x.includes('addDaqfnc failed!')), 'first write rejection');
            await turn(); await turn();
            assert.deepEqual(unhandled, [], 'orphan write rejection must have a handler');
        });
    });
}
