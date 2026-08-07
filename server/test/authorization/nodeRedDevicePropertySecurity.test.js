'use strict';

const { createDevicePropertyHelpers } = require('../../integrations/node-red');

describe('Node-RED device property helpers', () => {
    let expect;
    let helpers;
    let storedProperty;
    let savedProperty;

    before(async () => {
        const chai = await import('chai');
        expect = chai.expect;
    });

    beforeEach(() => {
        storedProperty = {
            address: '192.168.1.10',
            port: 502,
            polling: true,
            timeout: 1000,
            cycle: 500,
            password: 'secret',
        };
        savedProperty = null;
        helpers = createDevicePropertyHelpers({
            getDeviceProperty(deviceName) {
                return deviceName === 'plc-1' ? storedProperty : null;
            },
            setDeviceProperty(deviceName, property) {
                savedProperty = { deviceName, property: { ...property } };
                return true;
            }
        });
    });

    it('reads allowlisted non-secret device properties', () => {
        expect(helpers.getDeviceProperty('plc-1', 'address')).to.equal('192.168.1.10');
    });

    it('does not read secrets or prototype pollution keys', () => {
        expect(() => helpers.getDeviceProperty('plc-1', 'password')).to.throw(/not readable/);
        expect(() => helpers.getDeviceProperty('plc-1', '__proto__')).to.throw(/not readable/);
    });

    it('writes only low-risk operational properties', () => {
        const result = helpers.setDeviceProperty('plc-1', 'timeout', 2000);

        expect(result).to.equal(true);
        expect(savedProperty).to.deep.equal({
            deviceName: 'plc-1',
            property: {
                address: '192.168.1.10',
                port: 502,
                polling: true,
                timeout: 2000,
                cycle: 500,
                password: 'secret',
            }
        });
    });

    it('rejects network, secret, nested and object writes', () => {
        expect(() => helpers.setDeviceProperty('plc-1', 'address', '10.0.0.5')).to.throw(/not writable/);
        expect(() => helpers.setDeviceProperty('plc-1', 'password', 'changed')).to.throw(/not writable/);
        expect(() => helpers.setDeviceProperty('plc-1', 'constructor', 'polluted')).to.throw(/not writable/);
        expect(() => helpers.setDeviceProperty('plc-1', 'timeout.value', 2000)).to.throw(/not writable/);
        expect(() => helpers.setDeviceProperty('plc-1', 'timeout', { value: 2000 })).to.throw(/must be a scalar/);
    });
});
