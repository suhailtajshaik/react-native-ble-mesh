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
  encrypt(key, nonce, plaintext, ad) {
    const crypto = this._getCrypto();
    const cipher = crypto.createCipheriv('chacha20-poly1305', key, nonce, { authTagLength: 16 });
    if (ad && ad.length > 0) { cipher.setAAD(Buffer.from(ad)); }
    const encrypted = cipher.update(Buffer.from(plaintext));
    cipher.final();
    const tag = cipher.getAuthTag();
    const result = new Uint8Array(encrypted.length + tag.length);
    result.set(new Uint8Array(encrypted), 0);
    result.set(new Uint8Array(tag), encrypted.length);
    return result;
  }

  /** @inheritdoc */
  decrypt(key, nonce, ciphertext, ad) {
    const crypto = this._getCrypto();
    const tagStart = ciphertext.length - 16;
    const encrypted = ciphertext.slice(0, tagStart);
    const tag = ciphertext.slice(tagStart);

    try {
      const decipher = crypto.createDecipheriv('chacha20-poly1305', key, nonce, { authTagLength: 16 });
      decipher.setAuthTag(Buffer.from(tag));
      if (ad && ad.length > 0) { decipher.setAAD(Buffer.from(ad)); }
      const decrypted = decipher.update(Buffer.from(encrypted));
      decipher.final();
      return new Uint8Array(decrypted);
    } catch (e) {
      return null;
    }
  }

  /** @inheritdoc */
  hash(data) {
    const crypto = this._getCrypto();
    const h = crypto.createHash('sha256');
    h.update(Buffer.from(data));
    return new Uint8Array(h.digest());
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
