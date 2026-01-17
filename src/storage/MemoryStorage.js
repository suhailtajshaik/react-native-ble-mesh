'use strict';

/**
 * @fileoverview In-memory storage implementation
 * @module storage/MemoryStorage
 */

const Storage = require('./Storage');

/**
 * In-memory storage implementation.
 * Stores data in a JavaScript Map. Data is not persisted across restarts.
 * Useful for testing and temporary storage.
 *
 * @class MemoryStorage
 * @extends Storage
 */
class MemoryStorage extends Storage {
  /**
   * Creates a new MemoryStorage instance
   * @param {Object} [options={}] - Storage options
   * @param {string} [options.prefix=''] - Key prefix for namespacing
   * @param {number} [options.maxSize=0] - Maximum number of items (0 = unlimited)
   */
  constructor(options = {}) {
    super(options);

    /**
     * Internal storage map
     * @type {Map<string, any>}
     * @private
     */
    this._store = new Map();

    /**
     * Maximum storage size (0 = unlimited)
     * @type {number}
     * @private
     */
    this._maxSize = options.maxSize || 0;
  }

  /**
   * Gets a value by key
   * @param {string} key - Key to retrieve
   * @returns {Promise<any>} Stored value or undefined
   */
  async get(key) {
    const prefixedKey = this._getKey(key);
    const item = this._store.get(prefixedKey);

    if (item === undefined) {
      return undefined;
    }

    // Check for expiration if item has TTL
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this._store.delete(prefixedKey);
      return undefined;
    }

    return item.value;
  }

  /**
   * Sets a value by key
   * @param {string} key - Key to set
   * @param {any} value - Value to store
   * @param {Object} [options={}] - Set options
   * @param {number} [options.ttl] - Time to live in milliseconds
   * @returns {Promise<void>}
   */
  async set(key, value, options = {}) {
    const prefixedKey = this._getKey(key);

    // Check size limit
    if (this._maxSize > 0 &&
        !this._store.has(prefixedKey) &&
        this._store.size >= this._maxSize) {
      // Remove oldest entry (first entry in Map)
      const firstKey = this._store.keys().next().value;
      this._store.delete(firstKey);
    }

    const item = {
      value,
      createdAt: Date.now()
    };

    if (options.ttl && options.ttl > 0) {
      item.expiresAt = Date.now() + options.ttl;
    }

    this._store.set(prefixedKey, item);
  }

  /**
   * Deletes a value by key
   * @param {string} key - Key to delete
   * @returns {Promise<void>}
   */
  async delete(key) {
    const prefixedKey = this._getKey(key);
    this._store.delete(prefixedKey);
  }

  /**
   * Checks if a key exists
   * @param {string} key - Key to check
   * @returns {Promise<boolean>} True if key exists
   */
  async has(key) {
    const prefixedKey = this._getKey(key);
    const item = this._store.get(prefixedKey);

    if (item === undefined) {
      return false;
    }

    // Check for expiration
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this._store.delete(prefixedKey);
      return false;
    }

    return true;
  }

  /**
   * Clears all stored data
   * @returns {Promise<void>}
   */
  async clear() {
    if (this._options.prefix) {
      // Only clear keys with our prefix
      for (const key of this._store.keys()) {
        if (key.startsWith(`${this._options.prefix}:`)) {
          this._store.delete(key);
        }
      }
    } else {
      this._store.clear();
    }
  }

  /**
   * Gets all keys (without prefix)
   * @returns {Promise<string[]>} Array of keys
   */
  async keys() {
    const result = [];
    const prefix = this._options.prefix ? `${this._options.prefix}:` : '';

    for (const key of this._store.keys()) {
      if (!prefix || key.startsWith(prefix)) {
        const unprefixedKey = prefix ? key.slice(prefix.length) : key;
        // Check expiration before including
        const item = this._store.get(key);
        if (!item.expiresAt || Date.now() <= item.expiresAt) {
          result.push(unprefixedKey);
        }
      }
    }

    return result;
  }

  /**
   * Gets the current size of the storage
   * @returns {Promise<number>} Number of stored items
   */
  async size() {
    // Clean up expired items first
    await this._cleanupExpired();
    return (await this.keys()).length;
  }

  /**
   * Cleans up expired items
   * @returns {Promise<number>} Number of items removed
   * @private
   */
  async _cleanupExpired() {
    const now = Date.now();
    let removed = 0;

    for (const [key, item] of this._store.entries()) {
      if (item.expiresAt && now > item.expiresAt) {
        this._store.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Gets all entries as an array of [key, value] pairs
   * @returns {Promise<Array<[string, any]>>} Array of entries
   */
  async entries() {
    const allKeys = await this.keys();
    const result = [];

    for (const key of allKeys) {
      const value = await this.get(key);
      if (value !== undefined) {
        result.push([key, value]);
      }
    }

    return result;
  }

  /**
   * Gets all values
   * @returns {Promise<any[]>} Array of values
   */
  async values() {
    const allEntries = await this.entries();
    return allEntries.map(([, value]) => value);
  }
}

module.exports = MemoryStorage;
