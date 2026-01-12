/**
 * @fileoverview ChaCha20 stream cipher implementation (RFC 8439)
 * @module crypto/chacha20
 */

'use strict';

/**
 * ChaCha20 constants: "expand 32-byte k" in ASCII
 * @constant {Uint32Array}
 */
const CONSTANTS = new Uint32Array([0x61707865, 0x3320646e, 0x79622d32, 0x6b206574]);

/**
 * Performs left rotation on a 32-bit unsigned integer
 * @param {number} v - Value to rotate
 * @param {number} c - Number of bits to rotate
 * @returns {number} Rotated value
 */
function rotl32(v, c) {
  return ((v << c) | (v >>> (32 - c))) >>> 0;
}

/**
 * ChaCha20 quarter round operation
 * Modifies state array in place
 * @param {Uint32Array} state - 16-element state array
 * @param {number} a - Index a
 * @param {number} b - Index b
 * @param {number} c - Index c
 * @param {number} d - Index d
 */
function quarterRound(state, a, b, c, d) {
  state[a] = (state[a] + state[b]) >>> 0;
  state[d] = rotl32(state[d] ^ state[a], 16);

  state[c] = (state[c] + state[d]) >>> 0;
  state[b] = rotl32(state[b] ^ state[c], 12);

  state[a] = (state[a] + state[b]) >>> 0;
  state[d] = rotl32(state[d] ^ state[a], 8);

  state[c] = (state[c] + state[d]) >>> 0;
  state[b] = rotl32(state[b] ^ state[c], 7);
}

/**
 * Creates initial ChaCha20 state from key, counter, and nonce
 * @param {Uint8Array} key - 32-byte key
 * @param {number} counter - 32-bit block counter
 * @param {Uint8Array} nonce - 12-byte nonce
 * @returns {Uint32Array} Initial state (16 x 32-bit words)
 */
function createState(key, counter, nonce) {
  const state = new Uint32Array(16);
  const keyView = new DataView(key.buffer, key.byteOffset, key.byteLength);
  const nonceView = new DataView(nonce.buffer, nonce.byteOffset, nonce.byteLength);

  // Constants
  state[0] = CONSTANTS[0];
  state[1] = CONSTANTS[1];
  state[2] = CONSTANTS[2];
  state[3] = CONSTANTS[3];

  // Key (little-endian)
  for (let i = 0; i < 8; i++) {
    state[4 + i] = keyView.getUint32(i * 4, true);
  }

  // Counter
  state[12] = counter >>> 0;

  // Nonce (little-endian)
  for (let i = 0; i < 3; i++) {
    state[13 + i] = nonceView.getUint32(i * 4, true);
  }

  return state;
}

/**
 * Computes a single ChaCha20 block
 * @param {Uint32Array} state - 16-element initial state
 * @returns {Uint32Array} 16-element output state
 */
function chacha20Block(state) {
  if (!(state instanceof Uint32Array) || state.length !== 16) {
    throw new Error('State must be a 16-element Uint32Array');
  }

  const working = new Uint32Array(state);

  // 20 rounds = 10 double rounds
  for (let i = 0; i < 10; i++) {
    // Column rounds
    quarterRound(working, 0, 4, 8, 12);
    quarterRound(working, 1, 5, 9, 13);
    quarterRound(working, 2, 6, 10, 14);
    quarterRound(working, 3, 7, 11, 15);
    // Diagonal rounds
    quarterRound(working, 0, 5, 10, 15);
    quarterRound(working, 1, 6, 11, 12);
    quarterRound(working, 2, 7, 8, 13);
    quarterRound(working, 3, 4, 9, 14);
  }

  // Add original state to working state
  const output = new Uint32Array(16);
  for (let i = 0; i < 16; i++) {
    output[i] = (working[i] + state[i]) >>> 0;
  }

  return output;
}

/**
 * Serializes 32-bit words to bytes (little-endian)
 * @param {Uint32Array} words - Array of 32-bit words
 * @returns {Uint8Array} Byte array
 */
function wordsToBytes(words) {
  const bytes = new Uint8Array(words.length * 4);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < words.length; i++) {
    view.setUint32(i * 4, words[i], true);
  }
  return bytes;
}

/**
 * ChaCha20 encryption/decryption (XOR with keystream)
 * @param {Uint8Array} key - 32-byte key
 * @param {Uint8Array} nonce - 12-byte nonce
 * @param {number} counter - Initial block counter
 * @param {Uint8Array} data - Data to encrypt/decrypt
 * @returns {Uint8Array} Encrypted/decrypted data
 * @throws {Error} If key is not 32 bytes or nonce is not 12 bytes
 */
function chacha20(key, nonce, counter, data) {
  if (!(key instanceof Uint8Array) || key.length !== 32) {
    throw new Error('Key must be 32 bytes');
  }
  if (!(nonce instanceof Uint8Array) || nonce.length !== 12) {
    throw new Error('Nonce must be 12 bytes');
  }
  if (!(data instanceof Uint8Array)) {
    throw new Error('Data must be a Uint8Array');
  }
  if (typeof counter !== 'number' || counter < 0 || counter > 0xFFFFFFFF) {
    throw new Error('Counter must be a 32-bit unsigned integer');
  }

  const output = new Uint8Array(data.length);
  let offset = 0;
  let blockCounter = counter;

  while (offset < data.length) {
    const state = createState(key, blockCounter, nonce);
    const keystream = wordsToBytes(chacha20Block(state));
    const remaining = data.length - offset;
    const blockSize = Math.min(64, remaining);

    for (let i = 0; i < blockSize; i++) {
      output[offset + i] = data[offset + i] ^ keystream[i];
    }

    offset += blockSize;
    blockCounter = (blockCounter + 1) >>> 0;

    if (blockCounter === 0 && offset < data.length) {
      throw new Error('Counter overflow');
    }
  }

  return output;
}

module.exports = {
  chacha20Block,
  chacha20
};
