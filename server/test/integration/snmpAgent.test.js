'use strict';

/**
 * Loopback test of the SNMP driver against the agent shipped with net-snmp:
 * real UDP datagrams on 127.0.0.1, v2c community and v3 authPriv user.
 */

const assert = require('assert').strict;
const EventEmitter = require('events');

const AGENT_PORT = 16161;
const INT_OID = '1.3.6.1.4.1.8072.9999.1';
const STR_OID = '1.3.6.1.4.1.8072.9999.2';
const COUNTER64_OID = '1.3.6.1.4.1.8072.9999.3';
const COMMUNITY = 'fuxa-community';
const V3_USER = { uid: 'fuxa', pwd: 'authkey12345', privKey: 'privkey12345' };

describe('SNMP driver against a loopback net-snmp agent', function () {
    this.timeout(10000);

    let snmp;
    let driver;
    let agent;
    let mib;
    let logger;
    let device;

    before(() => {
        snmp = require('net-snmp');
        driver = require('../../runtime/devices/snmp');
        agent = snmp.createAgent({ port: AGENT_PORT, address: '127.0.0.1' }, () => { /* authorization errors are expected in the tests */ });
        mib = agent.getMib();
        mib.registerProvider({ name: 'sysUpTime', type: snmp.MibProviderType.Scalar, oid: '1.3.6.1.2.1.1.3', scalarType: snmp.ObjectType.TimeTicks, maxAccess: snmp.MaxAccess['read-only'] });
        mib.registerProvider({ name: 'testInt', type: snmp.MibProviderType.Scalar, oid: INT_OID, scalarType: snmp.ObjectType.Integer, maxAccess: snmp.MaxAccess['read-write'] });
        mib.registerProvider({ name: 'testStr', type: snmp.MibProviderType.Scalar, oid: STR_OID, scalarType: snmp.ObjectType.OctetString, maxAccess: snmp.MaxAccess['read-write'] });
        mib.registerProvider({ name: 'testCounter64', type: snmp.MibProviderType.Scalar, oid: COUNTER64_OID, scalarType: snmp.ObjectType.Counter64, maxAccess: snmp.MaxAccess['read-only'] });
        mib.setScalarValue('sysUpTime', 1234);
        mib.setScalarValue('testInt', 42);
        mib.setScalarValue('testStr', 'hello');
        const counter64 = Buffer.alloc(8);
        counter64.writeBigUInt64BE(BigInt('9007199254740993'));
        mib.setScalarValue('testCounter64', counter64);
        agent.getAuthorizer().addCommunity(COMMUNITY);
        agent.getAuthorizer().addUser({
            name: V3_USER.uid,
            level: snmp.SecurityLevel.authPriv,
            authProtocol: snmp.AuthProtocols.sha256,
            authKey: V3_USER.pwd,
            privProtocol: snmp.PrivProtocols.aes,
            privKey: V3_USER.privKey
        });
    });

    after((done) => {
        agent.close(() => done());
    });

    beforeEach(() => {
        logger = { info() { }, warn() { }, error() { } };
    });

    afterEach(async () => {
        if (device) {
            await device.disconnect();
            device = null;
        }
    });

    function createDevice(options, security) {
        const config = {
            id: 'snmp-live',
            name: 'SNMP live',
            property: { address: '127.0.0.1', port: AGENT_PORT, options: Object.assign({ timeout: 1000, retries: 0 }, options) },
            tags: {
                uptime: { id: 'uptime', name: 'uptime', address: 'SNMPv2-MIB::sysUpTime.0', type: 'TimeTicks' },
                int: { id: 'int', name: 'int', address: `${INT_OID}.0`, type: 'Integer' },
                str: { id: 'str', name: 'str', address: `${STR_OID}.0`, type: 'OctetString' },
                big: { id: 'big', name: 'big', address: `${COUNTER64_OID}.0`, type: 'Counter64' }
            }
        };
        device = driver.create(config, logger, new EventEmitter(), null, undefined);
        device.load(config);
        device.bindGetProperty(() => Promise.resolve({ value: JSON.stringify(security) }));
        return device;
    }

    it('reads and writes with v2c', async () => {
        createDevice({ version: 'v2c' }, { pwd: COMMUNITY });
        await device.connect();
        assert.equal(device.isConnected(), true);
        await device.polling();
        const values = device.getValues();
        assert.equal(values.uptime.value, 1234);
        assert.equal(values.int.value, 42);
        assert.equal(values.str.value, 'hello');
        assert.equal(values.big.value, 9007199254740992);    // precision lost above 2^53
        assert.equal(await device.setValue('int', 7), true);
        assert.equal(await device.setValue('str', 'fuxa'), true);
        assert.equal(mib.getScalarValue('testInt'), 7);
        assert.equal(mib.getScalarValue('testStr').toString(), 'fuxa');
        await device.polling();
        assert.equal(device.getValues().int.value, 7);
        assert.equal(device.getValues().str.value, 'fuxa');
    });

    it('reads with v3 authPriv', async () => {
        createDevice({ version: 'v3', securityLevel: 'authPriv', authProtocol: 'sha256', privProtocol: 'aes' }, V3_USER);
        await device.connect();
        assert.equal(device.isConnected(), true);
        await device.polling();
        assert.equal(device.getValues().uptime.value, 1234);
        assert.equal(device.getValues().str.value, mib.getScalarValue('testStr').toString());
    });

    it('browses the agent subtree', async () => {
        createDevice({ version: 'v2c' }, { pwd: COMMUNITY });
        await device.connect();
        const result = await device.browse({ oid: '1.3.6.1.4.1.8072.9999' });
        assert.equal(result.truncated, false);
        assert.equal(result.items[0].name, `SNMPv2-SMI::enterprises.8072.9999.1.0`);
        assert.deepEqual(result.items.map(item => [item.address, item.type]), [
            [`${INT_OID}.0`, 'Integer'],
            [`${STR_OID}.0`, 'OctetString'],
            [`${COUNTER64_OID}.0`, 'Counter64']
        ]);
        assert.equal(result.items[0].value, mib.getScalarValue('testInt'));
        const limited = await device.browse({ oid: '1.3.6.1.4.1.8072.9999', max: 1 });
        assert.equal(limited.total, 1);
        assert.equal(limited.truncated, true);
    });

    describe('traps and informs', () => {
        const TRAP_PORT = 16162;
        const TRAP_OID = '1.3.6.1.6.3.1.1.4.1.0';
        const IF_INDEX_OID = '1.3.6.1.2.1.2.2.1.1.3';
        const ENTERPRISE_TRAP = '1.3.6.1.4.1.8072.9999.0.1';
        let sender;

        afterEach(() => {
            if (sender) {
                sender.close();
                sender = null;
            }
        });

        function createTrapDevice(options, security) {
            createDevice(Object.assign({ trapsEnabled: true, trapPort: TRAP_PORT }, options), security);
            device.load({
                id: 'snmp-live',
                name: 'SNMP live',
                property: { address: '127.0.0.1', port: AGENT_PORT, options: Object.assign({ timeout: 1000, retries: 0, trapsEnabled: true, trapPort: TRAP_PORT }, options) },
                tags: {
                    uptime: { id: 'uptime', name: 'uptime', address: '1.3.6.1.2.1.1.3.0', type: 'TimeTicks' },
                    trap: { id: 'trap', name: 'trap', address: TRAP_OID, type: 'OID', options: { trapOnly: true } },
                    ifIndex: { id: 'ifIndex', name: 'ifIndex', address: IF_INDEX_OID, type: 'Integer', options: { trapOnly: true } }
                }
            });
            return device;
        }

        function waitForValue(tagId, expected, timeout = 3000) {
            return new Promise((resolve, reject) => {
                const started = Date.now();
                const check = () => {
                    const values = device.getValues();
                    if (values[tagId] && values[tagId].value === expected) {
                        return resolve();
                    }
                    if (Date.now() - started > timeout) {
                        return reject(new Error(`tag ${tagId} not updated, value ${values[tagId] ? values[tagId].value : 'undefined'}`));
                    }
                    setTimeout(check, 20);
                };
                check();
            });
        }

        it('receives a v2c trap', async () => {
            createTrapDevice({ version: 'v2c' }, { pwd: COMMUNITY });
            await device.connect();
            sender = snmp.createSession('127.0.0.1', COMMUNITY, { version: snmp.Version2c, trapPort: TRAP_PORT });
            sender.trap(ENTERPRISE_TRAP, [{ oid: IF_INDEX_OID, type: snmp.ObjectType.Integer, value: 3 }], () => { });
            await waitForValue('trap', ENTERPRISE_TRAP);
            assert.equal(device.getValues().ifIndex.value, 3);
        });

        it('receives and acknowledges a v3 inform', async () => {
            createTrapDevice({ version: 'v3', securityLevel: 'authPriv', authProtocol: 'sha256', privProtocol: 'aes' }, V3_USER);
            await device.connect();
            sender = snmp.createV3Session('127.0.0.1', {
                name: V3_USER.uid, level: snmp.SecurityLevel.authPriv,
                authProtocol: snmp.AuthProtocols.sha256, authKey: V3_USER.pwd,
                privProtocol: snmp.PrivProtocols.aes, privKey: V3_USER.privKey
            }, { version: snmp.Version3, trapPort: TRAP_PORT, timeout: 1000 });
            const acknowledged = new Promise((resolve, reject) => {
                sender.inform(ENTERPRISE_TRAP, [{ oid: IF_INDEX_OID, type: snmp.ObjectType.Integer, value: 7 }], (err) => err ? reject(err) : resolve());
            });
            await acknowledged;
            await waitForValue('ifIndex', 7);
            assert.equal(device.getValues().trap.value, ENTERPRISE_TRAP);
        });

        it('ignores a trap with a wrong community', async () => {
            createTrapDevice({ version: 'v2c' }, { pwd: COMMUNITY });
            await device.connect();
            sender = snmp.createSession('127.0.0.1', 'wrong', { version: snmp.Version2c, trapPort: TRAP_PORT });
            sender.trap(ENTERPRISE_TRAP, [{ oid: IF_INDEX_OID, type: snmp.ObjectType.Integer, value: 3 }], () => { });
            await assert.rejects(waitForValue('ifIndex', 3, 800), /not updated/);
        });
    });

    it('fails to connect with a wrong v2c community', async () => {
        createDevice({ version: 'v2c' }, { pwd: 'wrong' });
        await assert.rejects(device.connect(), /timed out/);
        assert.equal(device.isConnected(), false);
        assert.equal(device.getStatus(), 'connect-error');
    });

    it('fails to connect with a wrong v3 authentication key', async () => {
        createDevice({ version: 'v3', securityLevel: 'authPriv', authProtocol: 'sha256', privProtocol: 'aes' }, Object.assign({}, V3_USER, { pwd: 'wrongkey12345' }));
        await assert.rejects(device.connect(), /timed out/);
        assert.equal(device.isConnected(), false);
    });
});
