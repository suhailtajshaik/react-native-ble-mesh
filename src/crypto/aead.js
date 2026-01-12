/**
 * @fileoverview ChaCha20-Poly1305 AEAD implementation (RFC 8439)
 * @module crypto/aead
 */

'use strict';

const { chacha20 } = require('./chacha20');
const { poly1305 } = require('./poly1305');

/**
 * Generates Poly1305 key using ChaCha20 with counter=0
 * @param {Uint8Array} key - 32-byte encryption key
 * @param {Uint8Array} nonce - 12-byte nonce
 * @returns {Uint8Array} 32-byte Poly1305 key
 */
function generatePolyKey(key, nonce) {
  const zeros = new Uint8Array(64);
  const block = chacha20(key, nonce, 0, zeros);
  return block.subarray(0, 32);
}

/**
 * Pads data to 16-byte boundary with zeros
 * @param {number} length - Current data length
 * @returns {Uint8Array} Padding bytes (0-15 bytes)
 */
function pad16(length) {
  const remainder = length % 16;
  if (remainder === 0) {
    return new Uint8Array(0);
  }
  return new Uint8Array(16 - remainder);
}

/**
 * Encodes a 64-bit little-endian integer
 * @param {number} value - Value to encode
 * @returns {Uint8Array} 8-byte little-endian representation
 */
function encode64LE(value) {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  // JavaScript numbers are 64-bit floats, safe for values up to 2^53-1
  view.setUint32(0, value >>> 0, true);
  view.setUint32(4, Math.floor(value / 0x100000000) >>> 0, true);
  return bytes;
}

/**
 * Constructs Poly1305 MAC input per RFC 8439
 * @param {Uint8Array} aad - Additional authenticated data
 * @param {Uint8Array} ciphertext - Ciphertext
 * @returns {Uint8Array} MAC input
 */
function constructMacData(aad, ciphertext) {
  const aadPad = pad16(aad.length);
  const ctPad = pad16(ciphertext.length);
  const aadLen = encode64LE(aad.length);
  const ctLen = encode64LE(ciphertext.length);

  const totalLen = aad.length + aadPad.length + ciphertext.length +
                   ctPad.length + 8 + 8;
  const data = new Uint8Array(totalLen);

  let offset = 0;
  data.set(aad, offset);
  offset += aad.length;
  data.set(aadPad, offset);
  offset += aadPad.length;
  data.set(ciphertext, offset);
  offset += ciphertext.length;
  data.set(ctPad, offset);
  offset += ctPad.length;
  data.set(aadLen, offset);
  offset += 8;
  data.set(ctLen, offset);

  return data;
}

/**
 * Constant-time comparison of two byte arrays
 * @param {Uint8Array} a - First array
 * @param {Uint8Array} b - Second array
 * @returns {boolean} True if arrays are equal
 */
function constantTimeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/**
 * Encrypts and authenticates data using ChaCha20-Poly1305 AEAD
 * @param {Uint8Array} key - 32-byte encryption key
 * @param {Uint8Array} nonce - 12-byte nonce (must be unique per key)
 * @param {Uint8Array} plaintext - Data to encrypt
 * @param {Uint8Array} [aad] - Additional authenticated data (optional)
 * @returns {Uint8Array} Ciphertext with appended 16-byte authentication tag
 * @throws {Error} If key is not 32 bytes or nonce is not 12 bytes
 */
function encrypt(key, nonce, plaintext, aad = new Uint8Array(0)) {
  if (!(key instanceof Uint8Array) || key.length !== 32) {
    throw new Error('Key must be 32 bytes');
  }
  if (!(nonce instanceof Uint8Array) || nonce.length !== 12) {
    throw new Error('Nonce must be 12 bytes');
  }
  if (!(plaintext instanceof Uint8Array)) {
    throw new Error('Plaintext must be a Uint8Array');
  }
  if (!(aad instanceof Uint8Array)) {
    throw new Error('AAD must be a Uint8Array');
  }

  // Generate Poly1305 key
  const polyKey = generatePolyKey(key, nonce);

  // Encrypt plaintext with counter starting at 1
  const ciphertext = chacha20(key, nonce, 1, plaintext);

  // Compute MAC
  const macData = constructMacData(aad, ciphertext);
  const tag = poly1305(polyKey, macData);

  // Concatenate ciphertext and tag
  const result = new Uint8Array(ciphertext.length + 16);
  result.set(ciphertext);
  result.set(tag, ciphertext.length);

  return result;
}

/**
 * Decrypts and verifies data using ChaCha20-Poly1305 AEAD
 * @param {Uint8Array} key - 32-byte encryption key
 * @param {Uint8Array} nonce - 12-byte nonce
 * @param {Uint8Array} ciphertext - Ciphertext with 16-byte authentication tag
 * @param {Uint8Array} [aad] - Additional authenticated data (optional)
 * @returns {Uint8Array|null} Decrypted plaintext, or null if authentication fails
 * @throws {Error} If key is not 32 bytes, nonce is not 12 bytes, or ciphertext too short
 */
function decrypt(key, nonce, ciphertext, aad = new Uint8Array(0)) {
  if (!(key instanceof Uint8Array) || key.length !== 32) {
    throw new Error('Key must be 32 bytes');
  }
  if (!(nonce instanceof Uint8Array) || nonce.length !== 12) {
    throw new Error('Nonce must be 12 bytes');
  }
  if (!(ciphertext instanceof Uint8Array)) {
    throw new Error('Ciphertext must be a Uint8Array');
  }
  if (ciphertext.length < 16) {
    throw new Error('Ciphertext must be at least 16 bytes (tag size)');
  }
  if (!(aad instanceof Uint8Array)) {
    throw new Error('AAD must be a Uint8Array');
  }

  // Split ciphertext and tag
  const ct = ciphertext.subarray(0, ciphertext.length - 16);
  const receivedTag = ciphertext.subarray(ciphertext.length - 16);

  // Generate Poly1305 key
  const polyKey = generatePolyKey(key, nonce);

  // Compute expected MAC
  const macData = constructMacData(aad, ct);
  const expectedTag = poly1305(polyKey, macData);

  // Verify tag using constant-time comparison
  if (!constantTimeEqual(receivedTag, expectedTag)) {
    return null;
  }

  // Decrypt ciphertext with counter starting at 1
  return chacha20(key, nonce, 1, ct);
}

module.exports = {
  encrypt,
  decrypt
};
