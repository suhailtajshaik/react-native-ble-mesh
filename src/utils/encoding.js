'use strict';

/**
 * @fileoverview Encoding conversion utilities
 * @module utils/encoding
 */

const HEX_CHARS = '0123456789abcdef';
const HEX_LOOKUP = new Uint8Array(256);

// Initialize hex lookup table
for (let i = 0; i < 16; i++) {
  HEX_LOOKUP[HEX_CHARS.charCodeAt(i)] = i;
  HEX_LOOKUP[HEX_CHARS.toUpperCase().charCodeAt(i)] = i;
}

// Pre-computed byte-to-hex lookup table (avoids per-byte toString + padStart)
const HEX_TABLE = new Array(256);
for (let i = 0; i < 256; i++) {
  HEX_TABLE[i] = HEX_CHARS[i >> 4] + HEX_CHARS[i & 0x0f];
}

// Cached TextEncoder/TextDecoder singletons (avoid per-call allocation)
/** @type {any} */ let _cachedEncoder = null;
/** @type {any} */ let _cachedDecoder = null;

/**
 * @returns {any}
 */
function _getEncoder() {
  if (!_cachedEncoder && typeof TextEncoder !== 'undefined') {
    _cachedEncoder = new TextEncoder();
  }
  return _cachedEncoder;
}

/**
 * @returns {any}
 */
function _getDecoder() {
  if (!_cachedDecoder && typeof TextDecoder !== 'undefined') {
    _cachedDecoder = new TextDecoder();
  }
  return _cachedDecoder;
}

/**
 * Converts a byte array to a hexadecimal string
 * @param {Uint8Array} bytes - Bytes to convert
 * @returns {string} Hexadecimal string
 */
function bytesToHex(bytes) {
  const parts = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    parts[i] = HEX_TABLE[bytes[i]];
  }
  return parts.join('');
}

/**
 * Converts a hexadecimal string to a byte array
 * @param {string} hex - Hexadecimal string
 * @returns {Uint8Array} Byte array
 */
function hexToBytes(hex) {
  if (typeof hex !== 'string') {
    throw new Error('Input must be a string');
  }

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
    bytes[i] = (hi << 4) | lo;
  }

  return bytes;
}

/**
 * Converts a UTF-8 string to a byte array
 * @param {string} str - String to convert
 * @returns {Uint8Array} UTF-8 encoded bytes
 */
function stringToBytes(str) {
  const encoder = _getEncoder();
  if (encoder) {
    return encoder.encode(str);
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
  const decoder = _getDecoder();
  if (decoder) {
    return decoder.decode(bytes);
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
      const adjusted = codePoint - 0x10000;
      result += String.fromCharCode(0xd800 + (adjusted >> 10), 0xdc00 + (adjusted & 0x3ff));
    }
  }

  return result;
}

module.exports = {
  bytesToHex,
  hexToBytes,
  stringToBytes,
  bytesToString
};
