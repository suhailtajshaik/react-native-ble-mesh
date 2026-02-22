'use strict';

/**
 * @fileoverview Abstract CryptoProvider interface
 * @module crypto/CryptoProvider
 * 
 * Pluggable crypto backend. Consumers choose their provider:
 * - TweetNaClProvider (tweetnacl) — works everywhere
 * - QuickCryptoProvider (react-native-quick-crypto) — native speed
 * - ExpoCryptoProvider (expo-crypto) — for Expo projects
 */

/**
 * Abstract crypto provider interface.
 * All crypto operations go through this interface, allowing
 * consumers to swap implementations without changing application code.
 * 
 * @abstract
 * @class CryptoProvider
 */
class CryptoProvider {
  /**
   * Provider name for identification
   * @returns {string}
   */
  get name() {
    return 'abstract';
  }

  /**
   * Generates a new X25519 key pair
   * @returns {{ publicKey: Uint8Array, secretKey: Uint8Array }}
   */
  generateKeyPair() {
    throw new Error('CryptoProvider.generateKeyPair() must be implemented');
  }

  /**
   * Computes X25519 shared secret
   * @param {Uint8Array} secretKey - Our secret key (32 bytes)
   * @param {Uint8Array} publicKey - Their public key (32 bytes)
   * @returns {Uint8Array} Shared secret (32 bytes)
   */
  sharedSecret(secretKey, publicKey) {
    throw new Error('CryptoProvider.sharedSecret() must be implemented');
  }

  /**
   * AEAD encrypt (XSalsa20-Poly1305 or ChaCha20-Poly1305)
   * @param {Uint8Array} key - Encryption key (32 bytes)
   * @param {Uint8Array} nonce - Nonce (24 bytes for XSalsa20, 12 for ChaCha20)
   * @param {Uint8Array} plaintext - Data to encrypt
   * @param {Uint8Array} [ad] - Additional authenticated data (optional)
   * @returns {Uint8Array} Ciphertext with authentication tag
   */
  encrypt(key, nonce, plaintext, ad) {
    throw new Error('CryptoProvider.encrypt() must be implemented');
  }

  /**
   * AEAD decrypt
   * @param {Uint8Array} key - Encryption key (32 bytes)
   * @param {Uint8Array} nonce - Nonce
   * @param {Uint8Array} ciphertext - Ciphertext with auth tag
   * @param {Uint8Array} [ad] - Additional authenticated data (optional)
   * @returns {Uint8Array|null} Plaintext or null if authentication fails
   */
  decrypt(key, nonce, ciphertext, ad) {
    throw new Error('CryptoProvider.decrypt() must be implemented');
  }

  /**
   * Computes SHA-256 hash
   * @param {Uint8Array} data - Data to hash
   * @returns {Uint8Array} Hash (32 bytes)
   */
  hash(data) {
    throw new Error('CryptoProvider.hash() must be implemented');
  }

  /**
   * Generates cryptographically secure random bytes
   * @param {number} length - Number of bytes
   * @returns {Uint8Array} Random bytes
   */
  randomBytes(length) {
    throw new Error('CryptoProvider.randomBytes() must be implemented');
  }

  /**
   * Checks if this provider is available in the current environment
   * @returns {boolean}
   */
  static isAvailable() {
    return false;
  }
}

module.exports = CryptoProvider;
