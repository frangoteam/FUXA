'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const os = require('os');
const path = require('path');

const CUSTOM_MIB = `FUXA-TEST-MIB DEFINITIONS ::= BEGIN

IMPORTS
    MODULE-IDENTITY, OBJECT-TYPE, enterprises, Integer32
        FROM SNMPv2-SMI;

fuxaTest MODULE-IDENTITY
    LAST-UPDATED "202610190000Z"
    ORGANIZATION "FUXA"
    CONTACT-INFO "n/a"
    DESCRIPTION "Test MIB"
    ::= { enterprises 8072 9999 }

testInt OBJECT-TYPE
    SYNTAX Integer32
    MAX-ACCESS read-write
    STATUS current
    DESCRIPTION "Test integer"
    ::= { fuxaTest 1 }

END
`;

describe('SNMP MIB store', () => {
    let snmp;
    let mibStore;
    let mibsDir;
    let logger;
    let logs;

    before(() => {
        snmp = require('net-snmp');
    });

    beforeEach(() => {
        logs = { info: [], warn: [], error: [] };
        logger = {
            info: (m) => logs.info.push(m),
            warn: (m) => logs.warn.push(m),
            error: (m) => logs.error.push(m)
        };
        mibsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fuxa-mibs-'));
        delete require.cache[require.resolve('../../runtime/devices/snmp/mib-store')];
        mibStore = require('../../runtime/devices/snmp/mib-store');
        mibStore.init(snmp, mibsDir, logger);
    });

    afterEach(() => {
        mibStore.reset();
        fs.rmSync(mibsDir, { recursive: true, force: true });
    });

    it('passes numeric OIDs through, without the leading dot', () => {
        assert.equal(mibStore.toOid('1.3.6.1.2.1.1.5.0'), '1.3.6.1.2.1.1.5.0');
        assert.equal(mibStore.toOid('.1.3.6.1.2.1.1.5.0'), '1.3.6.1.2.1.1.5.0');
        assert.equal(mibStore.toOid(' 1.3.6.1.2.1.1.5.0 '), '1.3.6.1.2.1.1.5.0');
        assert.equal(mibStore.isSymbolic('1.3.6.1.2.1.1.5.0'), false);
    });

    it('resolves names of the base modules with the instance', () => {
        assert.equal(mibStore.toOid('SNMPv2-MIB::sysName.0'), '1.3.6.1.2.1.1.5.0');
        assert.equal(mibStore.toOid('SNMPv2-MIB::sysName'), '1.3.6.1.2.1.1.5');
        assert.equal(mibStore.toOid('IF-MIB::ifInOctets.3'), '1.3.6.1.2.1.2.2.1.10.3');
        assert.equal(mibStore.toOid('IF-MIB::ifHCInOctets.1.2'), '1.3.6.1.2.1.31.1.1.1.6.1.2');
        assert.equal(mibStore.isSymbolic('IF-MIB::ifInOctets.3'), true);
    });

    it('returns null for unknown names and invalid addresses', () => {
        assert.equal(mibStore.toOid('FOO-MIB::bar.0'), null);
        assert.equal(mibStore.toOid('sysName.0'), null);     // module prefix required
        assert.equal(mibStore.toOid('1.3.6.x'), null);
        assert.equal(mibStore.toOid(''), null);
        assert.equal(mibStore.toOid(undefined), null);
    });

    it('translates OIDs to the longest known name', () => {
        assert.equal(mibStore.toName('1.3.6.1.2.1.1.5.0'), 'SNMPv2-MIB::sysName.0');
        assert.equal(mibStore.toName('1.3.6.1.2.1.2.2.1.10.3'), 'IF-MIB::ifInOctets.3');
        assert.equal(mibStore.toName('1.3.6.1.6.3.1.1.4.1.0'), 'SNMPv2-MIB::snmpTrapOID.0');
        assert.equal(mibStore.toName('1.3.6.1.4.1.55555.1.2'), 'SNMPv2-SMI::enterprises.55555.1.2');
        assert.equal(mibStore.toName('not an oid'), null);
    });

    it('loads the MIB files of the mibs directory on refresh', () => {
        assert.equal(mibStore.toOid('FUXA-TEST-MIB::testInt.0'), null);
        fs.writeFileSync(path.join(mibsDir, 'FUXA-TEST-MIB.mib'), CUSTOM_MIB);
        fs.writeFileSync(path.join(mibsDir, 'notes.md'), 'ignored');
        mibStore.refresh();
        assert.equal(mibStore.toOid('FUXA-TEST-MIB::testInt.0'), '1.3.6.1.4.1.8072.9999.1.0');
        assert.equal(mibStore.toName('1.3.6.1.4.1.8072.9999.1.0'), 'FUXA-TEST-MIB::testInt.0');
        assert.ok(logs.info.some(m => /loaded FUXA-TEST-MIB.mib/.test(m)));
        mibStore.refresh();
        assert.equal(logs.info.filter(m => /loaded FUXA-TEST-MIB.mib/.test(m)).length, 1);
    });

    it('ignores a missing mibs directory', () => {
        fs.rmSync(mibsDir, { recursive: true, force: true });
        mibStore.refresh();
        assert.equal(mibStore.toOid('SNMPv2-MIB::sysName.0'), '1.3.6.1.2.1.1.5.0');
        assert.deepEqual(logs.error, []);
    });

    it('works without a module store', () => {
        mibStore.reset();
        mibStore.init({}, mibsDir, logger);
        assert.equal(mibStore.toOid('1.3.6.1.2.1.1.5.0'), '1.3.6.1.2.1.1.5.0');
        assert.equal(mibStore.toOid('SNMPv2-MIB::sysName.0'), null);
        assert.equal(mibStore.toName('1.3.6.1.2.1.1.5.0'), null);
    });
});
