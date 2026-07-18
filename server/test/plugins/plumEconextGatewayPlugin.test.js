'use strict';

const plugins = require('../../runtime/plugins');

describe('PLUM ecoNEXT Gateway plugin registration', function () {
    before(async function () {
        const chai = await import('chai');
        global.expect = chai.expect;
    });

    it('exposes the required id, display name and package name', async function () {
        const registered = (await plugins.getPlugins()).find(plugin => plugin.id === 'plum-econext-gateway');
        expect(registered).to.include({
            id: 'plum-econext-gateway',
            displayName: 'PLUM ecoNEXT Gateway',
            name: 'fuxa-plugin-plum-econext-gateway',
            module: 'fuxa-plugin-plum-econext-gateway',
            type: 'PlumEconextGateway',
            group: 'connection-device'
        });
    });
});
