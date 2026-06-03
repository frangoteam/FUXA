'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const prjstorage = require('../../runtime/project/prjstorage');
const apiKeysStorage = require('../../runtime/apikeys/apikeysStorage');
const alarmstorage = require('../../runtime/alarms/alarmstorage');

function makeLogger() {
    return {
        info: () => {},
        warn: () => {},
        error: () => {}
    };
}

describe('Storage insert/select regression', () => {
    let expect;
    const tmpDirs = [];

    before(async () => {
        const chai = await import('chai');
        expect = chai.expect;
    });

    after(() => {
        tmpDirs.forEach(dir => {
            try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
        });
    });

    describe('project/prjstorage', () => {
        let workDir;

        beforeEach(async () => {
            workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fuxa-prjstorage-'));
            tmpDirs.push(workDir);
            await prjstorage.init({ workDir }, makeLogger());
        });

        afterEach(() => {
            prjstorage.close();
        });

        it('insert/select on single section works', async () => {
            await prjstorage.setSection({
                table: prjstorage.TableType.GENERAL,
                name: 'app-name',
                value: { title: 'FUXA' }
            });

            const rows = await prjstorage.getSection(prjstorage.TableType.GENERAL, 'app-name');
            expect(rows).to.have.length(1);
            expect(rows[0].name).to.equal('app-name');
            expect(JSON.parse(rows[0].value)).to.deep.equal({ title: 'FUXA' });
        });

        it('batch insert/select with setSections works', async () => {
            await prjstorage.setSections([
                { table: prjstorage.TableType.VIEWS, name: 'view-1', value: { id: 'view-1' } },
                { table: prjstorage.TableType.VIEWS, name: 'view-2', value: { id: 'view-2' } }
            ]);

            const rows = await prjstorage.getSection(prjstorage.TableType.VIEWS);
            const names = rows.map(r => r.name).sort();

            expect(rows).to.have.length(2);
            expect(names).to.deep.equal(['view-1', 'view-2']);
        });
    });

    describe('apikeys/apiKeysStorage', () => {
        let workDir;

        beforeEach(async () => {
            workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fuxa-apikeys-'));
            tmpDirs.push(workDir);
            await apiKeysStorage.init({ workDir }, makeLogger());
        });

        afterEach(() => {
            apiKeysStorage.close();
        });

        it('insert/select api keys works for multiple records', async () => {
            await apiKeysStorage.setApiKeys([
                { id: 'key-1', token: 'abc' },
                { id: 'key-2', token: 'def' }
            ]);

            const rows = await apiKeysStorage.getApiKeys();
            const ids = rows.map(r => JSON.parse(r.value).id).sort();

            expect(rows).to.have.length(2);
            expect(ids).to.deep.equal(['key-1', 'key-2']);
        });
    });

    describe('alarms/alarmstorage', () => {
        let workDir;

        beforeEach(async () => {
            workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fuxa-alarms-'));
            tmpDirs.push(workDir);
            await alarmstorage.init({ workDir }, makeLogger());
        });

        afterEach(() => {
            alarmstorage.close();
        });

        it('insert/select alarms and history works', async () => {
            const alarm = {
                getId: () => 'dev1.tag1',
                type: 'digital',
                status: 'active',
                ontime: 1710000000000,
                offtime: 0,
                acktime: 0,
                userack: '',
                toremove: false,
                subproperty: { group: 'default', text: 'High temperature' }
            };

            await alarmstorage.setAlarms([alarm]);

            const active = await alarmstorage.getAlarms();
            expect(active).to.have.length(1);
            expect(active[0].nametype).to.equal('dev1.tag1');
            expect(active[0].status).to.equal('active');

            const history = await alarmstorage.getAlarmsHistory(0, Number.MAX_SAFE_INTEGER);
            expect(history.length).to.be.greaterThan(0);
            expect(history[0].nametype).to.equal('dev1.tag1');
        });
    });
});
