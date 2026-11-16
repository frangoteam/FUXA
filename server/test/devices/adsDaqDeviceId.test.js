'use strict';

const assert = require('assert');
const EventEmitter = require('events');
const Module = require('module');

function FakeAdsClient() { }

FakeAdsClient.prototype.connect = async function () {
    return { targetAmsNetId: '127.0.0.1' };
};
FakeAdsClient.prototype.on = function () { };
FakeAdsClient.prototype.getSymbols = async function () {
    return {};
};
FakeAdsClient.prototype.subscribeValue = async function (address, callback) {
    callback({ value: 42, timestamp: new Date() }, { symbol: { name: address } });
};
FakeAdsClient.prototype.unsubscribeAll = async function () { };
FakeAdsClient.prototype.disconnect = function () { };

describe('ADS DAQ device id', function () {
    let originalLoad;
    let addDaqCalls;

    before(function () {
        originalLoad = Module._load;
        Module._load = function (request) {
            if (request === 'ads-client') {
                return { Client: FakeAdsClient };
            }
            return originalLoad.apply(this, arguments);
        };
        delete require.cache[require.resolve('../../runtime/devices/adsclient')];
    });

    after(function () {
        Module._load = originalLoad;
        delete require.cache[require.resolve('../../runtime/devices/adsclient')];
    });

    beforeEach(function () {
        addDaqCalls = [];
    });

    it('passes the device id when saving DAQ values', async function () {
        const driver = require('../../runtime/devices/adsclient');
        const client = driver.create({
            id: 'ads-device-1',
            name: 'ADS test',
            enabled: true,
            property: { address: '192.168.0.1:851' },
            tags: {
                tag1: {
                    id: 'tag1',
                    name: 'Tag 1',
                    address: 'MAIN.value',
                    type: 'number',
                    daq: { enabled: true, restored: true }
                }
            }
        }, { info() { }, warn() { }, error() { } }, new EventEmitter(), null, {});
        client.bindAddDaq(function () {
            addDaqCalls.push(Array.from(arguments));
        });

        await client.connect();
        await client.polling();

        assert.strictEqual(addDaqCalls.length, 1);
        assert.strictEqual(addDaqCalls[0][2], 'ads-device-1');
    });
});
