'use strict';

/**
 * @fileoverview Encoding conversion utilities
 * @module utils/encoding
 */

/**
 * Lookup tables for hex encoding
 * @private
 */
const HEX_CHARS = '0123456789abcdef';
const HEX_LOOKUP = new Uint8Array(256);

// Initialize hex lookup table
for (let i = 0; i < 16; i++) {
  HEX_LOOKUP[HEX_CHARS.charCodeAt(i)] = i;
  HEX_LOOKUP[HEX_CHARS.toUpperCase().charCodeAt(i)] = i;
}

/**
 * Converts a byte array to a hexadecimal string
 * @param {Uint8Array} bytes - Bytes to convert
 * @returns {string} Hexadecimal string
 */
function bytesToHex(bytes) {
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    result += HEX_CHARS[bytes[i] >> 4];
    result += HEX_CHARS[bytes[i] & 0x0f];
  }
  return result;
}

/**
 * Converts a hexadecimal string to a byte array
 * @param {string} hex - Hexadecimal string
 * @returns {Uint8Array} Byte array
 * @throws {Error} If hex string has invalid length or characters
 */
function hexToBytes(hex) {
  if (typeof hex !== 'string') {
    throw new Error('Input must be a string');
  }

  // Remove optional 0x prefix
  if (hex.startsWith('0x') || hex.startsWith('0X')) {
    hex = hex.slice(2);
  }

  if (hex.length % 2 !== 0) {
    throw new Error('Hex string must have even length');
  }

  const bytes = new Uint8Array(hex.length / 2);

  for (let i = 0; i < bytes.length; i++) {
    const hi = HEX_LOOKUP[hex.charCodeAt(i * 2)];
    const lo = HEX_LOOKUP[hex.charCodeAt(i * 2 + 1)];

    if (hi === undefined || lo === undefined) {
      throw new Error(`Invalid hex character at position ${i * 2}`);
    }

    bytes[i] = (hi << 4) | lo;
  }

  return bytes;
}

/**
 * Base64 character set
 * @private
 */
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_LOOKUP = new Uint8Array(256);

// Initialize base64 lookup table
for (let i = 0; i < BASE64_CHARS.length; i++) {
  BASE64_LOOKUP[BASE64_CHARS.charCodeAt(i)] = i;
}

/**
 * Converts a byte array to a Base64 string
 * @param {Uint8Array} bytes - Bytes to convert
 * @returns {string} Base64 string
 */
function bytesToBase64(bytes) {
  let result = '';
  const len = bytes.length;
  const remainder = len % 3;

  // Process 3 bytes at a time
  for (let i = 0; i < len - remainder; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    result += BASE64_CHARS[(n >> 18) & 0x3f];
    result += BASE64_CHARS[(n >> 12) & 0x3f];
    result += BASE64_CHARS[(n >> 6) & 0x3f];
    result += BASE64_CHARS[n & 0x3f];
  }

  // Handle remainder
  if (remainder === 1) {
    const n = bytes[len - 1];
    result += BASE64_CHARS[(n >> 2) & 0x3f];
    result += BASE64_CHARS[(n << 4) & 0x3f];
    result += '==';
  } else if (remainder === 2) {
    const n = (bytes[len - 2] << 8) | bytes[len - 1];
    result += BASE64_CHARS[(n >> 10) & 0x3f];
    result += BASE64_CHARS[(n >> 4) & 0x3f];
    result += BASE64_CHARS[(n << 2) & 0x3f];
    result += '=';
  }

  return result;
}

/**
 * Converts a Base64 string to a byte array
 * @param {string} base64 - Base64 string
 * @returns {Uint8Array} Byte array
 * @throws {Error} If base64 string is invalid
 */
function base64ToBytes(base64) {
  if (typeof base64 !== 'string') {
    throw new Error('Input must be a string');
  }

  // Remove padding and calculate length
  let paddingLength = 0;
  if (base64.endsWith('==')) {
    paddingLength = 2;
  } else if (base64.endsWith('=')) {
    paddingLength = 1;
  }

  const len = base64.length;
  const outputLength = (len * 3) / 4 - paddingLength;
  const bytes = new Uint8Array(outputLength);

  let j = 0;
  for (let i = 0; i < len; i += 4) {
    const a = BASE64_LOOKUP[base64.charCodeAt(i)];
    const b = BASE64_LOOKUP[base64.charCodeAt(i + 1)];
    const c = BASE64_LOOKUP[base64.charCodeAt(i + 2)];
    const d = BASE64_LOOKUP[base64.charCodeAt(i + 3)];

    bytes[j++] = (a << 2) | (b >> 4);
    if (j < outputLength) { bytes[j++] = ((b & 0x0f) << 4) | (c >> 2); }
    if (j < outputLength) { bytes[j++] = ((c & 0x03) << 6) | d; }
  }

  return bytes;
}

/**
 * Converts a UTF-8 string to a byte array
 * @param {string} str - String to convert
 * @returns {Uint8Array} UTF-8 encoded bytes
 */
function stringToBytes(str) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str);
  }

  // Fallback for environments without TextEncoder
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);

    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6));
      bytes.push(0x80 | (code & 0x3f));
    } else if (code < 0xd800 || code >= 0xe000) {
      bytes.push(0xe0 | (code >> 12));
      bytes.push(0x80 | ((code >> 6) & 0x3f));
      bytes.push(0x80 | (code & 0x3f));
    } else {
      // Surrogate pair
      i++;
      code = 0x10000 + (((code & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      bytes.push(0xf0 | (code >> 18));
      bytes.push(0x80 | ((code >> 12) & 0x3f));
      bytes.push(0x80 | ((code >> 6) & 0x3f));
      bytes.push(0x80 | (code & 0x3f));
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Converts a UTF-8 byte array to a string
 * @param {Uint8Array} bytes - UTF-8 encoded bytes
 * @returns {string} Decoded string
 */
function bytesToString(bytes) {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder().decode(bytes);
  }

  // Fallback for environments without TextDecoder
  let result = '';
  let i = 0;

  while (i < bytes.length) {
    const byte1 = bytes[i++];

    if (byte1 < 0x80) {
      result += String.fromCharCode(byte1);
    } else if (byte1 < 0xe0) {
      const byte2 = bytes[i++];
      result += String.fromCharCode(((byte1 & 0x1f) << 6) | (byte2 & 0x3f));
    } else if (byte1 < 0xf0) {
      const byte2 = bytes[i++];
      const byte3 = bytes[i++];
      result += String.fromCharCode(
        ((byte1 & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f)
      );
    } else {
      const byte2 = bytes[i++];
      const byte3 = bytes[i++];
      const byte4 = bytes[i++];
      const codePoint =
        ((byte1 & 0x07) << 18) |
        ((byte2 & 0x3f) << 12) |
        ((byte3 & 0x3f) << 6) |
        (byte4 & 0x3f);
      // Convert to surrogate pair
      const adjusted = codePoint - 0x10000;
      result += String.fromCharCode(0xd800 + (adjusted >> 10), 0xdc00 + (adjusted & 0x3ff));
    }
  }

  return result;
}

module.exports = {
  bytesToHex,
  hexToBytes,
  bytesToBase64,
  base64ToBytes,
  stringToBytes,
  bytesToString
};
