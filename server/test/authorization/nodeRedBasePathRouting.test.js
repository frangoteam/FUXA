'use strict';

const { getPathWithoutBasePath, shouldBypassSpaCatchAll } = require('../../integrations/node-red');

describe('Node-RED SPA catch-all BASE_PATH handling', () => {
    let expect;

    before(async () => {
        const chai = await import('chai');
        expect = chai.expect;
    });

    it('strips the configured base path from application routes', () => {
        expect(getPathWithoutBasePath('/fuxa1/api/settings', '/fuxa1')).to.equal('/api/settings');
        expect(getPathWithoutBasePath('/fuxa1', '/fuxa1')).to.equal('/');
        expect(getPathWithoutBasePath('/api/settings', '/fuxa1')).to.equal('/api/settings');
    });

    it('bypasses API routes without a base path', () => {
        expect(shouldBypassSpaCatchAll('/api/settings', '')).to.equal(true);
        expect(shouldBypassSpaCatchAll('/api', '')).to.equal(true);
    });

    it('bypasses API routes below BASE_PATH', () => {
        expect(shouldBypassSpaCatchAll('/fuxa1/api/settings', '/fuxa1')).to.equal(true);
        expect(shouldBypassSpaCatchAll('/fuxa1/api', '/fuxa1')).to.equal(true);
    });

    it('still allows client-side SPA routes below BASE_PATH', () => {
        expect(shouldBypassSpaCatchAll('/fuxa1/editor', '/fuxa1')).to.equal(false);
        expect(shouldBypassSpaCatchAll('/fuxa1/view/overview', '/fuxa1')).to.equal(false);
    });

    it('continues bypassing static and Node-RED routes', () => {
        expect(shouldBypassSpaCatchAll('/fuxa1/assets/logo.svg', '/fuxa1')).to.equal(true);
        expect(shouldBypassSpaCatchAll('/nodered', '/fuxa1')).to.equal(true);
        expect(shouldBypassSpaCatchAll('/dashboard/ui', '/fuxa1')).to.equal(true);
    });
});
