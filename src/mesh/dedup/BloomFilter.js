'use strict';

/**
 * @fileoverview Bloom filter for efficient duplicate detection
 * @module mesh/dedup/BloomFilter
 */

/**
 * FNV-1a hash parameters
 * @constant
 * @private
 */
const FNV_PRIME = 0x01000193;
const FNV_OFFSET = 0x811c9dc5;

// Cached TextEncoder singleton (avoids per-call allocation)
let _encoder = null;
function _getEncoder() {
  if (!_encoder && typeof TextEncoder !== 'undefined') {
    _encoder = new TextEncoder();
  }
  return _encoder;
}

/**
 * Bloom filter for probabilistic set membership testing
 * @class BloomFilter
 */
class BloomFilter {
  /**
   * Creates a new BloomFilter
   * @param {number} [size=2048] - Size of the bit array in bits
   * @param {number} [hashCount=7] - Number of hash functions to use
   */
  constructor(size = 2048, hashCount = 7) {
    if (!Number.isInteger(size) || size <= 0) {
      throw new Error('Size must be a positive integer');
    }
    if (!Number.isInteger(hashCount) || hashCount <= 0) {
      throw new Error('Hash count must be a positive integer');
    }

    /**
     * Size of the bit array in bits
     * @type {number}
     */
    this.size = size;

    /**
     * Number of hash functions
     * @type {number}
     */
    this.hashCount = hashCount;

    /**
     * Bit array storage (using Uint8Array for efficiency)
     * @type {Uint8Array}
     * @private
     */
    this._bits = new Uint8Array(Math.ceil(size / 8));

    /**
     * Number of items added
     * @type {number}
     * @private
     */
    this._count = 0;

    /**
     * Running count of set bits (avoids O(n) scan in getFillRatio)
     * @type {number}
     * @private
     */
    this._setBitCount = 0;
  }

  /**
   * Computes FNV-1a hash of input data
   * @param {Uint8Array} data - Data to hash
   * @param {number} seed - Seed for variation
   * @returns {number} Hash value
   * @private
   */
  _fnv1a(data, seed) {
    let hash = FNV_OFFSET ^ seed;
    // Handle empty data by mixing in the seed and length
    if (data.length === 0) {
      hash ^= seed;
      hash = Math.imul(hash, FNV_PRIME) >>> 0;
    }
    for (let i = 0; i < data.length; i++) {
      hash ^= data[i];
      hash = Math.imul(hash, FNV_PRIME) >>> 0;
    }
    return hash;
  }

  /**
   * Converts input to Uint8Array
   * @param {string|Uint8Array} item - Item to convert
   * @returns {Uint8Array} Byte array
   * @private
   */
  _toBytes(item) {
    if (item instanceof Uint8Array) {
      return item;
    }
    if (typeof item === 'string') {
      const encoder = _getEncoder();
      if (encoder) {
        return encoder.encode(item);
      }
      // Fallback for environments without TextEncoder
      const bytes = new Uint8Array(item.length);
      for (let i = 0; i < item.length; i++) {
        bytes[i] = item.charCodeAt(i) & 0xff;
      }
      return bytes;
    }
    throw new Error('Item must be string or Uint8Array');
  }

  /**
   * Adds an item to the filter
   * Inlined position computation to avoid intermediate array allocation
   * @param {string|Uint8Array} item - Item to add
   */
  add(item) {
    const data = this._toBytes(item);
    for (let i = 0; i < this.hashCount; i++) {
      const pos = this._fnv1a(data, i) % this.size;
      const byteIndex = pos >> 3;
      const mask = 1 << (pos & 7);
      if (!(this._bits[byteIndex] & mask)) {
        this._bits[byteIndex] |= mask;
        this._setBitCount++;
      }
    }
    this._count++;
  }

  /**
   * Tests if an item might be in the filter
   * Inlined position computation to avoid intermediate array allocation
   * @param {string|Uint8Array} item - Item to test
   * @returns {boolean} True if item might be present, false if definitely absent
   */
  mightContain(item) {
    const data = this._toBytes(item);
    for (let i = 0; i < this.hashCount; i++) {
      const pos = this._fnv1a(data, i) % this.size;
      if (!(this._bits[pos >> 3] & (1 << (pos & 7)))) {
        return false;
      }
    }
    return true;
  }

  /**
   * Clears all items from the filter
   */
  clear() {
    this._bits.fill(0);
    this._count = 0;
    this._setBitCount = 0;
  }

  /**
   * Gets the fill ratio of the filter (O(1) using running count)
   * @returns {number} Ratio of set bits to total bits (0-1)
   */
  getFillRatio() {
    return this._setBitCount / this.size;
  }

  /**
   * Gets the number of items added
   * @returns {number} Count of items added
   */
  getCount() {
    return this._count;
  }

  /**
   * Estimates false positive rate based on current fill
   * @returns {number} Estimated false positive probability
   */
  getEstimatedFalsePositiveRate() {
    const fillRatio = this.getFillRatio();
    return Math.pow(fillRatio, this.hashCount);
  }
}

module.exports = BloomFilter;
