'use strict';

const tdengine = require('../../runtime/storage/tdengine');

describe('TDengine storage escaping', () => {
    let expect;

    before(async () => {
        const chai = await import('chai');
        expect = chai.expect;
    });

    it('escapes backslashes before single quotes', () => {
        const escaped = tdengine._private.escapeTdString("x\\' OR 1=1--");

        expect(escaped).to.equal("x\\\\'' OR 1=1--");
    });

    it('escapes backslashes in stored values too', () => {
        const escaped = tdengine._private.escapeTdString("C:\\temp\\tag's value");

        expect(escaped).to.equal("C:\\\\temp\\\\tag''s value");
    });
});
