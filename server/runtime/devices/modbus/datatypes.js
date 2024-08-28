
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
        var temp = buffer[offset + 0];
        buffer[offset + 0] = buffer[offset + 2]; buffer[offset + 2] = temp;
        temp = buffer[offset + 1];
        buffer[offset + 1] = buffer[offset + 3]; buffer[offset + 3] = temp;
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
     * Int64
     */
    Int64: _gen(8, 'BigInt64BE', 4, 0, true),

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
     * Int64
     */
    Int64LE: _gen(8, 'BigInt64LE', 4, 0, true),

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
