'use strict';

const fs = require('fs');
const path = require('path');

describe('Security - API rate limiter ordering', () => {
    let expect;

    before(async () => {
        const chai = await import('chai');
        expect = chai.expect;
    });

    it('registers the rate limiter before API sub-routers', () => {
        const source = fs.readFileSync(path.join(__dirname, '../../api/index.js'), 'utf8');
        const limiterIndex = source.indexOf('apiApp.use(limiter)');
        const authLimiterIndex = source.indexOf('apiApp.use(authLimiter)');

        expect(limiterIndex).to.be.greaterThan(-1);
        expect(authLimiterIndex).to.be.greaterThan(-1);
        for (const marker of [
            'apiApp.use(prjApi.app())',
            'apiApp.use(usersApi.app())',
            'apiApp.use(authApi.app())',
            'apiApp.use(commandApi.app())',
            'apiApp.use(apiKeysApi.app())'
        ]) {
            expect(source.indexOf(marker), marker).to.be.greaterThan(limiterIndex);
        }
        expect(source.indexOf('apiApp.use(authApi.app())')).to.be.greaterThan(authLimiterIndex);
    });
});
