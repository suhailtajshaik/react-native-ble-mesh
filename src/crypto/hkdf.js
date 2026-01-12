'use strict';

/**
 * HKDF Key Derivation Function (RFC 5869)
 * Pure JavaScript implementation using HMAC-SHA256
 * @module crypto/hkdf
 */

const { hmacSha256 } = require('./hmac');

/**
 * Hash output length in bytes (SHA-256 = 32 bytes)
 * @constant {number}
 */
const HASH_LENGTH = 32;

/**
 * Maximum output length (255 * hash length)
 * @constant {number}
 */
const MAX_OUTPUT_LENGTH = 255 * HASH_LENGTH;

/**
 * Default salt (32 zero bytes for SHA-256)
 * @constant {Uint8Array}
 */
const DEFAULT_SALT = new Uint8Array(HASH_LENGTH);

/**
 * HKDF-Extract: Extract a pseudorandom key from input keying material
 *
 * PRK = HMAC-Hash(salt, IKM)
 *
 * @param {Uint8Array|null} salt - Optional salt value (non-secret random value)
 *                                  If null/undefined/empty, uses zeros
 * @param {Uint8Array} ikm - Input keying material
 * @returns {Uint8Array} Pseudorandom key (32 bytes)
 * @throws {TypeError} If ikm is not a Uint8Array
 *
 * @example
 * const ikm = new Uint8Array([...sharedSecret]);
 * const salt = crypto.getRandomValues(new Uint8Array(32));
 * const prk = extract(salt, ikm);
 */
function extract(salt, ikm) {
  if (!(ikm instanceof Uint8Array)) {
    throw new TypeError('IKM must be a Uint8Array');
  }

  // Use default salt if not provided or empty
  const actualSalt = (salt && salt.length > 0) ? salt : DEFAULT_SALT;

  return hmacSha256(actualSalt, ikm);
}

/**
 * HKDF-Expand: Expand a pseudorandom key to desired length
 *
 * T(0) = empty string
 * T(1) = HMAC-Hash(PRK, T(0) | info | 0x01)
 * T(2) = HMAC-Hash(PRK, T(1) | info | 0x02)
 * ...
 * OKM = first L bytes of T(1) | T(2) | ...
 *
 * @param {Uint8Array} prk - Pseudorandom key (from extract)
 * @param {Uint8Array} info - Context and application specific info
 * @param {number} length - Desired output length in bytes (max 8160)
 * @returns {Uint8Array} Output keying material of specified length
 * @throws {TypeError} If prk or info is not a Uint8Array
 * @throws {RangeError} If length exceeds maximum (255 * 32 = 8160 bytes)
 *
 * @example
 * const prk = extract(salt, ikm);
 * const info = new TextEncoder().encode('encryption-key');
 * const key = expand(prk, info, 32);
 */
function expand(prk, info, length) {
  if (!(prk instanceof Uint8Array)) {
    throw new TypeError('PRK must be a Uint8Array');
  }
  if (!(info instanceof Uint8Array)) {
    throw new TypeError('Info must be a Uint8Array');
  }
  if (!Number.isInteger(length) || length < 0) {
    throw new TypeError('Length must be a non-negative integer');
  }
  if (length > MAX_OUTPUT_LENGTH) {
    throw new RangeError(`Length must not exceed ${MAX_OUTPUT_LENGTH} bytes`);
  }
  if (length === 0) {
    return new Uint8Array(0);
  }

  // Calculate number of iterations needed
  const n = Math.ceil(length / HASH_LENGTH);
  const okm = new Uint8Array(n * HASH_LENGTH);

  // T(0) = empty, T(i) = HMAC(PRK, T(i-1) | info | i)
  let previous = new Uint8Array(0);

  for (let i = 1; i <= n; i++) {
    // Construct input: T(i-1) | info | counter
    const inputLength = previous.length + info.length + 1;
    const input = new Uint8Array(inputLength);

    let offset = 0;
    if (previous.length > 0) {
      input.set(previous, offset);
      offset += previous.length;
    }
    input.set(info, offset);
    offset += info.length;
    input[offset] = i; // Counter byte (1-indexed)

    // T(i) = HMAC-Hash(PRK, input)
    previous = hmacSha256(prk, input);

    // Copy to output
    okm.set(previous, (i - 1) * HASH_LENGTH);
  }

  // Return only the requested number of bytes
  return okm.subarray(0, length);
}

/**
 * HKDF: Combined extract-then-expand operation
 *
 * Convenience function that performs both HKDF-Extract and HKDF-Expand
 *
 * @param {Uint8Array} ikm - Input keying material
 * @param {Uint8Array|null} salt - Optional salt (uses zeros if null/empty)
 * @param {Uint8Array} info - Context and application specific info
 * @param {number} length - Desired output length in bytes
 * @returns {Uint8Array} Derived key material of specified length
 * @throws {TypeError} If ikm or info is not a Uint8Array
 * @throws {RangeError} If length exceeds maximum
 *
 * @example
 * const sharedSecret = performDH(myPrivate, theirPublic);
 * const info = new TextEncoder().encode('noise-handshake-v1');
 * const key = derive(sharedSecret, null, info, 32);
 */
function derive(ikm, salt, info, length) {
  const prk = extract(salt, ikm);
  return expand(prk, info, length);
}

/**
 * Derive multiple keys in one operation
 * Useful for deriving encryption and MAC keys together
 *
 * @param {Uint8Array} ikm - Input keying material
 * @param {Uint8Array|null} salt - Optional salt
 * @param {Uint8Array} info - Context info
 * @param {number[]} lengths - Array of key lengths to derive
 * @returns {Uint8Array[]} Array of derived keys
 *
 * @example
 * const [encKey, macKey] = deriveMultiple(secret, salt, info, [32, 32]);
 */
function deriveMultiple(ikm, salt, info, lengths) {
  if (!Array.isArray(lengths) || lengths.length === 0) {
    throw new TypeError('Lengths must be a non-empty array');
  }

  const totalLength = lengths.reduce((sum, len) => sum + len, 0);
  const combined = derive(ikm, salt, info, totalLength);

  const keys = [];
  let offset = 0;
  for (const len of lengths) {
    keys.push(combined.slice(offset, offset + len));
    offset += len;
  }

  return keys;
}

module.exports = {
  extract,
  expand,
  derive,
  deriveMultiple,
  HASH_LENGTH,
  MAX_OUTPUT_LENGTH
};
