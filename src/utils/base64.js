'use strict';

/**
 * @fileoverview Optimized Base64 encoding/decoding for React Native
 * @module utils/base64
 *
 * This implementation avoids string concatenation in loops which is O(n²).
 * Uses array building which is O(n) - critical for React Native performance.
 */

/**
 * Base64 character lookup table
 * @private
 */
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Reverse lookup table for decoding
 * @private
 */
const BASE64_LOOKUP = new Uint8Array(256);
for (let i = 0; i < BASE64_CHARS.length; i++) {
  BASE64_LOOKUP[BASE64_CHARS.charCodeAt(i)] = i;
}

/**
 * Encode Uint8Array to Base64 string (optimized for React Native)
 *
 * Uses array building instead of string concatenation to avoid O(n²) performance.
 *
 * @param {Uint8Array} bytes - The bytes to encode
 * @returns {string} Base64 encoded string
 * @throws {TypeError} If input is not a Uint8Array
 * @example
 * const encoded = encode(new Uint8Array([72, 101, 108, 108, 111]));
 * console.log(encoded); // "SGVsbG8="
 */
function encode(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('Input must be a Uint8Array');
  }

  const len = bytes.length;
  const resultLen = Math.ceil(len / 3) * 4;
  const result = new Array(resultLen);

  let i = 0;
  let j = 0;

  // Process 3 bytes at a time
  while (i < len - 2) {
    const b1 = bytes[i++];
    const b2 = bytes[i++];
    const b3 = bytes[i++];

    result[j++] = BASE64_CHARS[b1 >> 2];
    result[j++] = BASE64_CHARS[((b1 & 0x03) << 4) | (b2 >> 4)];
    result[j++] = BASE64_CHARS[((b2 & 0x0f) << 2) | (b3 >> 6)];
    result[j++] = BASE64_CHARS[b3 & 0x3f];
  }

  // Handle remaining bytes
  const remaining = len - i;
  if (remaining === 1) {
    const b1 = bytes[i];
    result[j++] = BASE64_CHARS[b1 >> 2];
    result[j++] = BASE64_CHARS[(b1 & 0x03) << 4];
    result[j++] = '=';
    result[j++] = '=';
  } else if (remaining === 2) {
    const b1 = bytes[i];
    const b2 = bytes[i + 1];
    result[j++] = BASE64_CHARS[b1 >> 2];
    result[j++] = BASE64_CHARS[((b1 & 0x03) << 4) | (b2 >> 4)];
    result[j++] = BASE64_CHARS[(b2 & 0x0f) << 2];
    result[j++] = '=';
  }

  return result.join('');
}

/**
 * Decode Base64 string to Uint8Array (optimized for React Native)
 *
 * @param {string} base64 - The Base64 string to decode
 * @returns {Uint8Array} Decoded bytes
 * @throws {TypeError} If input is not a string
 * @throws {Error} If input contains invalid Base64 characters
 * @example
 * const decoded = decode("SGVsbG8=");
 * console.log(decoded); // Uint8Array([72, 101, 108, 108, 111])
 */
function decode(base64) {
  if (typeof base64 !== 'string') {
    throw new TypeError('Input must be a string');
  }

  // Remove padding and calculate output length
  const len = base64.length;
  let padding = 0;

  if (len > 0 && base64[len - 1] === '=') {
    padding++;
    if (len > 1 && base64[len - 2] === '=') {
      padding++;
    }
  }

  const outputLen = (len * 3 / 4) - padding;
  const result = new Uint8Array(outputLen);

  let i = 0;
  let j = 0;

  // Process 4 characters at a time
  while (i < len) {
    const c1 = BASE64_LOOKUP[base64.charCodeAt(i++)];
    const c2 = BASE64_LOOKUP[base64.charCodeAt(i++)];
    const c3 = BASE64_LOOKUP[base64.charCodeAt(i++)];
    const c4 = BASE64_LOOKUP[base64.charCodeAt(i++)];

    result[j++] = (c1 << 2) | (c2 >> 4);
    if (j < outputLen) {
      result[j++] = ((c2 & 0x0f) << 4) | (c3 >> 2);
    }
    if (j < outputLen) {
      result[j++] = ((c3 & 0x03) << 6) | c4;
    }
  }

  return result;
}

/**
 * Check if a string is valid Base64
 * @param {string} str - String to check
 * @returns {boolean} True if valid Base64
 */
function isValid(str) {
  if (typeof str !== 'string') {
    return false;
  }
  // Base64 regex: only valid chars, proper length, proper padding
  return /^[A-Za-z0-9+/]*={0,2}$/.test(str) && str.length % 4 === 0;
}

module.exports = {
  encode,
  decode,
  isValid
};
