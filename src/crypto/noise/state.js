'use strict';

/**
 * Noise Protocol Symmetric State
 * Implements the symmetric cryptographic state for Noise Protocol handshakes.
 * @module crypto/noise/state
 */

const { hash } = require('../sha256');
const { expand } = require('../hkdf');
const { encrypt, decrypt } = require('../aead');
const { concat } = require('../../utils/bytes');

/**
 * Protocol name for Noise_XX_25519_ChaChaPoly_SHA256
 * @constant {string}
 */
const PROTOCOL_NAME = 'Noise_XX_25519_ChaChaPoly_SHA256';

/**
 * Maximum nonce value before overflow (2^64 - 1 represented as safe integer)
 * @constant {number}
 */
const MAX_NONCE = Number.MAX_SAFE_INTEGER;

/**
 * SymmetricState manages the cryptographic state during a Noise handshake.
 *
 * Properties:
 * - h: Handshake hash (32 bytes) - rolling hash of all handshake data
 * - ck: Chaining key (32 bytes) - for key derivation
 * - k: Cipher key (32 bytes or null) - for encrypting handshake payloads
 * - n: Nonce counter - increments with each encryption
 *
 * @class
 */
class SymmetricState {
  /**
   * Creates a new SymmetricState.
   * @param {string} [protocolName=PROTOCOL_NAME] - The Noise protocol name
   */
  constructor(protocolName = PROTOCOL_NAME) {
    const nameBytes = new TextEncoder().encode(protocolName);

    // If protocol name is <= 32 bytes, pad with zeros
    // If > 32 bytes, hash it
    if (nameBytes.length <= 32) {
      this._h = new Uint8Array(32);
      this._h.set(nameBytes);
    } else {
      this._h = hash(nameBytes);
    }

    // Initialize chaining key to handshake hash
    this._ck = new Uint8Array(this._h);

    // Cipher key starts as null (no encryption until first MixKey)
    this._k = null;

    // Nonce counter
    this._n = 0;
  }

  /**
   * Gets the current handshake hash.
   * @returns {Uint8Array} Copy of the handshake hash
   */
  get h() {
    return new Uint8Array(this._h);
  }

  /**
   * Gets the current chaining key.
   * @returns {Uint8Array} Copy of the chaining key
   */
  get ck() {
    return new Uint8Array(this._ck);
  }

  /**
   * Gets the current cipher key.
   * @returns {Uint8Array|null} Copy of cipher key or null
   */
  get k() {
    return this._k ? new Uint8Array(this._k) : null;
  }

  /**
   * Gets the current nonce.
   * @returns {number} Current nonce value
   */
  get n() {
    return this._n;
  }

  /**
   * MixHash: Updates handshake hash with new data.
   * h = SHA256(h || data)
   *
   * @param {Uint8Array} data - Data to mix into the hash
   */
  mixHash(data) {
    this._h = hash(concat(this._h, data));
  }

  /**
   * MixKey: Derives new chaining key and cipher key from input key material.
   * Uses HKDF with current chaining key as salt.
   *
   * (ck, k) = HKDF(ck, inputKeyMaterial)
   * Resets nonce to 0.
   *
   * @param {Uint8Array} inputKeyMaterial - Key material to mix in (e.g., DH result)
   */
  mixKey(inputKeyMaterial) {
    // HKDF with ck as salt, ikm as input, empty info, 64 bytes output
    const output = expand(
      hash(concat(this._ck, inputKeyMaterial)), // PRK = HMAC(ck, ikm)
      new Uint8Array(0), // empty info
      64
    );

    // Actually use proper HKDF: extract then expand
    const tempKey = hash(concat(this._ck, inputKeyMaterial));
    const derived = this._hkdfDeriveKeys(tempKey);

    this._ck = derived.ck;
    this._k = derived.k;
    this._n = 0;
  }

