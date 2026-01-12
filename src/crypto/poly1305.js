/**
 * @fileoverview Poly1305 message authentication code (RFC 8439)
 * @module crypto/poly1305
 */

'use strict';

/**
 * Clamps the r portion of the Poly1305 key per RFC 8439
 * Clears bits 4,5,6,7 of bytes 3,7,11,15 and bits 0,1 of bytes 4,8,12
 * @param {Uint8Array} r - 16-byte r value (modified in place)
 * @returns {Uint8Array} Clamped r value
 */
function clamp(r) {
  r[3] &= 0x0f;
  r[7] &= 0x0f;
  r[11] &= 0x0f;
  r[15] &= 0x0f;
  r[4] &= 0xfc;
  r[8] &= 0xfc;
  r[12] &= 0xfc;
  return r;
}

/**
 * Converts bytes to BigInt (little-endian)
 * @param {Uint8Array} bytes - Byte array
 * @returns {bigint} BigInt value
 */
function bytesToBigInt(bytes) {
  let result = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(bytes[i]);
  }
  return result;
}

/**
 * Converts BigInt to bytes (little-endian)
 * @param {bigint} num - BigInt value
 * @param {number} length - Desired byte length
 * @returns {Uint8Array} Byte array
 */
function bigIntToBytes(num, length) {
  const bytes = new Uint8Array(length);
  let value = num;
  for (let i = 0; i < length; i++) {
    bytes[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  return bytes;
}

/**
 * Computes Poly1305 MAC
 * @param {Uint8Array} key - 32-byte one-time key
 * @param {Uint8Array} message - Message to authenticate
 * @returns {Uint8Array} 16-byte authentication tag
 * @throws {Error} If key is not 32 bytes
 */
function poly1305(key, message) {
  if (!(key instanceof Uint8Array) || key.length !== 32) {
    throw new Error('Key must be 32 bytes');
  }
  if (!(message instanceof Uint8Array)) {
    throw new Error('Message must be a Uint8Array');
  }

  // Split key into r and s
  const r = new Uint8Array(key.subarray(0, 16));
  const s = key.subarray(16, 32);

  // Clamp r
  clamp(r);

  // Convert to BigInt
  const rBig = bytesToBigInt(r);
  const sBig = bytesToBigInt(s);

  // Prime p = 2^130 - 5
  const p = (1n << 130n) - 5n;

  // Process message in 16-byte blocks
  let accumulator = 0n;
  const numBlocks = Math.ceil(message.length / 16);

  for (let i = 0; i < numBlocks; i++) {
    const start = i * 16;
    const end = Math.min(start + 16, message.length);
    const blockSize = end - start;

    // Create block with appended 0x01 byte
    const block = new Uint8Array(blockSize + 1);
    block.set(message.subarray(start, end));
    block[blockSize] = 0x01;

    // Convert block to number and add to accumulator
    const n = bytesToBigInt(block);
    accumulator = (accumulator + n) % p;

    // Multiply by r
    accumulator = (accumulator * rBig) % p;
  }

  // Add s (no reduction mod p)
  const tag = (accumulator + sBig) % (1n << 128n);

  return bigIntToBytes(tag, 16);
}

module.exports = {
  poly1305
};
