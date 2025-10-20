
const Utils = require('../../runtime/utils');

describe('Utils Help functions - Types', () => {
    describe('isEmptyObject', () => {
        it('should return true for an empty object', () => {
            const result = Utils.isEmptyObject({});
            expect(result).to.be.true;
        });

        it('should return false for a non-empty object', () => {
            const result = Utils.isEmptyObject({ key: 'value' });
            expect(result).to.be.false;
        });

        it('should return true for null', () => {
            const result = Utils.isEmptyObject(null);
            expect(result).to.be.true;
        });

        it('should return false for an array (which is an object)', () => {
            const result = Utils.isEmptyObject([]);
            expect(result).to.be.false;
        });

        it('should return false for a non-object value (e.g., string, number)', () => {
            expect(Utils.isEmptyObject('string')).to.be.false;
            expect(Utils.isEmptyObject(123)).to.be.false;
            expect(Utils.isEmptyObject(true)).to.be.false;
        });
    });
});