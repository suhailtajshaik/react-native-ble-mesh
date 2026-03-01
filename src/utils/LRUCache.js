'use strict';

/**
 * @fileoverview LRU (Least Recently Used) cache implementation
 * @module utils/LRUCache
 */

/**
 * Generic LRU cache with O(1) get/set operations
 * @template K, V
 * @class LRUCache
 */
class LRUCache {
  /**
   * Creates a new LRU cache
   * @param {number} maxSize - Maximum number of items to store
   * @throws {Error} If maxSize is not a positive integer
   */
  constructor(maxSize) {
    if (!Number.isInteger(maxSize) || maxSize <= 0) {
      throw new Error('maxSize must be a positive integer');
    }

    /**
     * Maximum cache size
     * @type {number}
     * @private
     */
    this._maxSize = maxSize;

    /**
     * Internal Map for storage (maintains insertion order)
     * @type {Map<K, V>}
     * @private
     */
    this._cache = new Map();
  }

  /**
   * Gets a value from the cache
   * @param {K} key - Key to look up
   * @returns {V|undefined} Value or undefined if not found
   */
  get(key) {
    if (!this._cache.has(key)) {
      return undefined;
    }

    // Move to end (most recently used)
    const value = /** @type {V} */ (this._cache.get(key));
    this._cache.delete(key);
    this._cache.set(key, value);

    return value;
  }

  /**
   * Sets a value in the cache
   * @param {K} key - Key to set
   * @param {V} value - Value to store
   * @returns {LRUCache<K, V>} This instance for chaining
   */
  set(key, value) {
    // If key exists, delete it first to update order
    if (this._cache.has(key)) {
      this._cache.delete(key);
    } else if (this._cache.size >= this._maxSize) {
      // Remove least recently used (first item)
      const firstKey = this._cache.keys().next().value;
      if (firstKey !== undefined) {
        this._cache.delete(firstKey);
      }
    }

    this._cache.set(key, value);
    return this;
  }

  /**
   * Checks if a key exists in the cache
   * Does not update access order
   * @param {K} key - Key to check
   * @returns {boolean} True if key exists
   */
  has(key) {
    return this._cache.has(key);
  }

  /**
   * Removes a key from the cache
   * @param {K} key - Key to remove
   * @returns {boolean} True if key was removed
   */
  delete(key) {
    return this._cache.delete(key);
  }

  /**
   * Clears all items from the cache
   */
  clear() {
    this._cache.clear();
  }

  /**
   * Gets the current number of items in the cache
   * @returns {number} Number of items
   */
  get size() {
    return this._cache.size;
  }

  /**
   * Gets the maximum size of the cache
   * @returns {number} Maximum size
   */
  get maxSize() {
    return this._maxSize;
  }

  /**
   * Returns all keys in the cache (most recent last)
   * @returns {K[]} Array of keys
   */
  keys() {
    return Array.from(this._cache.keys());
  }

  /**
   * Returns all values in the cache (most recent last)
   * @returns {V[]} Array of values
   */
  values() {
    return Array.from(this._cache.values());
  }

  /**
   * Returns all entries in the cache (most recent last)
   * @returns {any[]} Array of [key, value] pairs
   */
  entries() {
    return Array.from(this._cache.entries());
  }

  /**
   * Iterates over cache entries
   * @param {function(V, K, Map<K, V>): void} callback - Callback function
   */
  forEach(callback) {
    this._cache.forEach(callback);
  }

  /**
   * Peeks at a value without updating access order
   * @param {K} key - Key to peek
   * @returns {V|undefined} Value or undefined if not found
   */
  peek(key) {
    return this._cache.get(key);
  }

  /**
   * Gets the oldest key (least recently used)
   * @returns {K|undefined} Oldest key or undefined if empty
   */
  getOldest() {
    if (this._cache.size === 0) {
      return undefined;
    }
    return this._cache.keys().next().value;
  }

  /**
   * Gets the newest key (most recently used)
   * @returns {K|undefined} Newest key or undefined if empty
   */
  getNewest() {
    if (this._cache.size === 0) {
      return undefined;
    }
    const keys = Array.from(this._cache.keys());
    return keys[keys.length - 1];
  }

  /**
   * Updates max size and evicts items if necessary
   * @param {number} newMaxSize - New maximum size
   */
  resize(newMaxSize) {
    if (!Number.isInteger(newMaxSize) || newMaxSize <= 0) {
      throw new Error('maxSize must be a positive integer');
    }

    this._maxSize = newMaxSize;

    // Evict oldest items if over new limit
    while (this._cache.size > this._maxSize) {
      const firstKey = this._cache.keys().next().value;
      if (firstKey !== undefined) {
        this._cache.delete(firstKey);
      } else {
        break;
      }
    }
  }
}

module.exports = LRUCache;
