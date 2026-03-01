'use strict';

/**
 * @fileoverview Abstract storage interface for BLE Mesh Network
 * @module storage/Storage
 */

/**
 * Abstract storage interface.
 * Extend this class to implement specific storage backends.
 *
 * @abstract
 * @class Storage
 */
class Storage {
  /**
   * Creates a new Storage instance
   * @param {any} [options={}] - Storage options
   *
   */
  constructor(options = {}) {
    /**
     * Storage options
     * @type {any}
     * @protected
     */
    this._options = {
      prefix: '',
      ...options
    };
  }

  /**
   * Gets the prefixed key
   * @param {string} key - Original key
   * @returns {string} Prefixed key
   * @protected
   */
  _getKey(key) {
    return this._options.prefix ? `${this._options.prefix}:${key}` : key;
  }

  /**
   * Gets a value by key
   * @abstract
   * @param {string} _key - Key to retrieve
   * @returns {Promise<any>} Stored value or undefined
   * @throws {Error} If not implemented by subclass
   */
  async get(_key) {
    throw new Error('Storage.get() must be implemented by subclass');
  }

  /**
   * Sets a value by key
   * @abstract
   * @param {string} _key - Key to set
   * @param {any} _value - Value to store
   * @returns {Promise<void>}
   * @throws {Error} If not implemented by subclass
   */
  async set(_key, _value) {
    throw new Error('Storage.set() must be implemented by subclass');
  }

  /**
   * Deletes a value by key
   * @abstract
   * @param {string} _key - Key to delete
   * @returns {Promise<void>}
   * @throws {Error} If not implemented by subclass
   */
  async delete(_key) {
    throw new Error('Storage.delete() must be implemented by subclass');
  }

  /**
   * Checks if a key exists
   * @abstract
   * @param {string} _key - Key to check
   * @returns {Promise<boolean>} True if key exists
   * @throws {Error} If not implemented by subclass
   */
  async has(_key) {
    throw new Error('Storage.has() must be implemented by subclass');
  }

  /**
   * Clears all stored data
   * @abstract
   * @returns {Promise<void>}
   * @throws {Error} If not implemented by subclass
   */
  async clear() {
    throw new Error('Storage.clear() must be implemented by subclass');
  }

  /**
   * Gets all keys
   * @abstract
   * @returns {Promise<string[]>} Array of keys
   * @throws {Error} If not implemented by subclass
   */
  async keys() {
    throw new Error('Storage.keys() must be implemented by subclass');
  }

  /**
   * Gets the number of stored items
   * @returns {Promise<number>} Number of items
   */
  async size() {
    const allKeys = await this.keys();
    return allKeys.length;
  }

  /**
   * Gets multiple values by keys
   * @param {string[]} keys - Keys to retrieve
   * @returns {Promise<Map<string, any>>} Map of key-value pairs
   */
  async getMany(keys) {
    const result = new Map();
    await Promise.all(
      keys.map(async (key) => {
        const value = await this.get(key);
        if (value !== undefined) {
          result.set(key, value);
        }
      })
    );
    return result;
  }

  /**
   * Sets multiple key-value pairs
   * @param {Map<string, any>|any} entries - Entries to set
   * @returns {Promise<void>}
   */
  async setMany(entries) {
    const pairs = entries instanceof Map
      ? Array.from(entries.entries())
      : Object.entries(entries);

    await Promise.all(
      pairs.map(([key, value]) => this.set(key, value))
    );
  }

  /**
   * Deletes multiple keys
   * @param {string[]} keys - Keys to delete
   * @returns {Promise<void>}
   */
  async deleteMany(keys) {
    await Promise.all(keys.map(key => this.delete(key)));
  }
}

module.exports = Storage;
