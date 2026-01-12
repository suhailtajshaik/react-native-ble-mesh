'use strict';

/**
 * SHA-256 Hash Function (FIPS 180-4)
 * Pure JavaScript implementation for BLE Mesh Network
 * @module crypto/sha256
 */

/**
 * SHA-256 round constants K[64]
 * First 32 bits of fractional parts of cube roots of first 64 primes
 * @type {Uint32Array}
 */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

/**
 * Initial hash values H[8]
 * First 32 bits of fractional parts of square roots of first 8 primes
 * @type {Uint32Array}
 */
const H_INIT = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
]);

/**
 * Right rotate a 32-bit integer
 * @param {number} x - Value to rotate
 * @param {number} n - Bits to rotate
 * @returns {number} Rotated value
 */
function rotr(x, n) {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

/**
 * SHA-256 compression function
 * Processes a single 512-bit block
 * @param {Uint32Array} H - Current hash state (8 words)
 * @param {Uint32Array} W - Message schedule (64 words)
 */
function compress(H, W) {
  // Extend 16 words to 64 words
  for (let i = 16; i < 64; i++) {
    const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
    const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
    W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
  }

  // Initialize working variables
  let a = H[0], b = H[1], c = H[2], d = H[3];
  let e = H[4], f = H[5], g = H[6], h = H[7];

  // 64 rounds
  for (let i = 0; i < 64; i++) {
    const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
    const ch = (e & f) ^ (~e & g);
    const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
    const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
    const maj = (a & b) ^ (a & c) ^ (b & c);
    const temp2 = (S0 + maj) >>> 0;

    h = g; g = f; f = e;
    e = (d + temp1) >>> 0;
    d = c; c = b; b = a;
    a = (temp1 + temp2) >>> 0;
  }

  // Add compressed chunk to hash
  H[0] = (H[0] + a) >>> 0;
  H[1] = (H[1] + b) >>> 0;
  H[2] = (H[2] + c) >>> 0;
  H[3] = (H[3] + d) >>> 0;
  H[4] = (H[4] + e) >>> 0;
  H[5] = (H[5] + f) >>> 0;
  H[6] = (H[6] + g) >>> 0;
  H[7] = (H[7] + h) >>> 0;
}

/**
 * HashContext for streaming SHA-256 computation
 * @class
 */
class HashContext {
  constructor() {
    this._H = new Uint32Array(H_INIT);
    this._buffer = new Uint8Array(64);
    this._bufferLength = 0;
    this._totalLength = 0;
    this._finalized = false;
  }

  /**
   * Update hash with additional data
   * @param {Uint8Array} data - Data to hash
   * @returns {HashContext} This context for chaining
   */
  update(data) {
    if (this._finalized) {
      throw new Error('Cannot update finalized hash');
    }

    const W = new Uint32Array(64);
    let offset = 0;

    // Process any buffered data first
    if (this._bufferLength > 0) {
      const needed = 64 - this._bufferLength;
      const toCopy = Math.min(needed, data.length);
      this._buffer.set(data.subarray(0, toCopy), this._bufferLength);
      this._bufferLength += toCopy;
      offset = toCopy;

      if (this._bufferLength === 64) {
        for (let i = 0; i < 16; i++) {
          W[i] = (this._buffer[i * 4] << 24) | (this._buffer[i * 4 + 1] << 16) |
                 (this._buffer[i * 4 + 2] << 8) | this._buffer[i * 4 + 3];
        }
        compress(this._H, W);
        this._bufferLength = 0;
      }
    }

    // Process complete 64-byte blocks
    while (offset + 64 <= data.length) {
      for (let i = 0; i < 16; i++) {
        W[i] = (data[offset + i * 4] << 24) | (data[offset + i * 4 + 1] << 16) |
               (data[offset + i * 4 + 2] << 8) | data[offset + i * 4 + 3];
      }
      compress(this._H, W);
      offset += 64;
    }

    // Buffer remaining bytes
    if (offset < data.length) {
      this._buffer.set(data.subarray(offset), 0);
      this._bufferLength = data.length - offset;
    }

    this._totalLength += data.length;
    return this;
  }

  /**
   * Finalize hash and return digest
   * @returns {Uint8Array} 32-byte hash digest
   */
  digest() {
    if (this._finalized) {
      throw new Error('Hash already finalized');
    }
    this._finalized = true;

    const W = new Uint32Array(64);
    const bitLength = this._totalLength * 8;

    // Append padding bit
    this._buffer[this._bufferLength++] = 0x80;

    // If not enough room for length, process current block
    if (this._bufferLength > 56) {
      this._buffer.fill(0, this._bufferLength, 64);
      for (let i = 0; i < 16; i++) {
        W[i] = (this._buffer[i * 4] << 24) | (this._buffer[i * 4 + 1] << 16) |
               (this._buffer[i * 4 + 2] << 8) | this._buffer[i * 4 + 3];
      }
      compress(this._H, W);
      this._bufferLength = 0;
    }

    // Pad with zeros and append 64-bit length (big-endian)
    this._buffer.fill(0, this._bufferLength, 56);
    // Note: JavaScript bitwise ops are 32-bit, handle high bits separately
    const highBits = Math.floor(bitLength / 0x100000000);
    this._buffer[56] = (highBits >>> 24) & 0xff;
    this._buffer[57] = (highBits >>> 16) & 0xff;
    this._buffer[58] = (highBits >>> 8) & 0xff;
    this._buffer[59] = highBits & 0xff;
    this._buffer[60] = (bitLength >>> 24) & 0xff;
    this._buffer[61] = (bitLength >>> 16) & 0xff;
    this._buffer[62] = (bitLength >>> 8) & 0xff;
    this._buffer[63] = bitLength & 0xff;

    for (let i = 0; i < 16; i++) {
      W[i] = (this._buffer[i * 4] << 24) | (this._buffer[i * 4 + 1] << 16) |
             (this._buffer[i * 4 + 2] << 8) | this._buffer[i * 4 + 3];
    }
    compress(this._H, W);

    // Convert hash to bytes
    const result = new Uint8Array(32);
    for (let i = 0; i < 8; i++) {
      result[i * 4] = (this._H[i] >>> 24) & 0xff;
      result[i * 4 + 1] = (this._H[i] >>> 16) & 0xff;
      result[i * 4 + 2] = (this._H[i] >>> 8) & 0xff;
      result[i * 4 + 3] = this._H[i] & 0xff;
    }
    return result;
  }
}

/**
 * Create a new streaming hash context
 * @returns {HashContext} New hash context
 */
function createHash() {
  return new HashContext();
}

/**
 * Compute SHA-256 hash of data
 * @param {Uint8Array} data - Data to hash
 * @returns {Uint8Array} 32-byte hash digest
 */
function hash(data) {
  return createHash().update(data).digest();
}

module.exports = {
  hash,
  createHash,
  HashContext
};
