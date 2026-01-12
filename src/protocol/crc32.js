'use strict';

/**
 * @fileoverview CRC32 checksum implementation using standard polynomial.
 * @module protocol/crc32
 */

/**
 * CRC32 polynomial (IEEE 802.3 standard, reversed).
 * @constant {number}
 */
const CRC32_POLYNOMIAL = 0xEDB88320;

/**
 * Pre-computed CRC32 lookup table.
 * @type {Uint32Array}
 */
const CRC32_TABLE = buildTable();

/**
 * Builds the CRC32 lookup table.
 * @returns {Uint32Array} 256-entry lookup table
 */
function buildTable() {
  const table = new Uint32Array(256);

  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ CRC32_POLYNOMIAL;
      } else {
        crc = crc >>> 1;
      }
    }
    table[i] = crc >>> 0;
  }

  return table;
}

/**
 * Calculates CRC32 checksum of the given data.
 * Uses the standard CRC32 polynomial (0xEDB88320) with the IEEE algorithm.
 *
 * @param {Uint8Array} data - Input data to compute checksum for
 * @returns {number} 32-bit unsigned CRC32 checksum
 * @throws {TypeError} If data is not a Uint8Array
 *
 * @example
 * const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
 * const checksum = crc32(data);
 * console.log(checksum.toString(16)); // "f7d18982"
 */
function crc32(data) {
  if (!(data instanceof Uint8Array)) {
    throw new TypeError('Data must be a Uint8Array');
  }

  let crc = 0xFFFFFFFF;

  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    const tableIndex = (crc ^ byte) & 0xFF;
    crc = (crc >>> 8) ^ CRC32_TABLE[tableIndex];
  }

  // Return inverted result as unsigned 32-bit integer
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Verifies that data matches an expected CRC32 checksum.
 *
 * @param {Uint8Array} data - Input data to verify
 * @param {number} expectedCrc - Expected CRC32 checksum
 * @returns {boolean} True if checksum matches
 *
 * @example
 * const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
 * const isValid = verifyCrc32(data, 0xf7d18982);
 * console.log(isValid); // true
 */
function verifyCrc32(data, expectedCrc) {
  const actualCrc = crc32(data);
  return actualCrc === (expectedCrc >>> 0);
}

module.exports = {
  crc32,
  verifyCrc32,
  CRC32_POLYNOMIAL
};