  /**
   * Internal HKDF key derivation for MixKey.
   * @param {Uint8Array} tempKey - Temporary key from HKDF-Extract
   * @returns {{ck: Uint8Array, k: Uint8Array}} Derived keys
   * @private
   */
  _hkdfDeriveKeys(tempKey) {
    // T1 = HMAC(tempKey, 0x01)
    const t1Input = new Uint8Array(1);
    t1Input[0] = 0x01;
    const { hmacSha256 } = require('../hmac');
    const ck = hmacSha256(tempKey, t1Input);

    // T2 = HMAC(tempKey, T1 || 0x02)
    const t2Input = new Uint8Array(33);
    t2Input.set(ck);
    t2Input[32] = 0x02;
    const k = hmacSha256(tempKey, t2Input);

    return { ck, k };
  }

  /**
   * EncryptAndHash: Encrypts plaintext and mixes ciphertext into hash.
   * If no cipher key is set, returns plaintext unchanged.
   *
   * @param {Uint8Array} plaintext - Data to encrypt
   * @returns {Uint8Array} Ciphertext (or plaintext if k is null)
   * @throws {Error} If nonce overflows
   */
  encryptAndHash(plaintext) {
    if (this._k === null) {
      // No key yet, just mix plaintext into hash
      this.mixHash(plaintext);
      return plaintext;
    }

    if (this._n >= MAX_NONCE) {
      throw new Error('Nonce overflow');
    }

    // Create 12-byte nonce: 4 zero bytes + 8-byte little-endian counter
    const nonce = this._createNonce(this._n);
    this._n++;

    // Encrypt with h as AAD
    const ciphertext = encrypt(this._k, nonce, plaintext, this._h);

    // Mix ciphertext into hash
    this.mixHash(ciphertext);

    return ciphertext;
  }

  /**
   * DecryptAndHash: Decrypts ciphertext and mixes it into hash.
   * If no cipher key is set, returns ciphertext unchanged.
   *
   * @param {Uint8Array} ciphertext - Data to decrypt
   * @returns {Uint8Array} Plaintext (or ciphertext if k is null)
   * @throws {Error} If decryption fails or nonce overflows
   */
  decryptAndHash(ciphertext) {
    if (this._k === null) {
      // No key yet, just mix ciphertext into hash
      this.mixHash(ciphertext);
      return ciphertext;
    }

    if (this._n >= MAX_NONCE) {
      throw new Error('Nonce overflow');
    }

    // Create 12-byte nonce
    const nonce = this._createNonce(this._n);
    this._n++;

    // Decrypt with h as AAD
    const plaintext = decrypt(this._k, nonce, ciphertext, this._h);

    if (plaintext === null) {
      throw new Error('Decryption failed: authentication error');
    }

    // Mix ciphertext into hash (not plaintext!)
    this.mixHash(ciphertext);

    return plaintext;
  }

  /**
   * Split: Derives final transport keys from the handshake state.
   * Returns two keys for bidirectional communication.
   *
   * @returns {{sendKey: Uint8Array, receiveKey: Uint8Array}} Transport keys
   */
  split() {
    const tempKey = hash(concat(this._ck, new Uint8Array(0)));
    const { hmacSha256 } = require('../hmac');

    // k1 = HKDF-Expand(ck, 0x01)
    const t1Input = new Uint8Array(1);
    t1Input[0] = 0x01;
    const k1 = hmacSha256(tempKey, t1Input);

    // k2 = HKDF-Expand(ck, k1 || 0x02)
    const t2Input = new Uint8Array(33);
    t2Input.set(k1);
    t2Input[32] = 0x02;
    const k2 = hmacSha256(tempKey, t2Input);

    return { sendKey: k1, receiveKey: k2 };
  }

  /**
   * Gets a copy of the current handshake hash.
   * @returns {Uint8Array} Copy of handshake hash
   */
  getHandshakeHash() {
    return new Uint8Array(this._h);
  }

  /**
   * Creates a 12-byte nonce from a counter value.
   * Format: 4 zero bytes + 8-byte little-endian counter
   *
   * @param {number} counter - Nonce counter value
   * @returns {Uint8Array} 12-byte nonce
   * @private
   */
  _createNonce(counter) {
    const nonce = new Uint8Array(12);
    const view = new DataView(nonce.buffer);
    // First 4 bytes are zero
    // Next 8 bytes are little-endian counter
    view.setUint32(4, counter >>> 0, true);
    view.setUint32(8, Math.floor(counter / 0x100000000) >>> 0, true);
    return nonce;
  }
}

module.exports = {
  SymmetricState,
  PROTOCOL_NAME
};
