'use strict';

/**
 * SecureStorage - Abstract storage interface for sensitive key material.
 * Implementations should use platform-specific secure storage mechanisms.
 * @module crypto/keys/SecureStorage
 */

/**
 * SecureStorage defines the interface for secure key storage.
 * This is an abstract class - use platform-specific implementations.
 *
 * Platform implementations:
 * - React Native: Use react-native-keychain or expo-secure-store
 * - Node.js: Use encrypted file storage or keytar
 * - Browser: Use IndexedDB with encryption
 *
 * @abstract
 * @class
 */
class SecureStorage {
  /**
   * Stores a value securely.
   * @param {string} key - Storage key
   * @param {string} value - Value to store (should be serialized JSON)
   * @returns {Promise<void>}
   * @abstract
   */
  async set(_key, _value) {
    throw new Error('SecureStorage.set() must be implemented');
  }

  /**
   * Retrieves a stored value.
   * @param {string} key - Storage key
   * @returns {Promise<string|null>} Stored value or null if not found
   * @abstract
   */
  async get(_key) {
    throw new Error('SecureStorage.get() must be implemented');
  }

  /**
   * Deletes a stored value.
   * @param {string} key - Storage key
   * @returns {Promise<void>}
   * @abstract
   */
  async delete(_key) {
    throw new Error('SecureStorage.delete() must be implemented');
  }

  /**
   * Checks if a key exists in storage.
   * @param {string} key - Storage key
   * @returns {Promise<boolean>} True if key exists
   */
  async has(key) {
    const value = await this.get(key);
    return value !== null && value !== undefined;
  }

  /**
   * Clears all stored values.
   * @returns {Promise<void>}
   * @abstract
   */
  async clear() {
    throw new Error('SecureStorage.clear() must be implemented');
  }
}

/**
 * MemorySecureStorage - In-memory implementation for testing.
 * WARNING: Not secure for production use - keys are not persisted
 * and are stored in plain memory.
 *
 * @class
 * @extends SecureStorage
 */
class MemorySecureStorage extends SecureStorage {
  constructor() {
    super();
    /** @type {Map<string, string>} */
    this._store = new Map();
  }

  /**
   * Stores a value in memory.
   * @param {string} key - Storage key
   * @param {string} value - Value to store
   * @returns {Promise<void>}
   */
  async set(key, value) {
    if (typeof key !== 'string') {
      throw new Error('Key must be a string');
    }
    if (typeof value !== 'string') {
      throw new Error('Value must be a string');
    }
    this._store.set(key, value);
  }

  /**
   * Retrieves a value from memory.
   * @param {string} key - Storage key
   * @returns {Promise<string|null>} Stored value or null
   */
  async get(key) {
    if (typeof key !== 'string') {
      throw new Error('Key must be a string');
    }
    return this._store.get(key) || null;
  }

  /**
   * Deletes a value from memory.
   * @param {string} key - Storage key
   * @returns {Promise<void>}
   */
  async delete(key) {
    if (typeof key !== 'string') {
      throw new Error('Key must be a string');
    }
    this._store.delete(key);
  }

  /**
   * Clears all stored values.
   * @returns {Promise<void>}
   */
  async clear() {
    this._store.clear();
  }

  /**
   * Gets the number of stored items.
   * @returns {number} Number of items
   */
  get size() {
    return this._store.size;
  }
}

/**
 * Creates a SecureStorage adapter for React Native AsyncStorage.
 * Note: AsyncStorage is NOT secure - consider using expo-secure-store
 * or react-native-keychain for production.
 *
 * @param {object} asyncStorage - AsyncStorage instance
 * @returns {SecureStorage} Storage adapter
 *
 * @example
 * import AsyncStorage from '@react-native-async-storage/async-storage';
 * const storage = createAsyncStorageAdapter(AsyncStorage);
 */
function createAsyncStorageAdapter(asyncStorage) {
  return {
    async set(key, value) {
      await asyncStorage.setItem(key, value);
    },
    async get(key) {
      return await asyncStorage.getItem(key);
    },
    async delete(key) {
      await asyncStorage.removeItem(key);
    },
    async has(key) {
      const value = await asyncStorage.getItem(key);
      return value !== null;
    },
    async clear() {
      // Only clear mesh-related keys
      const keys = await asyncStorage.getAllKeys();
      const meshKeys = keys.filter(k => k.startsWith('mesh_'));
      await asyncStorage.multiRemove(meshKeys);
    }
  };
}

/**
 * Creates a SecureStorage adapter for expo-secure-store.
 * This provides actual secure storage on iOS/Android.
 *
 * @param {object} secureStore - SecureStore module from expo-secure-store
 * @returns {SecureStorage} Storage adapter
 *
 * @example
 * import * as SecureStore from 'expo-secure-store';
 * const storage = createExpoSecureStoreAdapter(SecureStore);
 */
function createExpoSecureStoreAdapter(secureStore) {
  return {
    async set(key, value) {
      await secureStore.setItemAsync(key, value);
    },
    async get(key) {
      return await secureStore.getItemAsync(key);
    },
    async delete(key) {
      await secureStore.deleteItemAsync(key);
    },
    async has(key) {
      const value = await secureStore.getItemAsync(key);
      return value !== null;
    },
    async clear() {
      // expo-secure-store doesn't have getAllKeys, so we track known keys
      console.warn('SecureStore clear() requires manual key tracking');
    }
  };
}

module.exports = {
  SecureStorage,
  MemorySecureStorage,
  createAsyncStorageAdapter,
  createExpoSecureStoreAdapter
};
