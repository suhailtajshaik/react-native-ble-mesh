'use strict';

/**
 * @fileoverview Expo-crypto based provider
 * @module crypto/providers/ExpoCryptoProvider
 *
 * Uses expo-crypto for Expo managed workflow projects.
 * Note: expo-crypto provides hashing and random bytes but NOT key exchange or AEAD.
 * Falls back to tweetnacl for those operations.
 *
 * Install: npx expo install expo-crypto tweetnacl
 */

const CryptoProvider = require('../CryptoProvider');

/**
 * Crypto provider for Expo projects.
 * Uses expo-crypto for hashing/random, tweetnacl for key exchange and AEAD.
 *
 * @class ExpoCryptoProvider
 * @extends CryptoProvider
 */
class ExpoCryptoProvider extends CryptoProvider {
  constructor(options = {}) {
    super();
    this._expoCrypto = options.expoCrypto || null;
    this._nacl = options.nacl || null;
  }

  get name() {
    return 'expo-crypto';
  }

  _getExpoCrypto() {
    if (!this._expoCrypto) {
      try {
        this._expoCrypto = require('expo-crypto');
      } catch (e) {
        throw new Error('expo-crypto is required. Install: npx expo install expo-crypto');
      }
    }
    return this._expoCrypto;
  }

  _getNacl() {
    if (!this._nacl) {
      try {
        this._nacl = require('tweetnacl');
      } catch (e) {
        throw new Error('tweetnacl is required with ExpoCryptoProvider. Install: npm install tweetnacl');
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

    // Ensure 24-byte nonce (pad short nonces with zeros)
    let fullNonce = nonce;
    if (nonce.length < 24) {
      fullNonce = new Uint8Array(24);
      fullNonce.set(nonce);
    }

    return nacl.secretbox(plaintext, fullNonce, key);
  }

  /** @inheritdoc */
  decrypt(key, nonce, ciphertext, _ad) {
    const nacl = this._getNacl();

    // Ensure 24-byte nonce (pad short nonces with zeros)
    let fullNonce = nonce;
    if (nonce.length < 24) {
      fullNonce = new Uint8Array(24);
      fullNonce.set(nonce);
    }

    return nacl.secretbox.open(ciphertext, fullNonce, key) || null;
  }

  /** @inheritdoc */
  hash(data) {
    // expo-crypto's digestStringAsync is async — for sync compat, use tweetnacl
    const nacl = this._getNacl();
    return nacl.hash(data).subarray(0, 32);
  }

  /** @inheritdoc */
  randomBytes(length) {
    const expoCrypto = this._getExpoCrypto();
    if (expoCrypto.getRandomBytes) {
      const bytes = expoCrypto.getRandomBytes(length);
      return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    }
    // Fallback to tweetnacl
    const nacl = this._getNacl();
    return nacl.randomBytes(length);
  }

  static isAvailable() {
    try {
      require('expo-crypto');
      return true;
    } catch (e) {
      return false;
    }
  }
}

module.exports = ExpoCryptoProvider;
