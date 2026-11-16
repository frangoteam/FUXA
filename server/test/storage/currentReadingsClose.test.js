const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

describe('Current readings timer lifecycle', function () {
    for (const mode of ['after initialization', 'during initialization', 'twice']) {
        it('exits naturally after closing ' + mode, function () {
            const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fuxa-current-close-'));
            try {
                const result = spawnSync(process.execPath, ['--unhandled-rejections=strict', '-e', `
                    const storageModule = require(process.argv[1]);
                    const mode = process.argv[3];
                    let storage;
                    function close() {
                        storage.close();
                        if (mode === 'twice') storage.close();
                        console.log('closed');
                    }
                    storage = storageModule.create({ dbDir: process.argv[2] }, {
                        info(message) {
                            if (message === 'currentstorage init successful!' && mode !== 'during initialization') {
                                queueMicrotask(close);
                            }
                        },
                        error(message) { throw new Error(message); }
                    });
                    if (mode === 'during initialization') close();
                `, require.resolve('../../runtime/storage/sqlite/currentstorage'), directory, mode], {
                    encoding: 'utf8', timeout: 3000, maxBuffer: 16000,
                    env: { PATH: process.env.PATH, TZ: 'UTC' }
                });
                assert.equal(result.error, undefined, result.error?.message);
                assert.equal(result.status, 0, result.stderr);
                assert.equal(result.signal, null);
                assert.equal(result.stdout.trim(), 'closed');
                assert.equal(result.stderr, '');
            } finally {
                fs.rmSync(directory, { recursive: true, force: true });
            }
        });
    }
});
