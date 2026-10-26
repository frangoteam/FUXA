'use strict';

const assert = require('assert').strict;
const EventEmitter = require('events');
const Module = require('module');
const sinon = require('sinon');

// net-snmp constants, as the real library defines them.
const ObjectType = {
    Boolean: 1, Integer: 2, OctetString: 4, Null: 5, OID: 6, IpAddress: 64, Counter: 65, Gauge: 66,
    TimeTicks: 67, Opaque: 68, Counter64: 70, NoSuchObject: 128, NoSuchInstance: 129, EndOfMibView: 130,
    Integer32: 2, Counter32: 65, Gauge32: 66, Unsigned32: 66
};
const PduType = { Trap: 164, InformRequest: 166, TrapV2: 167 };
const SecurityLevel = { noAuthNoPriv: 1, authNoPriv: 2, authPriv: 3 };
const AuthProtocols = { none: 1, md5: 2, sha: 3, sha224: 4, sha256: 5, sha384: 6, sha512: 7 };
const PrivProtocols = { none: 1, des: 2, aes: 4, aes256b: 6, aes256r: 8 };
const SYS_UPTIME_OID = '1.3.6.1.2.1.1.3.0';

describe('SNMP driver', () => {
    let driver;
    let snmpMock;
    let session;
    let receiver;
    let logger;
    let events;
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        session = {
            get: sandbox.stub().callsFake((oids, callback) => {
                callback(null, oids.map(oid => ({ oid, type: ObjectType.Integer, value: 1 })));
            }),
            set: sandbox.stub().callsFake((varbinds, callback) => callback(null, varbinds)),
            subtree: sandbox.stub().callsFake((oid, maxRepetitions, feed, done) => {
                feed([
                    { oid: `${oid}.1.5.0`, type: ObjectType.OctetString, value: Buffer.from('router-1') },
                    { oid: `${oid}.1.7.0`, type: ObjectType.Integer, value: 72 },
                    { oid: `${oid}.2.2.1.6.1`, type: ObjectType.OctetString, value: Buffer.from([0x00, 0x1a, 0x2b]) },
                    { oid: `${oid}.2.2.1.10.1`, type: ObjectType.Counter32, value: 1234 },
                    { oid: `${oid}.4.20.1.1.1`, type: ObjectType.IpAddress, value: '10.0.0.1' },
                    { oid: `${oid}.99`, type: ObjectType.NoSuchObject, value: null }
                ]);
                done(null);
            }),
            on: sandbox.stub(),
            close: sandbox.stub()
        };
        const authorizer = {
            communities: [], users: [],
            addCommunity(c) { this.communities.push(c); },
            getCommunities() { return this.communities; },
            deleteCommunity(c) { this.communities = this.communities.filter(x => x !== c); },
            addUser(u) { this.users.push(u); },
            getUsers() { return this.users; },
            deleteUser(name) { this.users = this.users.filter(x => x.name !== name); }
        };
        receiver = {
            callback: null,
            authorizer: authorizer,
            getAuthorizer: () => authorizer,
            close: sandbox.stub().callsFake(cb => cb && cb())
        };
        snmpMock = {
            Version1: 0,
            Version2c: 1,
            Version3: 3,
            ObjectType,
            PduType,
            SecurityLevel,
            AuthProtocols,
            PrivProtocols,
            createSession: sandbox.stub().returns(session),
            createV3Session: sandbox.stub().returns(session),
            createReceiver: sandbox.stub().callsFake((options, callback) => {
                receiver.options = options;
                receiver.callback = callback;
                return receiver;
            }),
            isVarbindError: (varbind) => [ObjectType.NoSuchObject, ObjectType.NoSuchInstance, ObjectType.EndOfMibView].includes(varbind.type),
            varbindError: (varbind) => `error type ${varbind.type}`
        };
        logger = { info: sandbox.spy(), warn: sandbox.spy(), error: sandbox.spy() };
        events = new EventEmitter();
        delete require.cache[require.resolve('../../runtime/devices/snmp')];
        delete require.cache[require.resolve('../../runtime/devices/snmp/trap-receiver')];
        delete require.cache[require.resolve('../../runtime/devices/snmp/mib-store')];

        const originalLoad = Module._load;
        sandbox.stub(Module, '_load').callsFake(function (request, parent, isMain) {
            if (request === 'net-snmp' && parent.filename === require.resolve('../../runtime/devices/snmp')) {
                return snmpMock;
            }
            return originalLoad.apply(this, arguments);
        });
        driver = require('../../runtime/devices/snmp');
    });

    afterEach(() => {
        sandbox.restore();
        delete require.cache[require.resolve('../../runtime/devices/snmp')];
        delete require.cache[require.resolve('../../runtime/devices/snmp/trap-receiver')];
        delete require.cache[require.resolve('../../runtime/devices/snmp/mib-store')];
    });

    function createDevice(overrides = {}, security = null) {
        const config = Object.assign({
            id: 'snmp1',
            name: 'SNMP test',
            property: { address: '192.168.1.10', port: 161, options: { version: 'v2c' } },
            tags: {
                tag1: { id: 'tag1', name: 'sysUpTime', address: SYS_UPTIME_OID, type: 'TimeTicks' }
            }
        }, overrides);
        const device = driver.create(config, logger, events, null, undefined);
        device.load(config);   // the Device wrapper calls load after create
        device.bindGetProperty(() => Promise.resolve(security ? { value: JSON.stringify(security) } : null));
        return device;
    }

    function tags(count) {
        const result = {};
        for (let index = 0; index < count; index++) {
            result[`tag${index}`] = { id: `tag${index}`, name: `tag${index}`, address: `1.3.6.1.4.1.1.${index}.0`, type: 'Integer' };
        }
        return result;
    }

    describe('session creation', () => {
        it('creates a v2c session with the stored community', async () => {
            const device = createDevice({}, { pwd: 'secret' });
            await device.connect();
            sinon.assert.calledOnce(snmpMock.createSession);
            const [target, community, options] = snmpMock.createSession.firstCall.args;
            assert.equal(target, '192.168.1.10');
            assert.equal(community, 'secret');
            assert.equal(options.version, snmpMock.Version2c);
            assert.equal(options.port, 161);
            assert.equal(options.transport, 'udp4');
            sinon.assert.notCalled(snmpMock.createV3Session);
            assert.equal(device.isConnected(), true);
            assert.equal(device.getStatus(), 'connect-ok');
        });

        it('creates a v1 session with the default community when no security is stored', async () => {
            const device = createDevice({ property: { address: '10.0.0.1', port: '1161', options: { version: 'v1' } } });
            await device.connect();
            const [target, community, options] = snmpMock.createSession.firstCall.args;
            assert.equal(target, '10.0.0.1');
            assert.equal(community, 'public');
            assert.equal(options.version, snmpMock.Version1);
            assert.equal(options.port, 1161);
        });

        it('creates a v3 authPriv session with user, protocols and keys', async () => {
            const device = createDevice({
                property: { address: 'agent.local', port: 161, options: { version: 'v3', securityLevel: 'authPriv', authProtocol: 'sha256', privProtocol: 'aes256r', context: 'ctx', timeout: 2000, retries: 2 } }
            }, { uid: 'fuxa', pwd: 'authkey123', privKey: 'privkey123' });
            await device.connect();
            sinon.assert.calledOnce(snmpMock.createV3Session);
            const [target, user, options] = snmpMock.createV3Session.firstCall.args;
            assert.equal(target, 'agent.local');
            assert.deepEqual(user, {
                name: 'fuxa',
                level: SecurityLevel.authPriv,
                authProtocol: AuthProtocols.sha256,
                authKey: 'authkey123',
                privProtocol: PrivProtocols.aes256r,
                privKey: 'privkey123'
            });
            assert.equal(options.version, snmpMock.Version3);
            assert.equal(options.context, 'ctx');
            assert.equal(options.timeout, 2000);
            assert.equal(options.retries, 2);
        });

        it('creates a v3 noAuthNoPriv session without keys', async () => {
            const device = createDevice({
                property: { address: 'agent.local', options: { version: 'v3', securityLevel: 'noAuthNoPriv' } }
            }, { uid: 'reader' });
            await device.connect();
            const user = snmpMock.createV3Session.firstCall.args[1];
            assert.deepEqual(user, { name: 'reader', level: SecurityLevel.noAuthNoPriv });
        });

        it('defaults to v3 authPriv with sha256/aes when no options are stored', async () => {
            const device = createDevice({ property: { address: 'agent.local' } }, { uid: 'fuxa', pwd: 'authkey', privKey: 'privkey' });
            await device.connect();
            const user = snmpMock.createV3Session.firstCall.args[1];
            assert.equal(user.level, SecurityLevel.authPriv);
            assert.equal(user.authProtocol, AuthProtocols.sha256);
            assert.equal(user.privProtocol, PrivProtocols.aes);
        });

        it('rejects a v3 session when the authentication key is missing', async () => {
            const device = createDevice({ property: { address: 'agent.local', options: { version: 'v3', securityLevel: 'authNoPriv' } } }, { uid: 'fuxa' });
            const statuses = [];
            events.on('device-status:changed', event => statuses.push(event.status));
            await assert.rejects(device.connect(), /authentication key/);
            sinon.assert.notCalled(snmpMock.createV3Session);
            assert.equal(device.isConnected(), false);
            assert.deepEqual(statuses, ['connect-error']);
        });

        it('rejects when the address is missing', async () => {
            const device = createDevice({ property: {} });
            await assert.rejects(device.connect(), /missing address/);
            assert.equal(device.getStatus(), 'connect-error');
        });
    });

    describe('connect probe', () => {
        it('probes sysUpTime and reports connect-error when the agent does not answer', async () => {
            session.get.callsFake((oids, callback) => callback(new Error('Request timed out')));
            const device = createDevice();
            await assert.rejects(device.connect(), /timed out/);
            sinon.assert.calledOnce(session.get);
            assert.deepEqual(session.get.firstCall.args[0], [SYS_UPTIME_OID]);
            sinon.assert.calledOnce(session.close);
            assert.equal(device.isConnected(), false);
            assert.equal(device.getStatus(), 'connect-error');
        });

        it('closes the session on disconnect', async () => {
            const device = createDevice();
            await device.connect();
            await device.disconnect();
            sinon.assert.calledOnce(session.close);
            assert.equal(device.isConnected(), false);
            assert.equal(device.getStatus(), 'connect-off');
        });
    });

    describe('polling', () => {
        it('splits the OIDs in chunks of maxOidsPerRequest', async () => {
            const device = createDevice({
                property: { address: 'a', options: { version: 'v2c', maxOidsPerRequest: 10 } },
                tags: tags(26)
            });
            await device.connect();
            session.get.resetHistory();
            await device.polling();
            sinon.assert.calledThrice(session.get);
            assert.equal(session.get.firstCall.args[0].length, 10);
            assert.equal(session.get.secondCall.args[0].length, 10);
            assert.equal(session.get.thirdCall.args[0].length, 6);
            assert.equal(session.get.firstCall.args[0][0], '1.3.6.1.4.1.1.0.0');
            assert.equal(Object.keys(device.getValues()).length, 26);
        });

        it('decodes the varbind types and emits the values', async () => {
            const device = createDevice({
                tags: {
                    int: { id: 'int', name: 'int', address: '1.3.6.1.2.1.1.7.0', type: 'Integer' },
                    str: { id: 'str', name: 'str', address: '1.3.6.1.2.1.1.5.0', type: 'OctetString' },
                    hex: { id: 'hex', name: 'hex', address: '1.3.6.1.2.1.2.2.1.6.1', type: 'Hex' },
                    mac: { id: 'mac', name: 'mac', address: '1.3.6.1.2.1.2.2.1.6.2', type: 'OctetString' },
                    c64: { id: 'c64', name: 'c64', address: '1.3.6.1.2.1.31.1.1.1.6.1', type: 'Counter64' },
                    ip: { id: 'ip', name: 'ip', address: '1.3.6.1.2.1.4.20.1.1.1', type: 'IpAddress' },
                    numstr: { id: 'numstr', name: 'numstr', address: '1.3.6.1.4.1.9.9.1.0', type: 'Gauge32' },
                    missing: { id: 'missing', name: 'missing', address: '1.3.6.1.4.1.9.9.2.0', type: 'Integer' }
                }
            });
            const c64 = Buffer.alloc(8);
            c64.writeBigUInt64BE(BigInt(5000000000));
            session.get.callsFake((oids, callback) => {
                if (oids[0] === SYS_UPTIME_OID) {
                    return callback(null, [{ oid: SYS_UPTIME_OID, type: ObjectType.TimeTicks, value: 12 }]);
                }
                callback(null, [
                    { oid: oids[0], type: ObjectType.Integer, value: 72 },
                    { oid: oids[1], type: ObjectType.OctetString, value: Buffer.from('router-1') },
                    { oid: oids[2], type: ObjectType.OctetString, value: Buffer.from([0x00, 0x1a, 0x2b, 0x3c, 0x4d, 0x5e]) },
                    { oid: oids[3], type: ObjectType.OctetString, value: Buffer.from([0x00, 0x1a, 0x2b, 0x3c, 0x4d, 0x5e]) },
                    { oid: oids[4], type: ObjectType.Counter64, value: c64 },
                    { oid: oids[5], type: ObjectType.IpAddress, value: '192.168.1.1' },
                    { oid: oids[6], type: ObjectType.OctetString, value: Buffer.from('42.5') },
                    { oid: oids[7], type: ObjectType.NoSuchInstance, value: null }
                ]);
            });
            const emitted = [];
            events.on('device-value:changed', event => emitted.push(event));
            await device.connect();
            await device.polling();
            const values = device.getValues();
            assert.equal(values.int.value, 72);
            assert.equal(values.str.value, 'router-1');
            assert.equal(values.hex.value, '001a2b3c4d5e');
            assert.equal(values.mac.value, '001a2b3c4d5e');
            assert.equal(values.c64.value, 5000000000);
            assert.equal(values.ip.value, '192.168.1.1');
            assert.equal(values.numstr.value, 42.5);
            assert.equal(values.missing.value, null);
            sinon.assert.calledWithMatch(logger.warn, /missing.*error type 129/);
            assert.equal(emitted[emitted.length - 1].id, 'snmp1');
            assert.equal(emitted[emitted.length - 1].values.int.value, 72);
            assert.ok(device.lastReadTimestamp() > 0);
            assert.deepEqual(device.getValue('int'), { id: 'int', value: 72, ts: device.lastReadTimestamp() });
        });

        it('passes changed values to the DAQ callback', async () => {
            const device = createDevice({
                tags: {
                    tag1: { id: 'tag1', name: 'tag1', address: '1.3.6.1.2.1.1.7.0', type: 'Integer', daq: { enabled: true, changed: true, interval: 0 } }
                }
            });
            let value = 1;
            session.get.callsFake((oids, callback) => callback(null, oids.map(oid => ({ oid, type: ObjectType.Integer, value }))));
            const addDaq = sandbox.spy();
            device.bindAddDaq(addDaq);
            await device.connect();
            await device.polling();
            sinon.assert.calledOnce(addDaq);
            assert.deepEqual(Object.keys(addDaq.firstCall.args[0]), ['tag1']);
            assert.equal(addDaq.firstCall.args[1], 'SNMP test');
            assert.equal(addDaq.firstCall.args[2], 'snmp1');
            // tagDaqToSave stores the first unchanged read as interval baseline, then nothing until the value changes
            await device.polling();
            sinon.assert.calledTwice(addDaq);
            await device.polling();
            sinon.assert.calledTwice(addDaq);
            value = 2;
            await device.polling();
            sinon.assert.calledThrice(addDaq);
        });

        it('goes offline after offlineAfterTimeouts polls without any answer', async () => {
            const device = createDevice({ property: { address: 'a', options: { version: 'v2c', offlineAfterTimeouts: 2 } } });
            await device.connect();
            session.get.callsFake((oids, callback) => callback(new Error('Request timed out')));
            const statuses = [];
            events.on('device-status:changed', event => statuses.push(event.status));
            await device.polling();
            assert.equal(device.isConnected(), true);
            await device.polling();
            assert.equal(device.isConnected(), false);
            assert.deepEqual(statuses, ['connect-error']);
        });

        it('skips tags with an invalid OID', async () => {
            const device = createDevice({
                tags: {
                    good: { id: 'good', name: 'good', address: '.1.3.6.1.2.1.1.5.0', type: 'OctetString' },
                    bad: { id: 'bad', name: 'bad', address: '1.3.6.x', type: 'OctetString' }
                }
            });
            sinon.assert.calledWithMatch(logger.warn, /bad.*invalid OID/);
            await device.connect();
            session.get.resetHistory();
            await device.polling();
            assert.deepEqual(session.get.firstCall.args[0], ['1.3.6.1.2.1.1.5.0']);
            assert.equal(device.getTagProperty('bad'), null);
            assert.deepEqual(device.getTagProperty('good'), { id: 'good', name: 'good', type: 'OctetString', format: undefined });
        });
    });

    describe('write values', () => {
        async function written(tag, value) {
            const device = createDevice({ tags: { tag1: Object.assign({ id: 'tag1', name: 'tag1', address: '1.3.6.1.4.1.1.1.0' }, tag) } });
            await device.connect();
            assert.equal(await device.setValue('tag1', value), true);
            sinon.assert.calledOnce(session.set);
            const varbinds = session.set.firstCall.args[0];
            assert.equal(varbinds.length, 1);
            assert.equal(varbinds[0].oid, '1.3.6.1.4.1.1.1.0');
            return varbinds[0];
        }

        it('writes an Integer', async () => {
            const varbind = await written({ type: 'Integer' }, '15');
            assert.equal(varbind.type, ObjectType.Integer);
            assert.equal(varbind.value, 15);
        });

        it('writes an OctetString', async () => {
            const varbind = await written({ type: 'OctetString' }, 'hello');
            assert.equal(varbind.type, ObjectType.OctetString);
            assert.equal(varbind.value, 'hello');
        });

        it('writes a Hex string as OctetString buffer', async () => {
            const varbind = await written({ type: 'Hex' }, '001a2b');
            assert.equal(varbind.type, ObjectType.OctetString);
            assert.deepEqual(varbind.value, Buffer.from([0x00, 0x1a, 0x2b]));
        });

        it('writes a Gauge32 applying the tag linear scale', async () => {
            const varbind = await written({ type: 'Gauge32', scale: { mode: 'linear', rawLow: 0, rawHigh: 1000, scaledLow: 0, scaledHigh: 100 } }, 50);
            assert.equal(varbind.type, ObjectType.Gauge32);
            assert.equal(varbind.value, 500);
        });

        it('writes a Counter64 as 8 bytes buffer', async () => {
            const varbind = await written({ type: 'Counter64' }, 5000000000);
            assert.equal(varbind.type, ObjectType.Counter64);
            assert.equal(varbind.value.readBigUInt64BE(0), BigInt(5000000000));
        });

        it('returns false when the write fails', async () => {
            session.set.callsFake((varbinds, callback) => callback(new Error('noAccess')));
            const device = createDevice();
            await device.connect();
            assert.equal(await device.setValue('tag1', 1), false);
            sinon.assert.calledWithMatch(logger.error, /setValue error! Error: noAccess/);
        });

        it('returns false for an unknown tag', async () => {
            const device = createDevice();
            await device.connect();
            assert.equal(await device.setValue('unknown', 1), false);
            sinon.assert.notCalled(session.set);
        });
    });

    describe('browse', () => {
        it('walks the subtree and returns the instances with proposed type and value', async () => {
            const device = createDevice();
            await device.connect();
            const result = await device.browse({ oid: '.1.3.6.1.2.1' });
            assert.equal(session.subtree.firstCall.args[0], '1.3.6.1.2.1');
            assert.equal(result.total, 5);
            assert.equal(result.truncated, false);
            assert.deepEqual(result.items, [
                { address: '1.3.6.1.2.1.1.5.0', name: null, type: 'OctetString', value: 'router-1' },
                { address: '1.3.6.1.2.1.1.7.0', name: null, type: 'Integer', value: 72 },
                { address: '1.3.6.1.2.1.2.2.1.6.1', name: null, type: 'Hex', value: '001a2b' },
                { address: '1.3.6.1.2.1.2.2.1.10.1', name: null, type: 'Counter32', value: 1234 },
                { address: '1.3.6.1.2.1.4.20.1.1.1', name: null, type: 'IpAddress', value: '10.0.0.1' }
            ]);
        });

        it('walks mib-2 by default and truncates to max results', async () => {
            const device = createDevice();
            await device.connect();
            const result = await device.browse({ max: 2 });
            assert.equal(session.subtree.firstCall.args[0], '1.3.6.1.2.1');
            assert.equal(result.total, 2);
            assert.equal(result.truncated, true);
        });

        it('rejects an invalid base OID', async () => {
            const device = createDevice();
            await device.connect();
            await assert.rejects(device.browse({ oid: 'system' }), /Invalid OID/);
        });

        it('rejects when the device is not connected', async () => {
            const device = createDevice();
            await assert.rejects(device.browse({}), /not connected/);
        });

        it('rejects when the walk fails', async () => {
            session.subtree.callsFake((oid, maxRepetitions, feed, done) => done(new Error('Request timed out')));
            const device = createDevice();
            await device.connect();
            await assert.rejects(device.browse({}), /timed out/);
        });
    });

    describe('MIB names', () => {
        const names = { 'SNMPv2-MIB::sysName': '1.3.6.1.2.1.1.5', 'IF-MIB::ifInOctets': '1.3.6.1.2.1.2.2.1.10' };
        const oids = { '1.3.6.1.2.1.1.5': 'SNMPv2-MIB::sysName', '1.3.6.1.2.1.1': 'SNMPv2-MIB::system' };

        beforeEach(() => {
            snmpMock.OidFormat = { oid: 'oid', path: 'path', module: 'module' };
            snmpMock.createModuleStore = () => ({
                loadBaseModules() { },
                loadFromFile() { },
                translate(value, format) {
                    const table = (format === 'oid') ? names : oids;
                    if (!table[value]) {
                        throw new Error(`No '${format}' translation found for ${value}`);
                    }
                    return table[value];
                }
            });
        });

        it('resolves symbolic tag addresses and skips unknown names', async () => {
            const device = createDevice({
                tags: {
                    name: { id: 'name', name: 'name', address: 'SNMPv2-MIB::sysName.0', type: 'OctetString' },
                    octets: { id: 'octets', name: 'octets', address: 'IF-MIB::ifInOctets.3', type: 'Counter32' },
                    unknown: { id: 'unknown', name: 'unknown', address: 'FOO-MIB::bar.0', type: 'Integer' }
                }
            });
            sinon.assert.calledWithMatch(logger.warn, /unknown.*unknown MIB name 'FOO-MIB::bar.0'/);
            await device.connect();
            session.get.resetHistory();
            await device.polling();
            assert.deepEqual(session.get.firstCall.args[0], ['1.3.6.1.2.1.1.5.0', '1.3.6.1.2.1.2.2.1.10.3']);
            assert.equal(device.getValues().name.value, 1);
            assert.equal(device.getTagProperty('unknown'), null);
        });

        it('returns the known names in the browse result', async () => {
            const device = createDevice();
            await device.connect();
            const result = await device.browse({ oid: '1.3.6.1.2.1' });
            assert.equal(result.items[0].address, '1.3.6.1.2.1.1.5.0');
            assert.equal(result.items[0].name, 'SNMPv2-MIB::sysName.0');
            assert.equal(result.items[1].address, '1.3.6.1.2.1.1.7.0');
            assert.equal(result.items[1].name, 'SNMPv2-MIB::system.7.0');
            assert.equal(result.items[4].name, null);
        });
    });

    describe('traps and informs', () => {
        const TRAP_OID = '1.3.6.1.6.3.1.1.4.1.0';
        const IF_INDEX_OID = '1.3.6.1.2.1.2.2.1.1.3';

        function createTrapDevice(options = {}, security = { pwd: 'trapcomm' }) {
            return createDevice({
                property: { address: '192.168.1.10', port: 161, options: Object.assign({ version: 'v2c', trapsEnabled: true }, options) },
                tags: {
                    uptime: { id: 'uptime', name: 'uptime', address: SYS_UPTIME_OID, type: 'TimeTicks' },
                    trap: { id: 'trap', name: 'trap', address: TRAP_OID, type: 'OID', options: { trapOnly: true } },
                    ifIndex: { id: 'ifIndex', name: 'ifIndex', address: IF_INDEX_OID, type: 'Integer', options: { trapOnly: true } }
                }
            }, security);
        }

        it('subscribes to the trap receiver on connect and unsubscribes on disconnect', async () => {
            const device = createTrapDevice({ trapPort: 1162 });
            await device.connect();
            sinon.assert.calledOnce(snmpMock.createReceiver);
            assert.deepEqual(receiver.options, { port: 1162, transport: 'udp4', includeAuthentication: true });
            assert.deepEqual(receiver.authorizer.getCommunities(), ['trapcomm']);
            await device.disconnect();
            sinon.assert.calledOnce(receiver.close);
        });

        it('does not subscribe when traps are disabled', async () => {
            const device = createTrapDevice({ trapsEnabled: false });
            await device.connect();
            sinon.assert.notCalled(snmpMock.createReceiver);
        });

        it('registers the v3 user for v3 devices', async () => {
            const device = createTrapDevice({ version: 'v3', securityLevel: 'authPriv', authProtocol: 'sha', privProtocol: 'aes' }, { uid: 'fuxa', pwd: 'authkey', privKey: 'privkey' });
            await device.connect();
            assert.deepEqual(receiver.authorizer.getCommunities(), []);
            assert.deepEqual(receiver.authorizer.getUsers(), [{ name: 'fuxa', level: SecurityLevel.authPriv, authProtocol: AuthProtocols.sha, authKey: 'authkey', privProtocol: PrivProtocols.aes, privKey: 'privkey' }]);
        });

        it('does not poll the trap-only tags', async () => {
            const device = createTrapDevice();
            await device.connect();
            session.get.resetHistory();
            await device.polling();
            sinon.assert.calledOnce(session.get);
            assert.deepEqual(session.get.firstCall.args[0], [SYS_UPTIME_OID]);
        });

        it('updates the matching tags from a v2c trap', async () => {
            const device = createTrapDevice();
            const addDaq = sandbox.spy();
            device.bindAddDaq(addDaq);
            const emitted = [];
            events.on('device-value:changed', event => emitted.push(event));
            await device.connect();
            receiver.callback(null, {
                pdu: {
                    type: PduType.TrapV2, community: 'trapcomm',
                    varbinds: [
                        { oid: SYS_UPTIME_OID, type: ObjectType.TimeTicks, value: 99 },
                        { oid: TRAP_OID, type: ObjectType.OID, value: '1.3.6.1.6.3.1.1.5.3' },
                        { oid: IF_INDEX_OID, type: ObjectType.Integer, value: 3 },
                        { oid: '1.3.6.1.4.1.9.9.1.0', type: ObjectType.Integer, value: 1 }
                    ]
                },
                rinfo: { address: '192.168.1.10', port: 40000 }
            });
            await new Promise(resolve => setImmediate(resolve));
            const values = device.getValues();
            assert.equal(values.trap.value, '1.3.6.1.6.3.1.1.5.3');
            assert.equal(values.ifIndex.value, 3);
            assert.equal(values.uptime.value, 99);
            assert.equal(emitted[emitted.length - 1].values.trap.value, '1.3.6.1.6.3.1.1.5.3');
        });

        it('ignores notifications from another address or community', async () => {
            const device = createTrapDevice();
            await device.connect();
            const pdu = { type: PduType.TrapV2, community: 'trapcomm', varbinds: [{ oid: IF_INDEX_OID, type: ObjectType.Integer, value: 3 }] };
            receiver.callback(null, { pdu: pdu, rinfo: { address: '10.0.0.1' } });
            receiver.callback(null, { pdu: Object.assign({}, pdu, { community: 'other' }), rinfo: { address: '192.168.1.10' } });
            await new Promise(resolve => setImmediate(resolve));
            assert.equal(device.getValues().ifIndex, undefined);
        });

        it('synthesizes sysUpTime and snmpTrapOID for v1 traps', async () => {
            const device = createTrapDevice({ version: 'v1' });
            await device.connect();
            receiver.callback(null, {
                pdu: { type: PduType.Trap, community: 'trapcomm', enterprise: '1.3.6.1.4.1.8072', generic: 2, specific: 0, upTime: 12, varbinds: [{ oid: IF_INDEX_OID, type: ObjectType.Integer, value: 3 }] },
                rinfo: { address: '192.168.1.10' }
            });
            receiver.callback(null, {
                pdu: { type: PduType.Trap, community: 'trapcomm', enterprise: '1.3.6.1.4.1.8072', generic: 6, specific: 7, upTime: 13, varbinds: [] },
                rinfo: { address: '192.168.1.10' }
            });
            await new Promise(resolve => setImmediate(resolve));
            const values = device.getValues();
            assert.equal(values.uptime.value, 13);
            assert.equal(values.trap.value, '1.3.6.1.4.1.8072.0.7');
            assert.equal(values.ifIndex.value, 3);
        });

        it('logs the bind error of the trap port', async () => {
            const device = createTrapDevice();
            await device.connect();
            const err = new Error('bind EACCES 0.0.0.0:162');
            err.code = 'EACCES';
            receiver.callback(err, null);
            sinon.assert.calledWithMatch(logger.error, /trap receiver error! Error: bind EACCES/);
            assert.equal(device.isConnected(), true);
        });
    });

    it('returns null from create when net-snmp is not available', () => {
        sandbox.restore();
        delete require.cache[require.resolve('../../runtime/devices/snmp')];
        sandbox = sinon.createSandbox();
        const originalLoad = Module._load;
        sandbox.stub(Module, '_load').callsFake(function (request, parent) {
            if (request === 'net-snmp' && parent.filename === require.resolve('../../runtime/devices/snmp')) {
                throw new Error('Cannot find module net-snmp');
            }
            return originalLoad.apply(this, arguments);
        });
        const missing = require('../../runtime/devices/snmp');
        assert.equal(missing.create({ id: 'x', name: 'x', property: {}, tags: {} }, logger, events, null, undefined), null);
    });
});
