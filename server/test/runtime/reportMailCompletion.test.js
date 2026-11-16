'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Report = require('../../runtime/jobs/report');

// Actual PDF generation; only the mail transport completion is controlled.
// No email, network, database, or provider operation is performed.
describe('Report mail completion', function () {
    this.timeout(10000);
    let directory;
    beforeEach(function () { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fuxa-report-mail-')); });
    afterEach(function () { fs.rmSync(directory, { recursive: true, force: true }); });
    function create(receiver, sendMailMessage, errors = []) {
        return Report.create({ name: 'completion', scheduling: 'none', receiver,
            docproperty: {}, content: { items: [{ type: 'text', text: 'Synthetic report', size: 10 }] }
        }, { settings: { reportsDir: directory }, logger: { info() {}, error: text => errors.push(text) },
            notificatorMgr: { sendMailMessage } });
    }
    function verifyPdf(filename) {
        const bytes = fs.readFileSync(filename);
        assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
        assert.match(bytes.subarray(-20).toString(), /%%EOF/);
    }
    for (const fail of [false, true]) {
        it(`waits for ${fail ? 'failed' : 'successful'} mail settlement after the PDF is complete`, async function () {
            let release, called;
            const gate = new Promise((resolve, reject) => { release = () => fail ? reject(new Error('synthetic mail failure')) : resolve(); });
            const mailCalled = new Promise(resolve => { called = resolve; });
            const errors = [], calls = [];
            const report = create('recipient@example.invalid', (...args) => { calls.push(args); called(); return gate; }, errors);
            let settled = false;
            const executing = report.execute(new Date(2026, 0, 15, 3), true);
            executing.then(() => { settled = true; }, () => { settled = true; });
            try {
                await mailCalled;
                await new Promise(resolve => setImmediate(resolve));
                assert.equal(calls.length, 1);
                const args = calls[0];
                assert.deepEqual(args.slice(0, 5), [null, 'recipient@example.invalid', 'Report completion', '', null]);
                verifyPdf(args[5].path);
                assert.equal(settled, false, 'report must remain pending while mail is pending');
                release();
                assert.equal(await executing, args[5].path);
                assert.deepEqual(errors, fail ? ['report.send.failed: Error: synthetic mail failure'] : []);
            } finally {
                release();
                await executing;
            }
        });
    }
    it('returns the complete PDF without invoking mail when no receiver is configured', async function () {
        const report = create(undefined, () => { throw new Error('mail must not be invoked'); });
        verifyPdf(await report.execute(new Date(2026, 0, 15, 3), true));
    });
    it('preserves rejection when the mail method throws synchronously', async function () {
        const failure = new Error('synthetic synchronous failure');
        const report = create('recipient@example.invalid', () => { throw failure; });
        await assert.rejects(report.execute(new Date(2026, 0, 15, 3), true), error => error === failure);
    });
});
