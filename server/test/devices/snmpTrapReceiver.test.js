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

    it('creates one receiver for each port and shares it between devices', () => {
        const a = subscriber('a');
        const b = subscriber('b', { address: '192.168.1.11', community: 'other' });
        trapReceiver.register(snmpMock, { port: 162, transport: 'udp4' }, a, logger);
        trapReceiver.register(snmpMock, { port: 162, transport: 'udp4' }, b, logger);
        trapReceiver.register(snmpMock, { port: 1162, transport: 'udp4' }, subscriber('c'), logger);
        sinon.assert.calledTwice(snmpMock.createReceiver);
        assert.deepEqual(receivers[0].options, { port: 162, transport: 'udp4', includeAuthentication: true });
        assert.deepEqual(receivers[0].authorizer.getCommunities(), ['public', 'other']);
    });

    it('dispatches the notification to the device with matching address and community', () => {
        const a = subscriber('a');
        const b = subscriber('b', { address: '192.168.1.11' });
        const c = subscriber('c', { community: 'private' });
        trapReceiver.register(snmpMock, { port: 162 }, a, logger);
        trapReceiver.register(snmpMock, { port: 162 }, b, logger);
        trapReceiver.register(snmpMock, { port: 162 }, c, logger);
        const message = notification();
        receivers[0].callback(null, message);
        sinon.assert.calledOnceWithExactly(a.onNotification, message.pdu, message.rinfo);
        sinon.assert.notCalled(b.onNotification);
        sinon.assert.notCalled(c.onNotification);
    });

    it('dispatches v3 notifications by user name', () => {
        const user = { name: 'fuxa', level: 3, authProtocol: 5, authKey: 'a', privProtocol: 4, privKey: 'p' };
        const a = subscriber('a', { community: null, user });
        const b = subscriber('b', { community: 'public' });
        trapReceiver.register(snmpMock, { port: 162 }, a, logger);
        trapReceiver.register(snmpMock, { port: 162 }, b, logger);
        assert.deepEqual(receivers[0].authorizer.getUsers(), [user]);
        receivers[0].callback(null, notification({ pdu: { community: undefined, user: 'fuxa' } }));
        sinon.assert.calledOnce(a.onNotification);
        sinon.assert.notCalled(b.onNotification);
    });

    it('warns when a notification matches no device', () => {
        trapReceiver.register(snmpMock, { port: 162 }, subscriber('a'), logger);
        receivers[0].callback(null, notification({ rinfo: { address: '10.0.0.1' } }));
        sinon.assert.calledWithMatch(logger.warn, /without matching device/);
    });

    it('removes the credentials on unregister and closes the receiver with the last device', () => {
        const a = subscriber('a');
        const b = subscriber('b', { community: 'other' });
        const unregisterA = trapReceiver.register(snmpMock, { port: 162 }, a, logger);
        const unregisterB = trapReceiver.register(snmpMock, { port: 162 }, b, logger);
        unregisterA();
        assert.deepEqual(receivers[0].authorizer.getCommunities(), ['other']);
        sinon.assert.notCalled(receivers[0].close);
        unregisterB();
        sinon.assert.calledOnce(receivers[0].close);
        unregisterB();
        sinon.assert.calledOnce(receivers[0].close);
        trapReceiver.register(snmpMock, { port: 162 }, subscriber('c'), logger);
        sinon.assert.calledTwice(snmpMock.createReceiver);
    });

    it('drops the listener and notifies the devices when the port cannot be bound', () => {
        const a = subscriber('a');
        trapReceiver.register(snmpMock, { port: 162 }, a, logger);
        const err = new Error('bind EACCES 0.0.0.0:162');
        err.code = 'EACCES';
        receivers[0].callback(err, null);
        sinon.assert.calledOnceWithExactly(a.onError, err);
        sinon.assert.calledOnce(receivers[0].close);
        sinon.assert.calledWithMatch(logger.error, /bind failed/);
        trapReceiver.register(snmpMock, { port: 162 }, subscriber('b'), logger);
        sinon.assert.calledTwice(snmpMock.createReceiver);
    });

    it('logs unauthorized notifications without dispatching', () => {
        const a = subscriber('a');
        trapReceiver.register(snmpMock, { port: 162 }, a, logger);
        const err = new Error('Local community not found for message with community wrong');
        err.rinfo = { address: '192.168.1.10' };
        receivers[0].callback(err, null);
        sinon.assert.notCalled(a.onNotification);
        sinon.assert.notCalled(a.onError);
        sinon.assert.calledWithMatch(logger.warn, /community wrong from 192.168.1.10/);
    });

    it('resolves a host name to match the sender address', async () => {
        const a = subscriber('a', { address: 'localhost' });
        trapReceiver.register(snmpMock, { port: 162 }, a, logger);
        await new Promise(resolve => setTimeout(resolve, 100));
        receivers[0].callback(null, notification({ rinfo: { address: '127.0.0.1' } }));
        sinon.assert.calledOnce(a.onNotification);
    });
});
