'use strict';

const assert = require('assert').strict;
const EventEmitter = require('events');
const Module = require('module');
const sinon = require('sinon');

describe('OPC UA connection lifecycle', () => {
    let sandbox, driver, events, clients;
    const modulePath = require.resolve('../../runtime/devices/opcua');
    const logger = { info() {}, warn() {}, error() {} };

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        events = new EventEmitter();
        clients = [];
        const originalLoad = Module._load;
        sandbox.stub(Module, '_load').callsFake(function (request, parent) {
            if (parent.filename === modulePath) {
                // These tests exercise connection setup and teardown only.
                if (request === '../device-utils') return {};
                if (request === 'node-opcua') return {
                    AttributeIds: {},
                    OPCUAClient: { create() {
                        const client = new EventEmitter();
                        const session = new EventEmitter();
                        session.close = sandbox.stub().callsFake(callback => {
                            session.emit('session_closed');
                            callback();
                        });
                        session.createSubscription2 = sandbox.stub().callsArgWith(1, null, {});
                        client.session = session;
                        client.connect = sandbox.stub().callsArgWith(1, null);
                        client.createSession = sandbox.stub().callsArgWith(1, null, session);
                        client.disconnect = sandbox.stub().callsArgWith(0, null);
                        clients.push(client);
                        return client;
                    } }
                };
            }
            return originalLoad.apply(this, arguments);
        });
        delete require.cache[modulePath];
        driver = require(modulePath);
    });

    afterEach(() => {
        sandbox.restore();
        delete require.cache[modulePath];
    });

    function create(id, polling) {
        return driver.create({ id, name: id, polling, property: { address: 'opc.tcp://same-device:4840' }, tags: {} },
            logger, events, null, {});
    }

    it('waits for subscription acceptance before reporting connected', async () => {
        const device = create('one');
        let finish;
        clients[0].session.createSubscription2.resetBehavior();
        clients[0].session.createSubscription2.callsFake((parameters, callback) => { finish = callback; });
        const connecting = device.connect();
        assert.equal(device.isConnected(), false);
        assert.equal(device.getStatus(), 'connect-busy');
        finish(null, {});
        await connecting;
        assert.equal(device.isConnected(), true);
        assert.equal(device.getStatus(), 'connect-ok');
    });

    it('isolates rejected subscriptions on the same endpoint and permits retry', async () => {
        const devices = [create('one'), create('two'), create('three')];
        const error = new Error('BadTooManySubscriptions');
        clients[1].session.createSubscription2.callsArgWith(1, error);
        const results = await Promise.allSettled(devices.map(device => device.connect()));
        assert.deepEqual(results.map(result => result.status), ['fulfilled', 'rejected', 'fulfilled']);
        assert.equal(results[1].reason, error);
        assert.deepEqual(devices.map(device => device.getStatus()), ['connect-ok', 'connect-error', 'connect-ok']);
        assert.equal(devices[1].isConnected(), false);
        sinon.assert.calledOnce(clients[1].session.close);
        sinon.assert.calledOnce(clients[1].disconnect);
        clients[1].session.createSubscription2.callsArgWith(1, null, {});
        await devices[1].connect();
        assert.equal(devices[1].getStatus(), 'connect-ok');
        assert.equal(clients[1].listenerCount('connection_lost'), 1);
        assert.equal(clients[1].listenerCount('backoff'), 1);
    });

    it('reports session rejection and disconnects the channel', async () => {
        const device = create('one');
        const error = new Error('BadTooManySessions');
        clients[0].createSession.callsArgWith(1, error);
        await assert.rejects(device.connect(), error);
        assert.equal(device.getStatus(), 'connect-error');
        sinon.assert.calledOnce(clients[0].disconnect);
    });

    for (const event of ['session_closed', 'keepalive_failure', 'connection_lost']) {
        it(`marks ${event} as an error and clears connection state`, async () => {
            const device = create('one');
            await device.connect();
            (event === 'connection_lost' ? clients[0] : clients[0].session).emit(event);
            assert.equal(device.getStatus(), 'connect-error');
            assert.equal(device.isConnected(), false);
            sinon.assert.calledOnce(clients[0].session.close);
            sinon.assert.calledOnce(clients[0].disconnect);
        });
    }

    it('keeps an intentional disconnection off when closing emits session_closed', async () => {
        const device = create('one');
        await device.connect();
        await device.disconnect();
        assert.equal(device.getStatus(), 'connect-off');
        assert.equal(device.isConnected(), false);
        sinon.assert.calledOnce(clients[0].disconnect);
    });

    for (const [timeout, polling] of [[30000, 5000], [30000, 10000], [3000, 5000], [60000, 500], [30000, -1]]) {
        it(`fits subscription keepalive into negotiated timeout ${timeout} with polling ${polling}`, async () => {
            const device = create('one', polling);
            const session = clients[0].session;
            session.timeout = timeout;
            session.createSubscription2.resetBehavior();
            session.createSubscription2.callsFake((parameters, callback) => {
                const cycles = Math.max(3, parameters.requestedMaxKeepAliveCount);
                if (parameters.requestedPublishingInterval * cycles >= session.timeout) {
                    throw new Error('[NODE-OPCUA-W09] incompatible session timeout');
                }
                callback(null, {});
            });
            await device.connect();
            const parameters = session.createSubscription2.firstCall.args[0];
            assert.ok(parameters.requestedMaxKeepAliveCount >= 3);
            assert.ok(parameters.requestedPublishingInterval > 0);
            assert.ok(parameters.requestedPublishingInterval * parameters.requestedMaxKeepAliveCount <= timeout / 2);
            if (polling > 0 && polling <= timeout / 6) assert.equal(parameters.requestedPublishingInterval, polling);
            assert.equal(device.getStatus(), 'connect-ok');
        });
    }

    it('rejects a synchronous subscription exception, marks error, closes and permits retry', async () => {
        const device = create('one', 5000);
        const session = clients[0].session;
        const error = new Error('[NODE-OPCUA-W09] incompatible session timeout');
        clients[0].createSession.resetBehavior();
        clients[0].createSession.callsFake((identity, callback) => setImmediate(() => callback(null, session)));
        session.createSubscription2.resetBehavior();
        session.createSubscription2.throws(error);
        await assert.rejects(device.connect(), error);
        assert.equal(device.getStatus(), 'connect-error');
        assert.equal(device.isConnected(), false);
        sinon.assert.calledOnce(session.close);
        sinon.assert.calledOnce(clients[0].disconnect);
        session.createSubscription2.resetBehavior();
        session.createSubscription2.callsArgWith(1, null, {});
        await device.connect();
        assert.equal(device.getStatus(), 'connect-ok');
    });
});
