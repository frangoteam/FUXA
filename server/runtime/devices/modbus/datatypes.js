
function _gen(bytes, bFn, WordLen, swapType, toCast = false, precision = 0) {
    return {
        bytes,
        parser: (buffer, offset = 0) => {
            var buf = Buffer.from(buffer.slice(offset, offset + bytes));
            _swap(buf, swapType, 0);
            var value = buf['read' + bFn](0);
            if (toCast) return Number(value);
            return (precision > 0) ? parseFloat(value.toPrecision(precision)) : value;
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
        // MLE 32-bit: swap the two 16-bit words [w0,w1] -> [w1,w0] = Byte order 3,4,1,2
        for (var i = 0; i < buffer.length - offset; i += 4) {
            var t0 = buffer[offset + i + 0], t1 = buffer[offset + i + 1];
            buffer[offset + i + 0] = buffer[offset + i + 2]; buffer[offset + i + 1] = buffer[offset + i + 3];
            buffer[offset + i + 2] = t0; buffer[offset + i + 3] = t1;
        }
    } else if (swapType == 3) {
        // MBE 32-bit: swap bytes within each 16-bit word b0<->b1, b2<->b3 = Byte order 2,1,4,3
        for (var i = 0; i < buffer.length - offset; i += 2) {
            var temp = buffer[offset + i + 0];
            buffer[offset + i + 0] = buffer[offset + i + 1];
            buffer[offset + i + 1] = temp;
        }
    } else if (swapType == 4) {
        // MLE/MBE 64-bit: reverse all 4 words [w0,w1,w2,w3] -> [w3,w2,w1,w0]
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
    Bool: {
        bytes: 2,
        parser: (buffer, offset = 0, bit = 0) => {
            if (buffer.length - offset < 2) return +buffer.readUInt8(offset) >> bit & 1 === 1;
            return +buffer.readUInt16BE(offset) >> bit & 1 === 1;
        },
        formatter: v => (v === '1' || v === 1 || v === true) ? 1 : 0,
        WordLen: 1
    },
    // --- 16-bit ---
    Int16:    _gen(2, 'Int16BE',  1),
    UInt16:   _gen(2, 'UInt16BE', 1),
    Int16LE:  _gen(2, 'Int16LE',  1),
    UInt16LE: _gen(2, 'UInt16LE', 1),
    // --- 32-bit ---
    Int32:    _gen(4, 'Int32BE',  2),
    UInt32:   _gen(4, 'UInt32BE', 2),
    Float32:  _gen(4, 'FloatBE',  2, 0, false, 7),
    Int32LE:  _gen(4, 'Int32LE',  2),
    UInt32LE: _gen(4, 'UInt32LE', 2),
    Float32LE: _gen(4, 'FloatLE', 2, 0, false, 7),
    Int32MLE:  _gen(4, 'Int32BE',  2, 2),
    UInt32MLE: _gen(4, 'UInt32BE', 2, 2),
    Float32MLE: _gen(4, 'FloatBE', 2, 2, false, 7),
    Int32MBE:  _gen(4, 'Int32BE',  2, 3),
    UInt32MBE: _gen(4, 'UInt32BE', 2, 3),
    Float32MBE: _gen(4, 'FloatBE', 2, 3, false, 7),
    // --- 64-bit ---
    Int64:    _gen(8, 'BigInt64BE',  4, 0, true),
    UInt64:   _gen(8, 'BigUInt64BE', 4, 0, true),
    Float64:  _gen(8, 'DoubleBE',    4),
    Int64LE:  _gen(8, 'BigInt64LE',  4, 0, true),
    UInt64LE: _gen(8, 'BigUInt64LE', 4, 0, true),
    Float64LE: _gen(8, 'DoubleLE',   4),
    Int64MBE:  _gen(8, 'BigInt64LE',  4, 4, true),
    UInt64MBE: _gen(8, 'BigUInt64BE', 4, 4, true),
    Float64MBE: _gen(8, 'DoubleLE',  4, 4),
    Int64MLE:  _gen(8, 'BigInt64BE',  4, 4, true),
    UInt64MLE: _gen(8, 'BigUInt64BE', 4, 4, true),
    Float64MLE: _gen(8, 'DoubleBE',   4, 4),
    // --- String ---
    String: {
        bytes: 1,
        parser: (buffer, offset = 0) => buffer.toString('ascii', offset, offset + 1),
        formatter: v => new Buffer(v, 'ascii'),
        WordLen: 1
    }
};

module.exports = Datatypes;
