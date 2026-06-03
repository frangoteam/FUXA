'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const daqstorage = require('../../runtime/storage/sqlite/index');

// ─── helpers ────────────────────────────────────────────────────────────────

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function makeTempSettings() {
    const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fuxa-daqtest-'));
    return { dbDir, daqTokenizer: 0 };    // daqTokenizer:0 disables DB rotation
}

function makeLogger(collected) {
    return {
        info:  ()    => {},
        warn:  (msg) => { collected.warnings.push(msg); },
        error: (msg) => { collected.errors.push(msg); }
    };
}

/** A minimal set of tags where 'tag1' has DAQ enabled */
function makeTags() {
    return {
        tag1: { id: 'tag1', name: 'Tag 1', type: 'number', daq: { enabled: true }, value: 42 }
    };
}

/** Wait for the DaqNode internal init to complete (initready = true).
 *  The node exposes getDaqMap(), which only returns a populated object once
 *  the map DB is loaded, so we use that as a proxy signal. */
function waitForReady(node, timeoutMs = 2000) {
    return new Promise((resolve, reject) => {
        const deadline = Date.now() + timeoutMs;
        function poll() {
            // getDaqMap() returns {} while not ready, and also {} when ready but
            // no tags are mapped yet. We combine it with a simple time-box.
            if (Date.now() > deadline) {
                reject(new Error('DaqNode did not become ready in time'));
            } else {
                // Re-check in 20 ms – sqlite init typically finishes in < 100 ms
                setTimeout(poll, 20);
            }
        }
        // Give it one initial tick to start the async DB bind before polling
        setTimeout(poll, 50);
    });
}

// ─── tests ──────────────────────────────────────────────────────────────────

describe('DaqNode (sqlite storage)', () => {

    let expect;
    const unhandledRejections = [];
    let rejectionHandler;
    const tmpDirs = [];

    before(async () => {
        const chai = await import('chai');
        expect = chai.expect;

        // Capture any unhandled rejections that occur during these tests
        rejectionHandler = (reason) => { unhandledRejections.push(reason); };
        process.on('unhandledRejection', rejectionHandler);
    });

    after(() => {
        process.removeListener('unhandledRejection', rejectionHandler);
        tmpDirs.forEach(dir => {
            try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
        });
    });

    beforeEach(() => {
        unhandledRejections.length = 0;
    });

    // ── Fix 1 ─────────────────────────────────────────────────────────────────
    // _insertTagValue previously called reject() with no argument, causing
    // "UnhandledPromiseRejection: ...reason 'undefined'".
    // After the fix it calls reject(err), so the rejection carries real info.
    describe('Fix 1 – _insertTagValue propagates the actual DB error', () => {

        it('should log a meaningful error (not "undefined") when a DB write fails', async () => {
            const settings = makeTempSettings();
            tmpDirs.push(settings.dbDir);
            const collected = { warnings: [], errors: [] };
            const node = daqstorage.create(settings, makeLogger(collected), 'dev-fix1', null);

            const tags = makeTags();
            node.setCall(() => tags['tag1']);

            // Wait for init, then prime the tag map with one successful write
            await wait(300);
            node.addDaqValues(tags, 'device', 'dev-fix1');
            await wait(300);   // let the map insertion + data write complete

            // Close the underlying database handles so the next write will error
            node.close();
            await wait(50);

            // Trigger a write on the now-closed DB
            node.addDaqValues(tags, 'device', 'dev-fix1');
            await wait(500);   // wait for the async sqlite callback to fire

            // The rejection handler inside addDaqValues must have caught the error.
            // With the fix: reason is the actual Error object → logged with its stack.
            // Without the fix: reason is undefined → logged literally as "undefined".
            const writeFailed = collected.errors.find(e =>
                e.includes('addDaqfnc failed!')
            );
            expect(writeFailed, 'Expected an addDaqfnc error to be logged').to.exist;
            expect(writeFailed).to.not.include('undefined',
                'Error reason must not be undefined – reject(err) was expected');
        });
    });

    // ── Fix 2 ─────────────────────────────────────────────────────────────────
    // When the data-overload guard fires (_checkDataWorking returns false),
    // the already-created _insertTagValue promises had no rejection handler.
    // After the fix, a no-op .catch() is attached to each orphaned promise,
    // preventing UnhandledPromiseRejection.
    describe('Fix 2 – no UnhandledPromiseRejection on data overload', () => {

        it('should not raise UnhandledPromiseRejection when addDaqValues is called concurrently', async () => {
            const settings = makeTempSettings();
            tmpDirs.push(settings.dbDir);
            const collected = { warnings: [], errors: [] };
            const node = daqstorage.create(settings, makeLogger(collected), 'dev-fix2', null);

            const tags = makeTags();
            node.setCall(() => tags['tag1']);

            // Wait for init, then prime the tag map
            await wait(300);
            node.addDaqValues(tags, 'device', 'dev-fix2');
            await wait(300);   // let map + first data write complete

            // Close the DB so that subsequent writes fail (reject), giving the
            // orphaned promise a reason to reject in the overload scenario.
            node.close();
            await wait(50);

            // Fire two calls in the same synchronous tick:
            //   • call A: _checkDataWorking(true) → true  → starts Promise.all → has rejection handler
            //   • call B: _checkDataWorking(true) → false → overload path → promises need .catch()
            node.addDaqValues(tags, 'device', 'dev-fix2');
            node.addDaqValues(tags, 'device', 'dev-fix2');

            // Node.js defers unhandledRejection to the next event loop turn;
            // a short wait is enough to let any slip through.
            await wait(500);

            expect(unhandledRejections).to.have.length(0,
                `UnhandledPromiseRejection(s) detected: ${unhandledRejections.map(String).join('; ')}`);

            // As a sanity check, the overload warning must have been emitted
            const overloadWarning = collected.warnings.find(w =>
                w.includes('data-overload')
            );
            expect(overloadWarning, 'Expected a data-overload warning to be logged').to.exist;
        });
    });
});
