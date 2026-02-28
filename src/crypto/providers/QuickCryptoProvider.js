'use strict';

/**
 * @fileoverview react-native-quick-crypto based provider
 * @module crypto/providers/QuickCryptoProvider
 *
 * Uses native crypto via react-native-quick-crypto for maximum performance.
 * Install: npm install react-native-quick-crypto
 */

const CryptoProvider = require('../CryptoProvider');

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
    this._crypto = options.crypto || null;
  }

  get name() {
    return 'quick-crypto';
  }

  _getCrypto() {
    if (!this._crypto) {
      try {
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
  sharedSecret(secretKey, publicKey) {
    const crypto = this._getCrypto();
    const privKey = crypto.createPrivateKey({
      key: Buffer.concat([
        Buffer.from('302e020100300506032b656e04220420', 'hex'),
        Buffer.from(secretKey)
      ]),
      format: 'der',
      type: 'pkcs8'
    });
    const pubKey = crypto.createPublicKey({
      key: Buffer.concat([
        Buffer.from('302a300506032b656e032100', 'hex'),
        Buffer.from(publicKey)
      ]),
      format: 'der',
      type: 'spki'
    });
    const shared = crypto.diffieHellman({ privateKey: privKey, publicKey: pubKey });
    return new Uint8Array(shared);
  }

  /** @inheritdoc */
  encrypt(key, nonce, plaintext, _ad) {
    // Use tweetnacl for encryption to ensure cross-provider compatibility
    // QuickCrypto's advantage is in fast native key generation (X25519), not AEAD
    const nacl = require('tweetnacl');

    // Ensure 24-byte nonce for XSalsa20-Poly1305
    let fullNonce = nonce;
    if (nonce.length < 24) {
      fullNonce = new Uint8Array(24);
      fullNonce.set(nonce);
    }

    return nacl.secretbox(plaintext, fullNonce, key);
  }

  /** @inheritdoc */
  decrypt(key, nonce, ciphertext, _ad) {
    const nacl = require('tweetnacl');

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
  hash(data) {
    // Use SHA-512 truncated to 32 bytes for cross-provider compatibility
    const nacl = require('tweetnacl');
    const full = nacl.hash(data); // SHA-512
    return full.slice(0, 32);
  }

  /** @inheritdoc */
  randomBytes(length) {
    const crypto = this._getCrypto();
    return new Uint8Array(crypto.randomBytes(length));
  }

  static isAvailable() {
    try {
      require('react-native-quick-crypto');
      return true;
    } catch (e) {
      return false;
    }
  }
}

module.exports = QuickCryptoProvider;
