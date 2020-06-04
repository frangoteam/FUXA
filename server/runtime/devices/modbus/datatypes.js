
function _gen(bytes, bFn, WordLen) {
    return {
        bytes,
        parser: (buffer, offset = 0) => buffer['read' + bFn](offset),
        formatter: v => {
            const b = Buffer.allocUnsafe(bytes);//new Buffer(bytes);
            b['write' + bFn](v);
            return b;
        },
        WordLen
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
        formatter: v => (v === '1' || v === true) ? 1 : 0,
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
