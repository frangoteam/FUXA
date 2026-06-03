
function _gen(bytes, bFn, WordLen, swapType, toCast = false) {
    return {
        bytes,
        parser: (buffer, offset = 0) => {
            _swap(buffer, swapType, offset);
            var value = buffer['read' + bFn](offset);
            return (toCast) ? Number(value) : value;
        },
        formatter: v => {
            var b = Buffer.allocUnsafe(bytes);//new Buffer(bytes);
            b['write' + bFn](toCast ? BigInt(Math.round(v)) : v);
            _swap(b, swapType);
            return b;
        },
        WordLen
    }
}

function _swap(buffer, swapType, offset = 0) {
    if (swapType == 2) {
        // MLE: swap bytes within each 16-bit word, every 4 bytes
        for (var i = 0; i < buffer.length - offset; i += 4) {
            var temp = buffer[offset + i + 0];
            buffer[offset + i + 0] = buffer[offset + i + 2]; buffer[offset + i + 2] = temp;
            temp = buffer[offset + i + 1];
            buffer[offset + i + 1] = buffer[offset + i + 3]; buffer[offset + i + 3] = temp;
        }
    } else if (swapType == 3) {
        // MBE: swap 16-bit words between the two halves of the 64-bit value
        for (let i = 0; i < 4; i += 2) {
            const i1 = offset + i;
            const i2 = offset + i + 4;
            const t0 = buffer[i1], t1 = buffer[i1 + 1];
            buffer[i1] = buffer[i2]; buffer[i1 + 1] = buffer[i2 + 1];
            buffer[i2] = t0; buffer[i2 + 1] = t1;
        }
    } else if (swapType == 4) {
        // MLE 64-bit: reverse all 4 words [w0,w1,w2,w3] -> [w3,w2,w1,w0] then read BE
        const w = [
            [buffer[offset+0], buffer[offset+1]],
            [buffer[offset+2], buffer[offset+3]],
            [buffer[offset+4], buffer[offset+5]],
            [buffer[offset+6], buffer[offset+7]],
        ];
        buffer[offset+0] = w[3][0]; buffer[offset+1] = w[3][1];
        buffer[offset+2] = w[2][0]; buffer[offset+3] = w[2][1];
        buffer[offset+4] = w[1][0]; buffer[offset+5] = w[1][1];
        buffer[offset+6] = w[0][0]; buffer[offset+7] = w[0][1];
    }
}

const Datatypes = {
    /**
     * Bool
     */
    Bool: {
        bytes: 1,
        // parser: (v, bit = 0) => v >> bit & 1 === 1,
        parser: (buffer, offset = 0, bit = 0) => +buffer.readUInt8(offset) >> bit & 1 === 1,
        formatter: v => (v === '1' || v === 1 || v === true) ? 1 : 0,
        WordLen: 1
    },
    /**
     * Int16
     */
    Int16: _gen(2, 'Int16BE', 1),
    /**
     * UInt16
     */
    UInt16: _gen(2, 'UInt16BE', 1),
    /**
     * Int32
     */
    Int32: _gen(4, 'Int32BE', 2),
    /**
     * UInt32
     */
    UInt32: _gen(4, 'UInt32BE', 2),
    /**
     * Float32
     */
    Float32: _gen(4, 'FloatBE', 2),
    /**
     * Float64
     */
    Float64: _gen(8, 'DoubleBE', 4),
    /**
     * Float64MLE
    */
    Float64MLE: _gen(8, 'DoubleBE', 4, 2),

    /**
     * Int64
     */
    Int64: _gen(8, 'BigInt64BE', 4, 0, true),
    /**
     * UInt64
     */
    UInt64: _gen(8, 'BigUInt64BE', 4, 0, true),

    /**
     * Int16LE
     */
    Int16LE: _gen(2, 'Int16LE', 1),
    /**
     * UInt16LE
     */
    UInt16LE: _gen(2, 'UInt16LE', 1),
    /**
     * Int32LE
     */
    Int32LE: _gen(4, 'Int32LE', 2),
    /**
     * UInt32LE
     */
    UInt32LE: _gen(4, 'UInt32LE', 2),
    /**
     * Float32LE
     */
    Float32LE: _gen(4, 'FloatLE', 2),
    /**
     * Float64LE
     */
    Float64LE: _gen(8, 'DoubleLE', 4),
    /**
     * Int64LE
     */
    Int64LE: _gen(8, 'BigInt64LE', 4, 0, true),
    /**
     * UInt64LE
     */
    UInt64LE: _gen(8, 'BigUInt64LE', 4, 0, true),

    /**
     * Int32MLE
     */
    Int32MLE: _gen(4, 'Int32BE', 2, 2),
    /**
     * UInt32MLE
     */
    UInt32MLE: _gen(4, 'UInt32BE', 2, 2),
    /**
     * Float32MLE
     */
    Float32MLE: _gen(4, 'FloatBE', 2, 2),
    /**
     * Float64MLE
     */
    Float64MLE: _gen(8, 'DoubleBE', 4, 2),
    /**
     * Int64MLE
     */
    Int64MLE: _gen(8, 'BigInt64BE', 4, 4, true),
    /**
     * UInt64MLE
     */
    UInt64MLE: _gen(8, 'BigUInt64BE', 4, 4, true),
    /**
     * Int64MBE
     */
    Int64MBE: _gen(8, 'BigInt64BE', 4, 3, true),
    /**
     * UInt64MBE
     */
    UInt64MBE: _gen(8, 'BigUInt64BE', 4, 3, true),

    /**
     * String
     */
    String: {
        bytes: 1,
        parser: (buffer, offset = 0) => buffer.toString('ascii', offset, offset + 1),
        formatter: v => new Buffer(v, 'ascii'),
        WordLen: 1
    }
};

module.exports = Datatypes;
