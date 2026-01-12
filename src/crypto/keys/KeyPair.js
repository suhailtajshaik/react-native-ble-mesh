'use strict';

/**
 * KeyPair class for X25519 key management.
 * Provides a secure wrapper around public/private key pairs.
 * @module crypto/keys/KeyPair
 */

const { generateKeyPair: x25519GenerateKeyPair, scalarMultBase } = require('../x25519');

/**
 * Key size in bytes (X25519)
 * @constant {number}
 */
const KEY_SIZE = 32;

/**
 * KeyPair represents an X25519 key pair for Noise Protocol handshakes.
 * Provides secure key management with proper cleanup.
 *
 * @class
 */
class KeyPair {
  /**
   * Creates a KeyPair instance.
   * Use static factory methods instead of constructor directly.
   * @param {Uint8Array} publicKey - 32-byte public key
   * @param {Uint8Array} secretKey - 32-byte secret key
   * @private
   */
  constructor(publicKey, secretKey) {
    if (!(publicKey instanceof Uint8Array) || publicKey.length !== KEY_SIZE) {
      throw new Error(`Public key must be ${KEY_SIZE} bytes`);
    }
    if (!(secretKey instanceof Uint8Array) || secretKey.length !== KEY_SIZE) {
      throw new Error(`Secret key must be ${KEY_SIZE} bytes`);
    }

    /** @type {Uint8Array} */
    this._publicKey = new Uint8Array(publicKey);

    /** @type {Uint8Array} */
    this._secretKey = new Uint8Array(secretKey);

    /** @type {boolean} */
    this._destroyed = false;
  }

  /**
   * Gets the public key.
   * @returns {Uint8Array} Copy of the public key
   * @throws {Error} If key pair has been destroyed
   */
  get publicKey() {
    this._checkDestroyed();
    return new Uint8Array(this._publicKey);
  }

  /**
   * Gets the secret key.
   * @returns {Uint8Array} Copy of the secret key
   * @throws {Error} If key pair has been destroyed
   */
  get secretKey() {
    this._checkDestroyed();
    return new Uint8Array(this._secretKey);
  }

  /**
   * Generates a new random X25519 key pair.
   * @returns {KeyPair} New key pair
   *
   * @example
   * const keyPair = KeyPair.generate();
   * console.log('Public key:', keyPair.publicKey);
   */
  static generate() {
    const { publicKey, secretKey } = x25519GenerateKeyPair();
    return new KeyPair(publicKey, secretKey);
  }

  /**
   * Creates a KeyPair from an existing secret key.
   * Derives the public key from the secret key.
   * @param {Uint8Array} secretKey - 32-byte secret key
   * @returns {KeyPair} Key pair with derived public key
   * @throws {Error} If secret key is invalid
   *
   * @example
   * const restored = KeyPair.fromSecretKey(storedSecretKey);
   */
  static fromSecretKey(secretKey) {
    if (!(secretKey instanceof Uint8Array) || secretKey.length !== KEY_SIZE) {
      throw new Error(`Secret key must be ${KEY_SIZE} bytes`);
    }

    const publicKey = scalarMultBase(secretKey);
    return new KeyPair(publicKey, secretKey);
  }

  /**
   * Creates a KeyPair from exported key material.
   * @param {object} exported - Exported key object
   * @param {number[]} exported.publicKey - Public key as byte array
   * @param {number[]} exported.secretKey - Secret key as byte array
   * @returns {KeyPair} Restored key pair
   * @throws {Error} If exported data is invalid
   */
  static fromExported(exported) {
    if (!exported || typeof exported !== 'object') {
      throw new Error('Invalid exported key data');
    }
    if (!Array.isArray(exported.publicKey) || !Array.isArray(exported.secretKey)) {
      throw new Error('Exported data must contain publicKey and secretKey arrays');
    }

    const publicKey = new Uint8Array(exported.publicKey);
    const secretKey = new Uint8Array(exported.secretKey);

    return new KeyPair(publicKey, secretKey);
  }

  /**
   * Exports the key pair for storage.
   * WARNING: The exported data contains sensitive key material.
   * @returns {object} Exportable key object
   */
  export() {
    this._checkDestroyed();
    return {
      publicKey: Array.from(this._publicKey),
      secretKey: Array.from(this._secretKey)
    };
  }

  /**
   * Exports only the public key (safe to share).
   * @returns {object} Object containing only the public key
   */
  exportPublic() {
    this._checkDestroyed();
    return {
      publicKey: Array.from(this._publicKey)
    };
  }

  /**
   * Checks if this key pair matches another by public key.
   * @param {KeyPair} other - Another key pair to compare
   * @returns {boolean} True if public keys match
   */
  matches(other) {
    this._checkDestroyed();
    if (!(other instanceof KeyPair)) {
      return false;
    }

    const otherPublic = other.publicKey;
    if (otherPublic.length !== this._publicKey.length) {
      return false;
    }

    // Constant-time comparison
    let diff = 0;
    for (let i = 0; i < this._publicKey.length; i++) {
      diff |= this._publicKey[i] ^ otherPublic[i];
    }
    return diff === 0;
  }

  /**
   * Gets the public key as a hex string (useful for display/logging).
   * @returns {string} Hex-encoded public key
   */
  getPublicKeyHex() {
    this._checkDestroyed();
    return Array.from(this._publicKey)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Securely destroys the key pair, zeroing sensitive material.
   * After destruction, the key pair cannot be used.
   */
  destroy() {
    if (!this._destroyed) {
      this._secretKey.fill(0);
      this._publicKey.fill(0);
      this._destroyed = true;
    }
  }

  /**
   * Checks if the key pair has been destroyed.
   * @returns {boolean} True if destroyed
   */
  isDestroyed() {
    return this._destroyed;
  }

  /**
   * Throws if the key pair has been destroyed.
   * @private
   */
  _checkDestroyed() {
    if (this._destroyed) {
      throw new Error('Key pair has been destroyed');
    }
  }
}

module.exports = {
  KeyPair,
  KEY_SIZE
};
