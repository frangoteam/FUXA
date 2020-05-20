
function _gen(bytes, bFn, WordLen) {
    return {
        bytes,
        parser: (buffer, offset = 0) => buffer['read' + bFn](offset),
        formatter: v => {
            const b = new Buffer(bytes);
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
        bytes: 0,
        parser: (v) => (v === true) ? 1 : 0,
        formatter: v => v,
        WordLen: 1
    },
    /**
     * Int16
     */
    Int16: _gen(2, 'Int16', 2),
    /**
     * UInt16
     */
    UInt16: _gen(4, 'UInt16', 2),
    /**
     * Int32
     */
    Int32: _gen(2, 'Int32', 4),
    /**
     * UInt32
     */
    UInt32: _gen(4, 'UInt32', 4),
    /**
     * Float32
     */
    Float32: _gen(2, 'Float32', 4),
    /**
     * Float64
     */
    Float64: _gen(4, 'Float64', 8),
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
