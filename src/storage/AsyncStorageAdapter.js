'use strict';

/**
 * @fileoverview React Native AsyncStorage adapter
 * @module storage/AsyncStorageAdapter
 */

const Storage = require('./Storage');

/**
 * React Native AsyncStorage adapter.
 * Wraps @react-native-async-storage/async-storage for persistent storage.
 *
 * NOTE: @react-native-async-storage/async-storage is an optional peer dependency.
 * Install it separately: npm install @react-native-async-storage/async-storage
 *
 * @class AsyncStorageAdapter
 * @extends Storage
 */
class AsyncStorageAdapter extends Storage {
  /**
   * Creates a new AsyncStorageAdapter instance
   * @param {Object} [options={}] - Storage options
   * @param {string} [options.prefix='mesh'] - Key prefix for namespacing
   * @param {Object} [options.AsyncStorage] - AsyncStorage instance (optional)
   */
  constructor(options = {}) {
    super({
      prefix: 'mesh',
      ...options
    });

    /**
     * AsyncStorage instance
     * @type {Object|null}
     * @private
     */
    this._storage = options.AsyncStorage || null;

    /**
     * Whether adapter is initialized
     * @type {boolean}
     * @private
     */
    this._initialized = false;
  }

  /**
   * Initializes the AsyncStorage adapter
   * @returns {Promise<void>}
   * @throws {Error} If AsyncStorage is not available
   */
  async initialize() {
    if (this._initialized) {
      return;
    }

    // Try to load AsyncStorage if not provided
    if (!this._storage) {
      try {
        const AsyncStorageModule = require('@react-native-async-storage/async-storage');
        this._storage = AsyncStorageModule.default || AsyncStorageModule;
      } catch (error) {
        throw new Error(
          '@react-native-async-storage/async-storage is required. ' +
          'Install with: npm install @react-native-async-storage/async-storage'
        );
      }
    }

    this._initialized = true;
  }

  /**
   * Ensures the adapter is initialized
   * @throws {Error} If not initialized
   * @private
   */
  _ensureInitialized() {
    if (!this._initialized) {
      throw new Error('AsyncStorageAdapter is not initialized. Call initialize() first.');
    }
  }

  /**
   * Gets a value by key
   * @param {string} key - Key to retrieve
   * @returns {Promise<any>} Stored value or undefined
   */
  async get(key) {
    this._ensureInitialized();

    const prefixedKey = this._getKey(key);
    const jsonValue = await this._storage.getItem(prefixedKey);

    if (jsonValue === null) {
      return undefined;
    }

    try {
      const item = JSON.parse(jsonValue);

      // Check for expiration
      if (item.expiresAt && Date.now() > item.expiresAt) {
        await this._storage.removeItem(prefixedKey);
        return undefined;
      }

      return item.value;
    } catch (error) {
      // If JSON parsing fails, return raw value (legacy data)
      return jsonValue;
    }
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
    this._ensureInitialized();

    const prefixedKey = this._getKey(key);

    const item = {
      value,
      createdAt: Date.now()
    };

    if (options.ttl && options.ttl > 0) {
      item.expiresAt = Date.now() + options.ttl;
    }

    const jsonValue = JSON.stringify(item);
    await this._storage.setItem(prefixedKey, jsonValue);
  }

  /**
   * Deletes a value by key
   * @param {string} key - Key to delete
   * @returns {Promise<void>}
   */
  async delete(key) {
    this._ensureInitialized();

    const prefixedKey = this._getKey(key);
    await this._storage.removeItem(prefixedKey);
  }

  /**
   * Checks if a key exists
   * @param {string} key - Key to check
   * @returns {Promise<boolean>} True if key exists
   */
  async has(key) {
    const value = await this.get(key);
    return value !== undefined;
  }

  /**
   * Clears all stored data with our prefix
   * @returns {Promise<void>}
   */
  async clear() {
    this._ensureInitialized();

    const allKeys = await this._storage.getAllKeys();
    const prefix = this._options.prefix + ':';
    const keysToRemove = allKeys.filter(key => key.startsWith(prefix));

    if (keysToRemove.length > 0) {
      await this._storage.multiRemove(keysToRemove);
    }
  }

  /**
   * Gets all keys (without prefix)
   * @returns {Promise<string[]>} Array of keys
   */
  async keys() {
    this._ensureInitialized();

    const allKeys = await this._storage.getAllKeys();
    const prefix = this._options.prefix + ':';

    return allKeys
      .filter(key => key.startsWith(prefix))
      .map(key => key.slice(prefix.length));
  }

  /**
   * Gets multiple values by keys
   * @param {string[]} keys - Keys to retrieve
   * @returns {Promise<Map<string, any>>} Map of key-value pairs
   */
  async getMany(keys) {
    this._ensureInitialized();

    const prefixedKeys = keys.map(key => this._getKey(key));
    const pairs = await this._storage.multiGet(prefixedKeys);
    const result = new Map();
    const now = Date.now();

    for (const [prefixedKey, jsonValue] of pairs) {
      if (jsonValue !== null) {
        const key = prefixedKey.slice(this._options.prefix.length + 1);
        try {
          const item = JSON.parse(jsonValue);
          if (!item.expiresAt || now <= item.expiresAt) {
            result.set(key, item.value);
          }
        } catch (error) {
          result.set(key, jsonValue);
        }
      }
    }

    return result;
  }

  /**
   * Sets multiple key-value pairs
   * @param {Map<string, any>|Object} entries - Entries to set
   * @param {Object} [options={}] - Set options
   * @param {number} [options.ttl] - Time to live in milliseconds
   * @returns {Promise<void>}
   */
  async setMany(entries, options = {}) {
    this._ensureInitialized();

    const pairs = entries instanceof Map
      ? Array.from(entries.entries())
      : Object.entries(entries);

    const now = Date.now();
    const keyValuePairs = pairs.map(([key, value]) => {
      const item = {
        value,
        createdAt: now
      };

      if (options.ttl && options.ttl > 0) {
        item.expiresAt = now + options.ttl;
      }

      return [this._getKey(key), JSON.stringify(item)];
    });

    await this._storage.multiSet(keyValuePairs);
  }

  /**
   * Deletes multiple keys
   * @param {string[]} keys - Keys to delete
   * @returns {Promise<void>}
   */
  async deleteMany(keys) {
    this._ensureInitialized();

    const prefixedKeys = keys.map(key => this._getKey(key));
    await this._storage.multiRemove(prefixedKeys);
  }

  /**
   * Cleans up expired items
   * @returns {Promise<number>} Number of items removed
   */
  async cleanup() {
    this._ensureInitialized();

    const allKeys = await this.keys();
    const now = Date.now();
    const keysToRemove = [];

    for (const key of allKeys) {
      const prefixedKey = this._getKey(key);
      const jsonValue = await this._storage.getItem(prefixedKey);

      if (jsonValue !== null) {
        try {
          const item = JSON.parse(jsonValue);
          if (item.expiresAt && now > item.expiresAt) {
            keysToRemove.push(prefixedKey);
          }
        } catch (error) {
          // Ignore parse errors
        }
      }
    }

    if (keysToRemove.length > 0) {
      await this._storage.multiRemove(keysToRemove);
    }

    return keysToRemove.length;
  }
}

module.exports = AsyncStorageAdapter;
