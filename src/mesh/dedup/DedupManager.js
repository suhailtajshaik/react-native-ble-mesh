'use strict';

/**
 * @fileoverview Combined deduplication manager using Bloom filter and LRU cache
 * @module mesh/dedup/DedupManager
 */

const BloomFilter = require('./BloomFilter');
const MessageCache = require('./MessageCache');
const { MESH_CONFIG } = require('../../constants');

/**
 * Default configuration for deduplication
 * @constant
 * @private
 */
const DEFAULT_CONFIG = {
  bloomFilterSize: MESH_CONFIG.BLOOM_FILTER_SIZE,
  bloomHashCount: MESH_CONFIG.BLOOM_HASH_COUNT,
  cacheSize: 1024,
  autoResetThreshold: 0.75
};

/**
 * Deduplication manager combining Bloom filter and LRU cache
 * Uses Bloom filter for fast probabilistic checks with LRU cache as backup
 * @class DedupManager
 */
class DedupManager {
  /**
   * Creates a new DedupManager
   * @param {Object} [options] - Configuration options
   * @param {number} [options.bloomFilterSize] - Size of Bloom filter in bits
   * @param {number} [options.bloomHashCount] - Number of hash functions
   * @param {number} [options.cacheSize] - Maximum LRU cache entries
   * @param {number} [options.autoResetThreshold] - Fill ratio for auto reset
   */
  constructor(options = {}) {
    const config = { ...DEFAULT_CONFIG, ...options };

    /**
     * Bloom filter for fast duplicate detection
     * @type {BloomFilter}
     * @private
     */
    this._bloomFilter = new BloomFilter(
      config.bloomFilterSize,
      config.bloomHashCount
    );

    /**
     * LRU cache for precise duplicate detection
     * @type {MessageCache}
     * @private
     */
    this._cache = new MessageCache(config.cacheSize);

    /**
     * Old Bloom filter kept during grace period after reset
     * @type {BloomFilter|null}
     * @private
     */
    this._oldBloomFilter = null;

    /**
     * Auto-reset threshold for Bloom filter
     * @type {number}
     * @private
     */
    this._autoResetThreshold = config.autoResetThreshold;

    /**
     * Statistics for monitoring
     * @type {Object}
     * @private
     */
    this._stats = {
      checks: 0,
      bloomPositives: 0,
      cacheHits: 0,
      duplicates: 0,
      added: 0,
      resets: 0
    };
  }

  /**
   * Checks if a message ID has been seen before
   * @param {string} messageId - Message ID to check
   * @returns {boolean} True if message is a duplicate
   */
  isDuplicate(messageId) {
    this._stats.checks++;

    // Check cache first (most accurate)
    if (this._cache.has(messageId)) {
      this._stats.cacheHits++;
      this._stats.duplicates++;
      return true;
    }

    // Check current bloom filter
    if (this._bloomFilter.mightContain(messageId)) {
      this._stats.bloomPositives++;
      return true;
    }

    // Check old bloom filter if in grace period
    if (this._oldBloomFilter && this._oldBloomFilter.mightContain(messageId)) {
      this._stats.bloomPositives++;
      return true;
    }

    return false;
  }

  /**
   * Marks a message ID as seen
   * @param {string} messageId - Message ID to mark
   */
  markSeen(messageId) {
    this._bloomFilter.add(messageId);
    this._cache.add(messageId);
    this._stats.added++;

    // Auto-reset Bloom filter if too full
    if (this._bloomFilter.getFillRatio() >= this._autoResetThreshold) {
      this._resetBloomFilter();
    }
  }

  /**
   * Checks and marks a message in one operation
   * @param {string} messageId - Message ID to check and mark
   * @returns {boolean} True if message was a duplicate
   */
  checkAndMark(messageId) {
    if (this.isDuplicate(messageId)) {
      return true;
    }
    this.markSeen(messageId);
    return false;
  }

  /**
   * Resets the Bloom filter while preserving cache entries
   * @private
   */
  _resetBloomFilter() {
    // Create a new bloom filter instead of clearing the old one
    // Keep the old filter active for checking during transition
    const oldFilter = this._bloomFilter;
    this._bloomFilter = new BloomFilter(
      oldFilter.size || MESH_CONFIG.BLOOM_FILTER_SIZE,
      oldFilter.hashCount || MESH_CONFIG.BLOOM_HASH_COUNT
    );
    this._stats.resets++;

    // Re-add all cached entries to new filter
    const entries = this._cache.getAll();
    for (const messageId of entries) {
      this._bloomFilter.add(messageId);
    }

    // Keep old filter for a grace period by checking both
    this._oldBloomFilter = oldFilter;

    // Clear old filter after grace period
    setTimeout(() => {
      this._oldBloomFilter = null;
    }, 60000); // 1 minute grace
  }

  /**
   * Resets both the Bloom filter and cache
   */
  reset() {
    this._bloomFilter.clear();
    this._cache.clear();
    this._stats.resets++;
  }

  /**
   * Gets deduplication statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      ...this._stats,
      bloomFillRatio: this._bloomFilter.getFillRatio(),
      bloomCount: this._bloomFilter.getCount(),
      cacheSize: this._cache.size,
      estimatedFalsePositiveRate: this._bloomFilter.getEstimatedFalsePositiveRate()
    };
  }

  /**
   * Resets statistics counters
   */
  resetStats() {
    this._stats = {
      checks: 0,
      bloomPositives: 0,
      cacheHits: 0,
      duplicates: 0,
      added: 0,
      resets: 0
    };
  }

  /**
   * Gets the number of unique messages seen
   * @returns {number} Count of unique messages in cache
   */
  getUniqueCount() {
    return this._cache.size;
  }

  /**
   * Checks if a specific message ID is in the exact cache
   * @param {string} messageId - Message ID to check
   * @returns {boolean} True if in cache
   */
  isInCache(messageId) {
    return this._cache.has(messageId);
  }

  /**
   * Gets when a message was first seen
   * @param {string} messageId - Message ID to look up
   * @returns {number|null} Timestamp or null if not found
   */
  getSeenTimestamp(messageId) {
    return this._cache.getTimestamp(messageId);
  }
}

module.exports = DedupManager;
