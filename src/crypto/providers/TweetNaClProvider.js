'use strict';

/**
 * @fileoverview TweetNaCl-based crypto provider
 * @module crypto/providers/TweetNaClProvider
 *
 * Uses the `tweetnacl` library — lightweight, audited, works everywhere.
 * Install: npm install tweetnacl
 */

const CryptoProvider = require('../CryptoProvider');

/**
 * Crypto provider using tweetnacl.
 * Provides X25519 key exchange, XSalsa20-Poly1305 AEAD, SHA-512 (for hashing).
 *
 * @class TweetNaClProvider
 * @extends CryptoProvider
 */
class TweetNaClProvider extends CryptoProvider {
  /**
   * @param {Object} [options={}]
   * @param {Object} [options.nacl] - Injected tweetnacl instance (for testing)
   */
  constructor(options = {}) {
    super();
    this._nacl = options.nacl || null;
  }

  get name() {
    return 'tweetnacl';
  }

  /**
   * Lazily loads tweetnacl
   * @returns {Object} nacl module
   * @private
   */
  _getNacl() {
    if (!this._nacl) {
      try {
        this._nacl = require('tweetnacl');
      } catch (e) {
        throw new Error(
          'tweetnacl is required for TweetNaClProvider. Install: npm install tweetnacl'
        );
      }
    }
    return this._nacl;
  }

  /** @inheritdoc */
  generateKeyPair() {
    const nacl = this._getNacl();
    const kp = nacl.box.keyPair();
    return { publicKey: kp.publicKey, secretKey: kp.secretKey };
  }

  /** @inheritdoc */
  sharedSecret(secretKey, publicKey) {
    const nacl = this._getNacl();
    return nacl.box.before(publicKey, secretKey);
  }

  /** @inheritdoc */
  encrypt(key, nonce, plaintext, _ad) {
    const nacl = this._getNacl();
    // tweetnacl uses XSalsa20-Poly1305 with 24-byte nonce
    // nacl.secretbox includes authentication
    return nacl.secretbox(plaintext, nonce, key);
  }

  /** @inheritdoc */
  decrypt(key, nonce, ciphertext, _ad) {
    const nacl = this._getNacl();
    const result = nacl.secretbox.open(ciphertext, nonce, key);
    return result || null; // returns null on auth failure
  }

  /** @inheritdoc */
  hash(data) {
    const nacl = this._getNacl();
    // tweetnacl provides SHA-512; we return first 32 bytes for SHA-256 compatibility
    const full = nacl.hash(data);
    return full.slice(0, 32);
  }

  /** @inheritdoc */
  randomBytes(length) {
    const nacl = this._getNacl();
    return nacl.randomBytes(length);
  }

  /**
   * Checks if tweetnacl is available
   * @returns {boolean}
   */
  static isAvailable() {
    try {
      require('tweetnacl');
      return true;
    } catch (e) {
      return false;
    }
  }
}

module.exports = TweetNaClProvider;
