const Datatypes = require('../../runtime/devices/modbus/datatypes');

describe('Modbus datatypes', () => {
    before(async () => {
        const chai = await import('chai');
        global.expect = chai.expect;
    });

    function wordsMLE(buffer) {
        return Buffer.from([
            buffer[4], buffer[5], buffer[6], buffer[7],
            buffer[0], buffer[1], buffer[2], buffer[3],
        ]);
    }

    function words32MLE(buffer) {
        return Buffer.from([buffer[2], buffer[3], buffer[0], buffer[1]]);
    }

    describe('Bool', () => {
        it('reads packed bits from the selected byte offset', () => {
            const buffer = Buffer.from([0b00000001, 0b10000000]);

            expect(Datatypes.Bool.parser(buffer, 0, 0)).to.equal(1);
            expect(Datatypes.Bool.parser(buffer, 0, 1)).to.equal(0);
            expect(Datatypes.Bool.parser(buffer, 1, 7)).to.equal(1);
        });

        it('formats truthy and falsy values to modbus write values', () => {
            expect(Datatypes.Bool.formatter(true)).to.equal(1);
            expect(Datatypes.Bool.formatter('1')).to.equal(1);
            expect(Datatypes.Bool.formatter(false)).to.equal(0);
            expect(Datatypes.Bool.formatter('0')).to.equal(0);
        });
    });

    describe('16-bit values', () => {
        it('parses and formats big-endian integers', () => {
            expect(Datatypes.Int16.parser(Buffer.from([0x12, 0x34]))).to.equal(0x1234);
            expect(Datatypes.UInt16.parser(Buffer.from([0xab, 0xcd]))).to.equal(0xabcd);
            expect(Datatypes.Int16.parser(Buffer.from([0xff, 0xfe]))).to.equal(-2);
            expect(Datatypes.Int16.formatter(0x1234)).to.deep.equal(Buffer.from([0x12, 0x34]));
        });

        it('parses and formats little-endian integers', () => {
            expect(Datatypes.Int16LE.parser(Buffer.from([0x34, 0x12]))).to.equal(0x1234);
            expect(Datatypes.UInt16LE.parser(Buffer.from([0xcd, 0xab]))).to.equal(0xabcd);
            expect(Datatypes.Int16LE.parser(Buffer.from([0xfe, 0xff]))).to.equal(-2);
            expect(Datatypes.Int16LE.formatter(0x1234)).to.deep.equal(Buffer.from([0x34, 0x12]));
        });
    });

    describe('32-bit values', () => {
        const intValue = 0x01020304;
        const intBE = Buffer.from([0x01, 0x02, 0x03, 0x04]);
        const intLE = Buffer.from([0x04, 0x03, 0x02, 0x01]);
        const floatValue = 12.5;
        const floatBE = Buffer.allocUnsafe(4);
        const floatLE = Buffer.allocUnsafe(4);

        before(() => {
            floatBE.writeFloatBE(floatValue);
            floatLE.writeFloatLE(floatValue);
        });

        it('parses and formats big-endian integers and floats', () => {
            expect(Datatypes.Int32.parser(intBE)).to.equal(intValue);
            expect(Datatypes.UInt32.parser(intBE)).to.equal(intValue);
            expect(Datatypes.Float32.parser(floatBE)).to.equal(floatValue);
            expect(Datatypes.Int32.formatter(intValue)).to.deep.equal(intBE);
            expect(Datatypes.Float32.formatter(floatValue)).to.deep.equal(floatBE);
        });

        it('parses and formats little-endian integers and floats', () => {
            expect(Datatypes.Int32LE.parser(intLE)).to.equal(intValue);
            expect(Datatypes.UInt32LE.parser(intLE)).to.equal(intValue);
            expect(Datatypes.Float32LE.parser(floatLE)).to.equal(floatValue);
            expect(Datatypes.Int32LE.formatter(intValue)).to.deep.equal(intLE);
            expect(Datatypes.Float32LE.formatter(floatValue)).to.deep.equal(floatLE);
        });

        it('parses and formats MLE word-swapped integers and floats', () => {
            expect(Datatypes.Int32MLE.parser(words32MLE(intBE))).to.equal(intValue);
            expect(Datatypes.UInt32MLE.parser(words32MLE(intBE))).to.equal(intValue);
            expect(Datatypes.Float32MLE.parser(words32MLE(floatBE))).to.equal(floatValue);
            expect(Datatypes.Int32MLE.formatter(intValue)).to.deep.equal(words32MLE(intBE));
            expect(Datatypes.Float32MLE.formatter(floatValue)).to.deep.equal(words32MLE(floatBE));
        });
    });

    describe('64-bit values', () => {
        const intValue = 0x01020304050607;
        const intBE = Buffer.allocUnsafe(8);
        const intLE = Buffer.allocUnsafe(8);
        const floatValue = 12345.6789;
        const floatBE = Buffer.allocUnsafe(8);
        const floatLE = Buffer.allocUnsafe(8);

        before(() => {
            intBE.writeBigInt64BE(BigInt(intValue));
            intLE.writeBigInt64LE(BigInt(intValue));
            floatBE.writeDoubleBE(floatValue);
            floatLE.writeDoubleLE(floatValue);
        });

        it('parses and formats big-endian integers and doubles', () => {
            expect(Datatypes.Int64.parser(intBE)).to.equal(intValue);
            expect(Datatypes.Float64.parser(floatBE)).to.equal(floatValue);
            expect(Datatypes.Int64.formatter(intValue)).to.deep.equal(intBE);
            expect(Datatypes.Float64.formatter(floatValue)).to.deep.equal(floatBE);
        });

        it('parses and formats little-endian integers and doubles', () => {
            expect(Datatypes.Int64LE.parser(intLE)).to.equal(intValue);
            expect(Datatypes.Float64LE.parser(floatLE)).to.equal(floatValue);
            expect(Datatypes.Int64LE.formatter(intValue)).to.deep.equal(intLE);
            expect(Datatypes.Float64LE.formatter(floatValue)).to.deep.equal(floatLE);
        });

        it('parses and formats current Float64MLE two-word-pair swap order', () => {
            expect(Datatypes.Float64MLE.parser(wordsMLE(floatBE))).to.equal(floatValue);
            expect(Datatypes.Float64MLE.formatter(floatValue)).to.deep.equal(wordsMLE(floatBE));
        });
    });

    describe('String', () => {
        it('parses and formats one ASCII character', () => {
            expect(Datatypes.String.parser(Buffer.from('ABC', 'ascii'), 1)).to.equal('B');
            expect(Datatypes.String.formatter('Z')).to.deep.equal(Buffer.from('Z', 'ascii'));
        });
    });
});
