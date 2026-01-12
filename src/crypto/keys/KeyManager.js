'use strict';

/**
 * KeyManager for identity and key lifecycle management.
 * Handles persistent identity storage and retrieval.
 * @module crypto/keys/KeyManager
 */

const { KeyPair } = require('./KeyPair');

/**
 * Default storage key for identity
 * @constant {string}
 */
const DEFAULT_IDENTITY_KEY = 'mesh_identity';

/**
 * KeyManager handles identity key management for the mesh network.
 * Provides methods to generate, store, and retrieve identity keys.
 *
 * @class
 */
class KeyManager {
  /**
   * Creates a new KeyManager.
   * @param {object} [options={}] - Configuration options
   * @param {object} [options.storage] - Storage adapter (SecureStorage interface)
   * @param {string} [options.identityKey] - Storage key for identity
   */
  constructor(options = {}) {
    /** @type {object|null} */
    this._storage = options.storage || null;

    /** @type {string} */
    this._identityKey = options.identityKey || DEFAULT_IDENTITY_KEY;

    /** @type {KeyPair|null} */
    this._identity = null;

    /** @type {string|null} */
    this._displayName = null;
  }

  /**
   * Generates a new identity key pair.
   * Does not persist automatically - call saveIdentity() to persist.
   * @returns {KeyPair} New identity key pair
   */
  generateIdentity() {
    // Destroy existing identity if present
    if (this._identity) {
      this._identity.destroy();
    }

    this._identity = KeyPair.generate();
    return this._identity;
  }

  /**
   * Gets the current identity, generating one if needed.
   * If storage is configured, attempts to load from storage first.
   * @returns {Promise<KeyPair>} Current or new identity
   */
  async getOrCreateIdentity() {
    // Return existing identity if available
    if (this._identity && !this._identity.isDestroyed()) {
      return this._identity;
    }

    // Try to load from storage
    if (this._storage) {
      const loaded = await this.loadIdentity();
      if (loaded) {
        return loaded;
      }
    }

    // Generate new identity
    this.generateIdentity();

    // Persist if storage is available
    if (this._storage) {
      await this.saveIdentity();
    }

    return this._identity;
  }

  /**
   * Gets the current identity without generating.
   * @returns {KeyPair|null} Current identity or null
   */
  getIdentity() {
    if (this._identity && !this._identity.isDestroyed()) {
      return this._identity;
    }
    return null;
  }

  /**
   * Gets the public key of the current identity.
   * @returns {Uint8Array|null} Public key or null if no identity
   */
  getPublicKey() {
    const identity = this.getIdentity();
    return identity ? identity.publicKey : null;
  }

  /**
   * Saves the current identity to storage.
   * @returns {Promise<boolean>} True if saved successfully
   * @throws {Error} If no identity or storage not configured
   */
  async saveIdentity() {
    if (!this._identity) {
      throw new Error('No identity to save');
    }
    if (!this._storage) {
      throw new Error('Storage not configured');
    }

    const data = {
      keyPair: this._identity.export(),
      displayName: this._displayName,
      createdAt: Date.now()
    };

    await this._storage.set(this._identityKey, JSON.stringify(data));
    return true;
  }

  /**
   * Loads identity from storage.
   * @returns {Promise<KeyPair|null>} Loaded identity or null
   */
  async loadIdentity() {
    if (!this._storage) {
      return null;
    }

    try {
      const data = await this._storage.get(this._identityKey);
      if (!data) {
        return null;
      }

      const parsed = JSON.parse(data);
      if (!parsed.keyPair) {
        return null;
      }

      this._identity = KeyPair.fromExported(parsed.keyPair);
      this._displayName = parsed.displayName || null;

      return this._identity;
    } catch (error) {
      console.warn('Failed to load identity:', error.message);
      return null;
    }
  }

  /**
   * Imports an identity from exported data.
   * @param {object} exported - Exported identity data
   * @param {object} exported.publicKey - Public key as byte array
   * @param {object} exported.secretKey - Secret key as byte array
   * @returns {KeyPair} Imported identity
   */
  importIdentity(exported) {
    // Destroy existing identity
    if (this._identity) {
      this._identity.destroy();
    }

    this._identity = KeyPair.fromExported(exported);
    return this._identity;
  }

  /**
   * Exports the current identity for backup.
   * WARNING: Contains sensitive key material.
   * @returns {object|null} Exported identity or null
   */
  exportIdentity() {
    if (!this._identity || this._identity.isDestroyed()) {
      return null;
    }

    return {
      ...this._identity.export(),
      displayName: this._displayName
    };
  }

  /**
   * Sets the display name for this identity.
   * @param {string} name - Display name
   */
  setDisplayName(name) {
    if (typeof name !== 'string') {
      throw new Error('Display name must be a string');
    }
    this._displayName = name;
  }

  /**
   * Gets the display name.
   * @returns {string|null} Display name or null
   */
  getDisplayName() {
    return this._displayName;
  }

  /**
   * Deletes the identity from storage and memory.
   * @returns {Promise<void>}
   */
  async deleteIdentity() {
    if (this._identity) {
      this._identity.destroy();
      this._identity = null;
    }

    this._displayName = null;

    if (this._storage) {
      await this._storage.delete(this._identityKey);
    }
  }

  /**
   * Checks if an identity exists (in memory or storage).
   * @returns {Promise<boolean>} True if identity exists
   */
  async hasIdentity() {
    if (this._identity && !this._identity.isDestroyed()) {
      return true;
    }

    if (this._storage) {
      const data = await this._storage.get(this._identityKey);
      return data !== null && data !== undefined;
    }

    return false;
  }

  /**
   * Sets the storage adapter.
   * @param {object} storage - Storage adapter implementing SecureStorage interface
   */
  setStorage(storage) {
    this._storage = storage;
  }

  /**
   * Clears all in-memory data (does not affect storage).
   */
  clear() {
    if (this._identity) {
      this._identity.destroy();
      this._identity = null;
    }
    this._displayName = null;
  }
}

module.exports = {
  KeyManager,
  DEFAULT_IDENTITY_KEY
};
