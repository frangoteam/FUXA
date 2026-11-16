const assert = require('node:assert/strict');
const net = require('node:net');
const influx = require('influx');
const storage = require('../../runtime/storage/influxdb');

describe('InfluxDB 1.8 initialization', function () {
    let originalClient, originalConnect, clients, connections;
    beforeEach(function () {
        clients = [];
        connections = 0;
        originalClient = influx.InfluxDB;
        originalConnect = net.Socket.prototype.connect;
        influx.InfluxDB = function (options) {
            clients.push(options);
            return new originalClient(options);
        };
        net.Socket.prototype.connect = function () {
            connections++;
            throw new Error('Unexpected network connection in initialization test');
        };
    });
    afterEach(function () {
        influx.InfluxDB = originalClient;
        net.Socket.prototype.connect = originalConnect;
        assert.equal(connections, 0);
    });
    function create(configuration, errors) {
        return storage.create({ daqstore: { type: 'influxDB18', ...configuration } }, {
            info() {}, error(message) { errors.push(message); }
        }, { setValues() {} });
    }
    for (const [title, configuration] of [
        ['empty URL', {url: '', credentials: {username: '', password: ''}}],
        ['omitted URL', {credentials: {username: '', password: ''}}],
        ['malformed URL', {url: 'not-a-url', credentials: {username: '', password: ''}}],
        ['missing credentials', {url: 'http://127.0.0.1:8086'}],
    ]) {
        it('logs ' + title + ' without throwing or constructing a client', function () {
            const errors = [];
            let node;
            assert.doesNotThrow(() => { node = create(configuration, errors); });
            assert.equal(typeof node.setCall(() => null), 'function');
            assert.equal(errors.length, 1);
            assert.match(errors[0], /^influxdb-init failed!/);
            assert.deepEqual(clients, []);
        });
    }
    for (const [url, expected] of [
        ['http://127.0.0.1', {host: '127.0.0.1', port: 8086, protocol: 'http'}],
        ['http://127.0.0.1:18086', {host: '127.0.0.1', port: '18086', protocol: 'http'}],
        ['https://127.0.0.1:18443', {host: '127.0.0.1', port: '18443', protocol: 'https'}],
    ]) {
        it('constructs the actual SDK client for ' + url, function () {
            const errors = [];
            create({url, database: 'synthetic', credentials: {username: '', password: ''}}, errors);
            assert.deepEqual(errors, []);
            assert.deepEqual(clients, [{...expected, database: 'synthetic', username: '', password: ''}]);
        });
    }
});
