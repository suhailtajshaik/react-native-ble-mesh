'use strict';

/**
 * @fileoverview Byte manipulation utilities
 * @module utils/bytes
 */

/**
 * Concatenates multiple Uint8Arrays into a single array
 * @param {...Uint8Array} arrays - Arrays to concatenate
 * @returns {Uint8Array} Concatenated array
 */
function concat(...arrays) {
  // Filter out undefined/null and calculate total length
  const validArrays = arrays.filter(arr => arr !== null && arr !== undefined);
  const totalLength = validArrays.reduce((sum, arr) => sum + arr.length, 0);

  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const arr of validArrays) {
    result.set(arr, offset);
    offset += arr.length;
  }

  return result;
}

/**
 * Compares two byte arrays in constant time to prevent timing attacks
 * @param {Uint8Array} a - First array
 * @param {Uint8Array} b - Second array
 * @returns {boolean} True if arrays are equal
 */
function constantTimeEqual(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) {
    return false;
  }

  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}

/**
 * Generates cryptographically secure random bytes
 *
 * For React Native, you must install and import 'react-native-get-random-values'
 * at the top of your entry file (index.js or App.js) BEFORE any other imports:
 *
 * ```javascript
 * import 'react-native-get-random-values';
 * ```
 *
 * @param {number} length - Number of bytes to generate
 * @returns {Uint8Array} Random bytes
 * @throws {Error} If crypto is not available
 */
function randomBytes(length) {
  if (length < 0 || !Number.isInteger(length)) {
    throw new Error('Length must be a non-negative integer');
  }

  if (length === 0) {
    return new Uint8Array(0);
  }

  const bytes = new Uint8Array(length);

  // Try Web Crypto API (browser, React Native with polyfill, modern Node.js)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
    return bytes;
  }

  // Try globalThis.crypto (Node.js 19+, browsers, React Native with polyfill)
  if (typeof globalThis !== 'undefined' &&
      typeof globalThis.crypto !== 'undefined' &&
      globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }

  throw new Error(
    'No secure random number generator available. ' +
    'For React Native, install and import "react-native-get-random-values" ' +
    'at the top of your entry file before any other imports.'
  );
}

/**
 * XORs two byte arrays together
 * @param {Uint8Array} a - First array
 * @param {Uint8Array} b - Second array
 * @returns {Uint8Array} XOR result (length matches shorter array)
 */
function xor(a, b) {
  const length = Math.min(a.length, b.length);
  const result = new Uint8Array(length);

  for (let i = 0; i < length; i++) {
    result[i] = a[i] ^ b[i];
  }

  return result;
}

/**
 * Fills a byte array with a specific value
 * @param {Uint8Array} array - Array to fill
 * @param {number} value - Value to fill with (0-255)
 * @returns {Uint8Array} The filled array (same reference)
 */
function fill(array, value) {
  const byte = value & 0xff;
  for (let i = 0; i < array.length; i++) {
    array[i] = byte;
  }
  return array;
}

/**
 * Creates a copy of a byte array
 * @param {Uint8Array} array - Array to copy
 * @returns {Uint8Array} Copy of the array
 */
function copy(array) {
  const result = new Uint8Array(array.length);
  result.set(array);
  return result;
}

/**
 * Securely wipes a byte array by overwriting with zeros
 * @param {Uint8Array} array - Array to wipe
 */
function secureWipe(array) {
  fill(array, 0);
}

/**
 * Checks if two byte arrays are equal (non-constant-time)
 * Use constantTimeEqual for security-sensitive comparisons
 * @param {Uint8Array} a - First array
 * @param {Uint8Array} b - Second array
 * @returns {boolean} True if arrays are equal
 */
function equals(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Creates a view into a byte array without copying
 * @param {Uint8Array} array - Source array
 * @param {number} start - Start offset
 * @param {number} [length] - Length of view (defaults to rest of array)
 * @returns {Uint8Array} View into the array
 */
function slice(array, start, length) {
  const end = length !== undefined ? start + length : array.length;
  return array.subarray(start, end);
}

module.exports = {
  concat,
  constantTimeEqual,
  randomBytes,
  xor,
  fill,
  copy,
  secureWipe,
  equals,
  slice
};
