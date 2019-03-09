const snap7 = require('node-snap7').S7Client();
/**
 * S7Client Datatype
 *
 * @typedef {object} S7ClientDatatype
 * @property {number} bytes - Number of bytes
 * @property {function} parser - Convert Buffer to {bool|number|string}
 * @property {function} formatter - Convert {bool|number|string} to Buffer
 * @property {number} S7WordLen - S7WL type
 */

function _gen(bytes, bFn, S7WordLen) {
  return {
    bytes,
    parser: (buffer, offset = 0) => buffer['read'+bFn](offset),
    formatter: v => {
      const b = new Buffer(bytes);
      b['write'+bFn](v);
      return b;
    },
    S7WordLen
  }
}

/**
 * @enum
 */
const Datatypes = {
  /**
   * BOOL
   * @type {S7ClientDatatype}
   */
  BOOL: {
    bytes: 1,
    parser: (buffer, offset = 0, bit = 0) => +buffer.readUInt8(offset) >> bit & 1 === 1,
    formatter: v => new Buffer([v ? 0x01 : 0x00]),
    S7WordLen: snap7.S7WLBit
  },

  /**
   * BYTE
   * @type {S7ClientDatatype}
   */
  BYTE: _gen(1, 'UInt8', snap7.S7WLByte),

  /**
   * WORD
   * @type {S7ClientDatatype}
   */
  WORD: _gen(2, 'UInt16BE', snap7.S7WLWord),

  /**
   * DWORD
   * @type {S7ClientDatatype}
   */
  DWORD: _gen(4, 'UInt32BE', snap7.S7WLDWord),

  /**
   * CHAR
   * @type {S7ClientDatatype}
   */
  CHAR: {
    bytes: 1,
    parser: (buffer, offset = 0) => buffer.toString('ascii', offset, offset + 1),
    formatter: v => new Buffer(v, 'ascii'),
    S7WordLen: snap7.S7WLByte
  },

  /**
   * INT
   * @type {S7ClientDatatype}
   */
  INT: _gen(2, 'Int16BE', snap7.S7WLWord),

  /**
   * DINT
   * @type {S7ClientDatatype}
   */
  DINT: _gen(4, 'Int32BE', snap7.S7WLDWord),

  /**
   * REAL
   * @type {S7ClientDatatype}
   */
  REAL: _gen(4, 'FloatBE', snap7.S7WLReal),
};

module.exports = Datatypes;