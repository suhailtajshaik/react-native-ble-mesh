'use strict';

/**
 * @fileoverview react-native-quick-crypto based provider
 * @module crypto/providers/QuickCryptoProvider
 *
 * Uses native crypto via react-native-quick-crypto for maximum performance.
 * Install: npm install react-native-quick-crypto
 */

const CryptoProvider = require('../CryptoProvider');

/** DER header for PKCS8 private key wrapping (X25519) */
const PKCS8_HEADER = Buffer.from('302e020100300506032b656e04220420', 'hex');
/** DER header for SPKI public key wrapping (X25519) */
const SPKI_HEADER = Buffer.from('302a300506032b656e032100', 'hex');

/**
 * Crypto provider using react-native-quick-crypto.
 * Provides native-speed crypto on React Native (JSI binding).
 *
 * @class QuickCryptoProvider
 * @extends CryptoProvider
 */
class QuickCryptoProvider extends CryptoProvider {
  constructor(options = {}) {
    super();
    /** @type {any} */
    const opts = options;
    this._crypto = opts.crypto || null;
    this._nacl = null;
  }

  get name() {
    return 'quick-crypto';
  }

  _getCrypto() {
    if (!this._crypto) {
      try {
        // @ts-ignore
        this._crypto = require('react-native-quick-crypto');
      } catch (e) {
        throw new Error(
          'react-native-quick-crypto is required. Install: npm install react-native-quick-crypto'
        );
      }
    }
    return this._crypto;
  }

  /** @inheritdoc */
  generateKeyPair() {
    const crypto = this._getCrypto();
    const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
    return {
      publicKey: new Uint8Array(publicKey.export({ type: 'spki', format: 'der' }).slice(-32)),
      secretKey: new Uint8Array(privateKey.export({ type: 'pkcs8', format: 'der' }).slice(-32))
    };
  }

  /** @inheritdoc */
  sharedSecret(/** @type {any} */ secretKey, /** @type {any} */ publicKey) {
    const crypto = this._getCrypto();
    const privKey = crypto.createPrivateKey({
      key: Buffer.concat([
        PKCS8_HEADER,
        Buffer.from(secretKey)
      ]),
      format: 'der',
      type: 'pkcs8'
    });
    const pubKey = crypto.createPublicKey({
      key: Buffer.concat([
        SPKI_HEADER,
        Buffer.from(publicKey)
      ]),
      format: 'der',
      type: 'spki'
    });
    const shared = crypto.diffieHellman({ privateKey: privKey, publicKey: pubKey });
    return new Uint8Array(shared);
  }

  /**
   * Lazily loads tweetnacl (cached)
   * @returns {any} nacl module
   * @private
   */
  _getNacl() {
    if (!this._nacl) {
      try {
        // @ts-ignore
        this._nacl = require('tweetnacl');
      } catch (e) {
        throw new Error(
          'tweetnacl is required for QuickCryptoProvider encrypt/decrypt/hash. Install: npm install tweetnacl'
        );
      }
    }
    return this._nacl;
  }

  /** @inheritdoc */
  encrypt(/** @type {any} */ key, /** @type {any} */ nonce, /** @type {any} */ plaintext, /** @type {any} */ _ad) {
    // Use tweetnacl for encryption to ensure cross-provider compatibility
    // QuickCrypto's advantage is in fast native key generation (X25519), not AEAD
    const nacl = this._getNacl();

    // Ensure 24-byte nonce for XSalsa20-Poly1305
    let fullNonce = nonce;
    if (nonce.length < 24) {
      fullNonce = new Uint8Array(24);
      fullNonce.set(nonce);
    }

    return nacl.secretbox(plaintext, fullNonce, key);
  }

  /** @inheritdoc */
  decrypt(/** @type {any} */ key, /** @type {any} */ nonce, /** @type {any} */ ciphertext, /** @type {any} */ _ad) {
    const nacl = this._getNacl();

    // Ensure 24-byte nonce for XSalsa20-Poly1305
    let fullNonce = nonce;
    if (nonce.length < 24) {
      fullNonce = new Uint8Array(24);
      fullNonce.set(nonce);
    }

    const result = nacl.secretbox.open(ciphertext, fullNonce, key);
    if (!result) {
      return null; // Decryption failed: authentication error
    }
    return result;
  }

  /** @inheritdoc */
  hash(/** @type {any} */ data) {
    // Use SHA-512 truncated to 32 bytes for cross-provider compatibility
    const nacl = this._getNacl();
    const full = nacl.hash(data); // SHA-512
    return full.subarray(0, 32);
  }

  /** @inheritdoc */
  randomBytes(/** @type {any} */ length) {
    const crypto = this._getCrypto();
    return new Uint8Array(crypto.randomBytes(length));
  }

  static isAvailable() {
    try {
      // @ts-ignore
      require('react-native-quick-crypto');
      return true;
    } catch (e) {
      return false;
    }
  }
}

module.exports = QuickCryptoProvider;
