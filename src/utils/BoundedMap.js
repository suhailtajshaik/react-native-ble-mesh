'use strict';

/**
 * @fileoverview Map with maximum size and LRU eviction
 * @module utils/BoundedMap
 */

/**
 * Map with maximum size limit and LRU eviction policy
 * When the map exceeds maxSize, the least recently used entry is removed.
 *
 * @class BoundedMap
 * @template K, V
 * @example
 * const cache = new BoundedMap(100);
 * cache.set('key1', 'value1');
 * const value = cache.get('key1'); // Marks as recently used
 */
class BoundedMap {
  /**
   * Creates a new BoundedMap
   * @param {number} [maxSize=1000] - Maximum number of entries
   */
  constructor(maxSize = 1000) {
    if (typeof maxSize !== 'number' || maxSize < 1) {
      throw new Error('maxSize must be a positive number');
    }
    /** @private */
    this._maxSize = maxSize;
    /** @private */
    this._map = new Map();
  }

  /**
   * Get the value for a key (marks as recently used)
   * @param {K} key - The key to look up
   * @returns {V|undefined} The value or undefined
   */
  get(key) {
    if (!this._map.has(key)) {
      return undefined;
    }
    // Move to end (most recently used)
    const value = this._map.get(key);
    this._map.delete(key);
    this._map.set(key, value);
    return value;
  }

  /**
   * Set a key-value pair (evicts LRU if at capacity)
   * @param {K} key - The key
   * @param {V} value - The value
   * @returns {BoundedMap} This instance for chaining
   */
  set(key, value) {
    // If key exists, delete it first to update position
    if (this._map.has(key)) {
      this._map.delete(key);
    } else if (this._map.size >= this._maxSize) {
      // Evict least recently used (first entry)
      const firstKey = this._map.keys().next().value;
      this._map.delete(firstKey);
    }
    this._map.set(key, value);
    return this;
  }

  /**
   * Check if key exists
   * @param {K} key - The key to check
   * @returns {boolean} True if key exists
   */
  has(key) {
    return this._map.has(key);
  }

  /**
   * Delete a key
   * @param {K} key - The key to delete
   * @returns {boolean} True if key was deleted
   */
  delete(key) {
    return this._map.delete(key);
  }

  /**
   * Clear all entries
   */
  clear() {
    this._map.clear();
  }

  /**
   * Get the number of entries
   * @returns {number} Number of entries
   */
  get size() {
    return this._map.size;
  }

  /**
   * Get the maximum size
   * @returns {number} Maximum size
   */
  get maxSize() {
    return this._maxSize;
  }

  /**
   * Get all keys
   * @returns {IterableIterator<K>} Iterator of keys
   */
  keys() {
    return this._map.keys();
  }

  /**
   * Get all values
   * @returns {IterableIterator<V>} Iterator of values
   */
  values() {
    return this._map.values();
  }

  /**
   * Get all entries
   * @returns {Iterator} Iterator of [key, value] pairs
   */
  entries() {
    return this._map.entries();
  }

  /**
   * Iterate over entries
   * @param {function(V, K, BoundedMap): void} callback - Callback function
   */
  forEach(callback) {
    this._map.forEach((value, key) => callback(value, key, this));
  }

  /**
   * Make iterable
   * @returns {Iterator} Iterator of [key, value] pairs
   */
  [Symbol.iterator]() {
    return this._map[Symbol.iterator]();
  }
}

module.exports = BoundedMap;
