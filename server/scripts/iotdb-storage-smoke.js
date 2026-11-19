'use strict';

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Session } = require('@iotdb/client');
const storageModule = require('../runtime/storage/iotdb');

async function run() {
    const host = process.env.IOTDB_HOST || '127.0.0.1';
    const port = Number(process.env.IOTDB_PORT) || 6667;
    const database = `root.fuxa_smoke_${randomUUID().replace(/-/g, '')}`;
    const credentials = {
        username: process.env.IOTDB_USERNAME || 'root',
        password: process.env.IOTDB_PASSWORD || 'root',
    };
    const runId = `fuxa-${Date.now()}`;
    const adapter = storageModule.create({
        daqstore: {
            host,
            iotdbPort: port,
            iotdbDatabase: database,
            credentials,
        },
    }, {
        info(message) { console.log(message); },
        warn(message) { console.warn(message); },
        error(message) { console.error(message); },
    });

    try {
        const samples = [
            ['numeric', 26.5],
            ['boolean', true],
            ['text', "ready-'checked"],
            ['binary', Buffer.from([0, 1, 127, 255])],
        ];
        const start = Date.now();
        for (let index = 0; index < samples.length; index++) {
            const [tagId, value] = samples[index];
            const timestamp = start + index;
            await adapter.addDaqValues({
                [tagId]: { id: tagId, value, timestamp, daq: { enabled: true } },
            }, 'FUXA IoTDB smoke', runId);
            const history = await adapter.getDaqValue(tagId, timestamp - 1, timestamp + 1);
            assert.deepEqual(history, [{ dt: timestamp, value }], `unexpected IoTDB history for ${tagId}`);
        }
        console.log(`IoTDB storage smoke passed at ${host}:${port} in ${database}`);
    } finally {
        try {
            await adapter.close();
        } finally {
            const cleanup = new Session({ host, port, ...credentials });
            await cleanup.open();
            try {
                await cleanup.executeNonQueryStatement(`DELETE DATABASE ${database}`);
            } finally {
                await cleanup.close();
            }
        }
    }
}

run().catch(error => {
    console.error(`IoTDB storage smoke failed: ${error.message}`);
    process.exitCode = 1;
});
