'use strict';

/**
 * HMAC-SHA256 Implementation (RFC 2104)
 * Pure JavaScript implementation for BLE Mesh Network
 * @module crypto/hmac
 */

const { hash } = require('./sha256');

/**
 * HMAC block size in bytes (SHA-256 uses 64-byte blocks)
 * @constant {number}
 */
const BLOCK_SIZE = 64;

/**
 * Inner padding byte value
 * @constant {number}
 */
const IPAD = 0x36;

/**
 * Outer padding byte value
 * @constant {number}
 */
const OPAD = 0x5c;

/**
 * Compute HMAC-SHA256 of data with given key
 *
 * HMAC is computed as:
 *   HMAC(K, m) = H((K' XOR opad) || H((K' XOR ipad) || m))
 *
 * Where K' is the key padded/hashed to block size
 *
 * @param {Uint8Array} key - Secret key (any length)
 * @param {Uint8Array} data - Message to authenticate
 * @returns {Uint8Array} 32-byte HMAC digest
 * @throws {TypeError} If key or data is not a Uint8Array
 *
 * @example
 * const key = new Uint8Array([0x0b, 0x0b, ...]);
 * const data = new TextEncoder().encode('Hi There');
 * const mac = hmacSha256(key, data);
 */
function hmacSha256(key, data) {
  if (!(key instanceof Uint8Array)) {
    throw new TypeError('Key must be a Uint8Array');
  }
  if (!(data instanceof Uint8Array)) {
    throw new TypeError('Data must be a Uint8Array');
  }

  // Step 1: Prepare the key
  // If key is longer than block size, hash it first
  // If shorter, it will be padded with zeros
  let keyPrime;
  if (key.length > BLOCK_SIZE) {
    keyPrime = hash(key);
  } else {
    keyPrime = key;
  }

  // Step 2: Create padded key blocks
  const keyPadded = new Uint8Array(BLOCK_SIZE);
  keyPadded.set(keyPrime);
  // Remaining bytes are already 0 from Uint8Array initialization

  // Step 3: Create inner and outer padded keys
  const innerKey = new Uint8Array(BLOCK_SIZE);
  const outerKey = new Uint8Array(BLOCK_SIZE);

  for (let i = 0; i < BLOCK_SIZE; i++) {
    innerKey[i] = keyPadded[i] ^ IPAD;
    outerKey[i] = keyPadded[i] ^ OPAD;
  }

  // Step 4: Compute inner hash: H((K' XOR ipad) || message)
  const innerData = new Uint8Array(BLOCK_SIZE + data.length);
  innerData.set(innerKey);
  innerData.set(data, BLOCK_SIZE);
  const innerHash = hash(innerData);

  // Step 5: Compute outer hash: H((K' XOR opad) || innerHash)
  const outerData = new Uint8Array(BLOCK_SIZE + 32);
  outerData.set(outerKey);
  outerData.set(innerHash, BLOCK_SIZE);

  return hash(outerData);
}

/**
 * Verify an HMAC-SHA256 digest
 * Uses constant-time comparison to prevent timing attacks
 *
 * @param {Uint8Array} key - Secret key
 * @param {Uint8Array} data - Message that was authenticated
 * @param {Uint8Array} expectedMac - Expected HMAC digest to verify against
 * @returns {boolean} True if MAC is valid, false otherwise
 *
 * @example
 * const isValid = verifyHmac(key, data, receivedMac);
 * if (!isValid) {
 *   throw new Error('Message authentication failed');
 * }
 */
function verifyHmac(key, data, expectedMac) {
  if (!(expectedMac instanceof Uint8Array) || expectedMac.length !== 32) {
    return false;
  }

  const computedMac = hmacSha256(key, data);
  return constantTimeEqual(computedMac, expectedMac);
}

/**
 * Constant-time comparison of two byte arrays
 * Prevents timing attacks by always comparing all bytes
 *
 * @param {Uint8Array} a - First array
 * @param {Uint8Array} b - Second array
 * @returns {boolean} True if arrays are equal
 * @private
 */
function constantTimeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}

module.exports = {
  hmacSha256,
  verifyHmac,
  BLOCK_SIZE
};
