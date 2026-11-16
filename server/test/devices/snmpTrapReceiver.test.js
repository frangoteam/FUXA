'use strict';

const assert = require('assert').strict;
const sinon = require('sinon');

describe('SNMP shared trap receiver', () => {
    let trapReceiver;
    let snmpMock;
    let receivers;
    let logger;
    let sandbox;

    function createAuthorizer() {
        const communities = [];
        const users = [];
        return {
            addCommunity: (c) => { if (!communities.includes(c)) { communities.push(c); } },
            getCommunities: () => communities,
            deleteCommunity: (c) => { const i = communities.indexOf(c); if (i >= 0) { communities.splice(i, 1); } },
            addUser: (u) => { const i = users.findIndex(x => x.name === u.name); if (i >= 0) { users[i] = u; } else { users.push(u); } },
            getUsers: () => users,
            deleteUser: (name) => { const i = users.findIndex(x => x.name === name); if (i >= 0) { users.splice(i, 1); } }
        };
    }

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        receivers = [];
        snmpMock = {
            createReceiver: sandbox.stub().callsFake((options, callback) => {
                const receiver = { options, callback, authorizer: createAuthorizer(), close: sandbox.stub().callsFake(cb => cb && cb()) };
                receiver.getAuthorizer = () => receiver.authorizer;
                receivers.push(receiver);
                return receiver;
            })
        };
        logger = { info: sandbox.spy(), warn: sandbox.spy(), error: sandbox.spy() };
        delete require.cache[require.resolve('../../runtime/devices/snmp/trap-receiver')];
        trapReceiver = require('../../runtime/devices/snmp/trap-receiver');
    });

    afterEach(() => {
        trapReceiver._reset();
        sandbox.restore();
        delete require.cache[require.resolve('../../runtime/devices/snmp/trap-receiver')];
    });

    function subscriber(id, overrides = {}) {
        return Object.assign({
            id: id,
            address: '192.168.1.10',
            community: 'public',
            user: null,
            onNotification: sandbox.spy(),
            onError: sandbox.spy()
        }, overrides);
    }

    function notification(overrides = {}) {
        return {
            pdu: Object.assign({ type: 167, community: 'public', varbinds: [{ oid: '1.3.6.1.2.1.1.3.0', type: 67, value: 5 }] }, overrides.pdu),
            rinfo: Object.assign({ address: '192.168.1.10', port: 40000 }, overrides.rinfo)
        };
    }

    it('creates one receiver for each port and shares it between devices', async () => {
        const a = subscriber('a');
        const b = subscriber('b', { address: '192.168.1.11', community: 'other' });
        await trapReceiver.register(snmpMock, { port: 162, transport: 'udp4' }, a, logger);
        await trapReceiver.register(snmpMock, { port: 162, transport: 'udp4' }, b, logger);
        await trapReceiver.register(snmpMock, { port: 1162, transport: 'udp4' }, subscriber('c'), logger);
        sinon.assert.calledTwice(snmpMock.createReceiver);
        assert.deepEqual(receivers[0].options, { port: 162, transport: 'udp4', includeAuthentication: true });
        assert.deepEqual(receivers[0].authorizer.getCommunities(), ['public', 'other']);
    });

    it('dispatches the notification to the device with matching address and community', async () => {
        const a = subscriber('a');
        const b = subscriber('b', { address: '192.168.1.11' });
        const c = subscriber('c', { community: 'private' });
        await trapReceiver.register(snmpMock, { port: 162 }, a, logger);
        await trapReceiver.register(snmpMock, { port: 162 }, b, logger);
        await trapReceiver.register(snmpMock, { port: 162 }, c, logger);
        const message = notification();
        receivers[0].callback(null, message);
        sinon.assert.calledOnceWithExactly(a.onNotification, message.pdu, message.rinfo);
        sinon.assert.notCalled(b.onNotification);
        sinon.assert.notCalled(c.onNotification);
    });

    it('dispatches v3 notifications by user name', async () => {
        const user = { name: 'fuxa', level: 3, authProtocol: 5, authKey: 'a', privProtocol: 4, privKey: 'p' };
        const a = subscriber('a', { community: null, user });
        const b = subscriber('b', { community: 'public' });
        await trapReceiver.register(snmpMock, { port: 162 }, a, logger);
        await trapReceiver.register(snmpMock, { port: 162 }, b, logger);
        assert.deepEqual(receivers[0].authorizer.getUsers(), [user]);
        receivers[0].callback(null, notification({ pdu: { community: undefined, user: 'fuxa' } }));
        sinon.assert.calledOnce(a.onNotification);
        sinon.assert.notCalled(b.onNotification);
    });

    it('rejects a v3 user already registered on the port with different keys', async () => {
        const user = { name: 'fuxa', level: 3, authProtocol: 2, authKey: 'authkey', privProtocol: 4, privKey: 'privkey' };
        const a = subscriber('a', { name: 'Device A', community: null, user: user });
        const b = subscriber('b', { name: 'Device B', address: '192.168.1.11', community: null, user: Object.assign({}, user, { authKey: 'other' }) });
        await trapReceiver.register(snmpMock, { port: 162 }, a, logger);
        await assert.rejects(trapReceiver.register(snmpMock, { port: 162 }, b, logger), /user 'fuxa' is already registered by device 'Device A' with different keys/);
        assert.deepEqual(receivers[0].authorizer.getUsers(), [user]);
        assert.deepEqual(Object.keys(trapReceiver._listeners['udp4:162'].subscribers), ['a']);
        sinon.assert.notCalled(receivers[0].close);
        // another port is fine
        await trapReceiver.register(snmpMock, { port: 1162 }, b, logger);
        assert.equal(receivers[1].authorizer.getUsers()[0].authKey, 'other');
    });

    it('accepts the same v3 user with the same keys from another device', async () => {
        const user = { name: 'fuxa', level: 3, authProtocol: 2, authKey: 'authkey', privProtocol: 4, privKey: 'privkey' };
        await trapReceiver.register(snmpMock, { port: 162 }, subscriber('a', { community: null, user: user }), logger);
        await trapReceiver.register(snmpMock, { port: 162 }, subscriber('b', { address: '192.168.1.11', community: null, user: Object.assign({}, user) }), logger);
        assert.deepEqual(receivers[0].authorizer.getUsers(), [user]);
        assert.deepEqual(Object.keys(trapReceiver._listeners['udp4:162'].subscribers), ['a', 'b']);
    });

    it('warns when a notification matches no device', async () => {
        await trapReceiver.register(snmpMock, { port: 162 }, subscriber('a'), logger);
        receivers[0].callback(null, notification({ rinfo: { address: '10.0.0.1' } }));
        sinon.assert.calledWithMatch(logger.warn, /without matching device/);
    });

    it('removes the credentials on unregister and closes the receiver with the last device', async () => {
        const a = subscriber('a');
        const b = subscriber('b', { community: 'other' });
        const unregisterA = await trapReceiver.register(snmpMock, { port: 162 }, a, logger);
        const unregisterB = await trapReceiver.register(snmpMock, { port: 162 }, b, logger);
        unregisterA();
        assert.deepEqual(receivers[0].authorizer.getCommunities(), ['other']);
        sinon.assert.notCalled(receivers[0].close);
        unregisterB();
        sinon.assert.calledOnce(receivers[0].close);
        unregisterB();
        sinon.assert.calledOnce(receivers[0].close);
        await trapReceiver.register(snmpMock, { port: 162 }, subscriber('c'), logger);
        sinon.assert.calledTwice(snmpMock.createReceiver);
    });

    it('drops the listener and notifies the devices when the port cannot be bound', async () => {
        const a = subscriber('a');
        await trapReceiver.register(snmpMock, { port: 162 }, a, logger);
        const err = new Error('bind EACCES 0.0.0.0:162');
        err.code = 'EACCES';
        receivers[0].callback(err, null);
        sinon.assert.calledOnceWithExactly(a.onError, err);
        sinon.assert.calledOnce(receivers[0].close);
        sinon.assert.calledWithMatch(logger.error, /bind failed/);
        assert.equal(trapReceiver._listeners['udp4:162'], undefined);
        // the port is refused until the retry time, then the bind is retried
        await assert.rejects(trapReceiver.register(snmpMock, { port: 162 }, subscriber('b'), logger), /bind EACCES 0.0.0.0:162, retry in \d+ s/);
        sinon.assert.calledOnce(snmpMock.createReceiver);
        trapReceiver._bindFailures['udp4:162'].until = Date.now() - 1;
        await trapReceiver.register(snmpMock, { port: 162 }, subscriber('b'), logger);
        sinon.assert.calledTwice(snmpMock.createReceiver);
        assert.equal(trapReceiver._bindFailures['udp4:162'], undefined);
    });

    it('does not keep a listener when the receiver cannot be created', async () => {
        snmpMock.createReceiver.onFirstCall().throws(new Error('ERR_SOCKET_BAD_TYPE'));
        await assert.rejects(trapReceiver.register(snmpMock, { port: 162, transport: 'udp9' }, subscriber('a'), logger), /ERR_SOCKET_BAD_TYPE/);
        assert.equal(trapReceiver._listeners['udp9:162'], undefined);
        // the next registration on the same port creates the receiver
        await trapReceiver.register(snmpMock, { port: 162, transport: 'udp9' }, subscriber('b'), logger);
        sinon.assert.calledTwice(snmpMock.createReceiver);
        assert.deepEqual(receivers[0].authorizer.getCommunities(), ['public']);
    });

    it('matches an IPv4 sender on a udp6 listener (IPv4-mapped address)', async () => {
        const a = subscriber('a');
        await trapReceiver.register(snmpMock, { port: 162, transport: 'udp6' }, a, logger);
        receivers[0].callback(null, notification({ rinfo: { address: '::ffff:192.168.1.10' } }));
        sinon.assert.calledOnce(a.onNotification);
        const b = subscriber('b', { address: '::FFFF:192.168.1.11' });
        await trapReceiver.register(snmpMock, { port: 162, transport: 'udp6' }, b, logger);
        receivers[0].callback(null, notification({ rinfo: { address: '192.168.1.11' } }));
        sinon.assert.calledOnce(b.onNotification);
    });

    it('throttles the repeated warnings of unmatched and unauthorized notifications', async () => {
        await trapReceiver.register(snmpMock, { port: 162 }, subscriber('a'), logger);
        for (let index = 0; index < 5; index++) {
            receivers[0].callback(null, notification({ rinfo: { address: '10.0.0.1' } }));
            const err = new Error('Local community not found for message with community wrong');
            err.rinfo = { address: '192.168.1.10' };
            receivers[0].callback(err, null);
        }
        assert.equal(logger.warn.callCount, 2);
        receivers[0].callback(null, notification({ rinfo: { address: '10.0.0.2' } }));
        assert.equal(logger.warn.callCount, 3, 'a different sender is a different warning');
    });

    it('logs unauthorized notifications without dispatching', async () => {
        const a = subscriber('a');
        await trapReceiver.register(snmpMock, { port: 162 }, a, logger);
        const err = new Error('Local community not found for message with community wrong');
        err.rinfo = { address: '192.168.1.10' };
        receivers[0].callback(err, null);
        sinon.assert.notCalled(a.onNotification);
        sinon.assert.notCalled(a.onError);
        sinon.assert.calledWithMatch(logger.warn, /community wrong from 192.168.1.10/);
    });

    it('resolves a host name to match the sender address', async () => {
        const a = subscriber('a', { address: 'localhost' });
        await trapReceiver.register(snmpMock, { port: 162 }, a, logger);
        receivers[0].callback(null, notification({ rinfo: { address: '127.0.0.1' } }));
        sinon.assert.calledOnce(a.onNotification);
    });
});
