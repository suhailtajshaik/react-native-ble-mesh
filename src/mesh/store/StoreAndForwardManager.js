'use strict';

/**
 * @fileoverview Store and Forward Manager for offline peer message caching
 * @module mesh/store/StoreAndForwardManager
 *
 * Caches messages for offline recipients and delivers them upon reconnection.
 * Implements the BitChat protocol store-and-forward specification.
 */

const EventEmitter = require('../../utils/EventEmitter');
const { EVENTS } = require('../../constants');
const { ValidationError } = require('../../errors');
const { randomBytes } = require('../../utils/bytes');

/**
 * Hex lookup table for fast byte-to-hex conversion
 * @constant {string[]}
 * @private
 */
const HEX = Array.from({ length: 256 }, (_, i) => (i < 16 ? '0' : '') + i.toString(16));

/**
 * Default configuration for store and forward
 * @constant {Object}
 */
const DEFAULT_CONFIG = Object.freeze({
  /** Maximum number of cached messages per recipient */
  maxMessagesPerRecipient: 100,
  /** Maximum total cached messages */
  maxTotalMessages: 1000,
  /** Maximum cache size in bytes */
  maxCacheSizeBytes: 10 * 1024 * 1024, // 10MB
  /** Default retention period in ms (24 hours) */
  retentionMs: 24 * 60 * 60 * 1000,
  /** Cleanup interval in ms (5 minutes) */
  cleanupIntervalMs: 5 * 60 * 1000
});

/**
 * Cached message structure
 * @typedef {Object} CachedMessage
 * @property {string} id - Message ID
 * @property {string} recipientId - Recipient peer ID
 * @property {Uint8Array} encryptedPayload - Encrypted message payload
 * @property {number} timestamp - When message was cached
 * @property {number} expiresAt - When message expires
 * @property {number} attempts - Delivery attempts
 * @property {number} size - Payload size in bytes
 */

/**
 * Store and Forward Manager for offline peer message delivery.
 *
 * @class StoreAndForwardManager
 * @extends EventEmitter
 * @example
 * const manager = new StoreAndForwardManager({
 *   retentionMs: 12 * 60 * 60 * 1000, // 12 hours
 * });
 *
 * // Cache a message for offline peer
 * await manager.cacheForOfflinePeer(peerId, encryptedMessage);
 *
 * // When peer comes online
 * await manager.deliverCachedMessages(peerId, sendFn);
 */
class StoreAndForwardManager extends EventEmitter {
  /**
     * Creates a new StoreAndForwardManager instance.
     * @param {Object} [options={}] - Configuration options
     * @param {number} [options.maxMessagesPerRecipient=100] - Max messages per recipient
     * @param {number} [options.maxTotalMessages=1000] - Max total cached messages
     * @param {number} [options.maxCacheSizeBytes=10485760] - Max cache size (10MB)
     * @param {number} [options.retentionMs=86400000] - Message retention (24h)
     * @param {number} [options.cleanupIntervalMs=300000] - Cleanup interval (5min)
     */
  constructor(options = {}) {
    super();

    /**
         * Configuration
         * @type {Object}
         * @private
         */
    this._config = { ...DEFAULT_CONFIG, ...options };

    /**
         * Message cache by recipient ID
         * @type {Map<string, CachedMessage[]>}
         * @private
         */
    this._cache = new Map();

    /**
         * Total cached size in bytes
         * @type {number}
         * @private
         */
    this._totalSize = 0;

    /**
         * Total message count
         * @type {number}
         * @private
         */
    this._totalCount = 0;

    /**
         * Cleanup timer
         * @type {number|null}
         * @private
         */
    this._cleanupTimer = null;

    /**
         * Statistics
         * @type {Object}
         * @private
         */
    this._stats = {
      messagesCached: 0,
      messagesDelivered: 0,
      messagesExpired: 0,
      messagesDropped: 0,
      deliveryAttempts: 0,
      deliveryFailures: 0
    };

    // Start periodic cleanup
    this._startCleanupTimer();
  }

  /**
     * Caches a message for an offline peer.
     * @param {string} recipientId - Recipient peer ID
     * @param {Uint8Array} encryptedPayload - Encrypted message payload
     * @param {Object} [options={}] - Cache options
     * @param {string} [options.messageId] - Message ID
     * @param {number} [options.ttlMs] - Custom TTL in ms
     * @returns {Promise<string>} Cached message ID
     */
  async cacheForOfflinePeer(recipientId, encryptedPayload, options = {}) {
    if (!recipientId || typeof recipientId !== 'string') {
      throw ValidationError.invalidArgument('recipientId', recipientId, {
        reason: 'recipientId must be a non-empty string'
      });
    }

    if (!(encryptedPayload instanceof Uint8Array)) {
      throw ValidationError.invalidType('encryptedPayload', encryptedPayload, 'Uint8Array');
    }

    const messageId = options.messageId || this._generateId();
    const now = Date.now();
    const ttl = options.ttlMs || this._config.retentionMs;

    const cached = {
      id: messageId,
      recipientId,
      encryptedPayload,
      timestamp: now,
      expiresAt: now + ttl,
      attempts: 0,
      size: encryptedPayload.length
    };

    // Check if we need to make room
    await this._ensureCapacity(cached.size);

    // Get or create recipient cache
    if (!this._cache.has(recipientId)) {
      this._cache.set(recipientId, []);
    }

    const recipientCache = this._cache.get(recipientId);

    // Check per-recipient limit
    if (recipientCache.length >= this._config.maxMessagesPerRecipient) {
      // Remove oldest message for this recipient
      const oldest = recipientCache.shift();
      if (oldest) {
        this._totalSize -= oldest.size;
        this._totalCount--;
        this._stats.messagesDropped++;
      }
    }

    // Add to cache
    recipientCache.push(cached);
    this._totalSize += cached.size;
    this._totalCount++;
    this._stats.messagesCached++;

    this.emit(EVENTS.MESSAGE_CACHED || 'message-cached', {
      messageId,
      recipientId,
      expiresAt: cached.expiresAt
    });

    return messageId;
  }

  /**
     * Delivers all cached messages to a peer that came online.
     * @param {string} recipientId - Recipient peer ID
     * @param {Function} sendFn - Async function to send message: (payload) => Promise<void>
     * @returns {Promise<Object>} Delivery result with counts
     */
  async deliverCachedMessages(recipientId, sendFn) {
    if (!this._cache.has(recipientId)) {
      return { delivered: 0, failed: 0 };
    }

    const messages = this._cache.get(recipientId);
    const results = { delivered: 0, failed: 0, remaining: [] };

    for (const msg of messages) {
      // Skip expired messages
      if (Date.now() > msg.expiresAt) {
        this._totalSize -= msg.size;
        this._totalCount--;
        this._stats.messagesExpired++;
        continue;
      }

      msg.attempts++;
      this._stats.deliveryAttempts++;

      try {
        await sendFn(msg.encryptedPayload);
        results.delivered++;
        this._stats.messagesDelivered++;
        this._totalSize -= msg.size;
        this._totalCount--;

        this.emit(EVENTS.MESSAGE_DELIVERED || 'message-delivered', {
          messageId: msg.id,
          recipientId
        });
      } catch (error) {
        results.failed++;
        this._stats.deliveryFailures++;
        results.remaining.push(msg);

        this.emit(EVENTS.MESSAGE_DELIVERY_FAILED || 'message-delivery-failed', {
          messageId: msg.id,
          recipientId,
          error: error.message,
          attempts: msg.attempts
        });
      }
    }

    // Update cache with remaining messages
    if (results.remaining.length > 0) {
      this._cache.set(recipientId, results.remaining);
    } else {
      this._cache.delete(recipientId);
    }

    return {
      delivered: results.delivered,
      failed: results.failed
    };
  }

  /**
     * Checks if there are cached messages for a peer.
     * @param {string} recipientId - Recipient peer ID
     * @returns {boolean} True if cached messages exist
     */
  hasCachedMessages(recipientId) {
    const cache = this._cache.get(recipientId);
    return !!(cache && cache.length > 0);
  }

  /**
     * Gets count of cached messages for a peer.
     * @param {string} recipientId - Recipient peer ID
     * @returns {number} Message count
     */
  getCachedCount(recipientId) {
    const cache = this._cache.get(recipientId);
    return cache ? cache.length : 0;
  }

  /**
     * Gets all recipient IDs with cached messages.
     * @returns {string[]} Array of recipient IDs
     */
  getRecipientsWithCache() {
    return Array.from(this._cache.keys());
  }

  /**
     * Removes all cached messages for a specific recipient.
     * @param {string} recipientId - Recipient peer ID
     * @returns {number} Number of messages removed
     */
  clearRecipientCache(recipientId) {
    const cache = this._cache.get(recipientId);
    if (!cache) {
      return 0;
    }

    const count = cache.length;
    const size = cache.reduce((sum, m) => sum + m.size, 0);

    this._cache.delete(recipientId);
    this._totalSize -= size;
    this._totalCount -= count;

    return count;
  }

  /**
     * Prunes expired messages from all caches.
     * @returns {Promise<number>} Number of messages pruned
     */
  async pruneExpiredMessages() {
    const now = Date.now();
    let pruned = 0;

    for (const [recipientId, messages] of this._cache) {
      const validMessages = messages.filter(msg => {
        if (msg.expiresAt <= now) {
          this._totalSize -= msg.size;
          this._totalCount--;
          this._stats.messagesExpired++;
          pruned++;
          return false;
        }
        return true;
      });

      if (validMessages.length > 0) {
        this._cache.set(recipientId, validMessages);
      } else {
        this._cache.delete(recipientId);
      }
    }

    if (pruned > 0) {
      this.emit('messages-pruned', { count: pruned });
    }

    return pruned;
  }

  /**
     * Gets store and forward statistics.
     * @returns {Object} Statistics
     */
  getStats() {
    return {
      ...this._stats,
      totalCached: this._totalCount,
      totalSizeBytes: this._totalSize,
      recipientCount: this._cache.size,
      cacheUtilization: this._totalSize / this._config.maxCacheSizeBytes
    };
  }

  /**
     * Resets statistics.
     */
  resetStats() {
    this._stats = {
      messagesCached: 0,
      messagesDelivered: 0,
      messagesExpired: 0,
      messagesDropped: 0,
      deliveryAttempts: 0,
      deliveryFailures: 0
    };
  }

  /**
     * Clears all cached messages.
     */
  clear() {
    this._cache.clear();
    this._totalSize = 0;
    this._totalCount = 0;
  }

  /**
     * Destroys the manager and cleans up resources.
     */
  destroy() {
    this._stopCleanupTimer();
    this.clear();
    this.removeAllListeners();
  }

  /**
     * Ensures capacity for new message.
     * @param {number} requiredSize - Size needed
     * @private
     */
  async _ensureCapacity(requiredSize) {
    // Check size limit
    while (this._totalSize + requiredSize > this._config.maxCacheSizeBytes) {
      if (this._totalCount === 0) { break; }
      this._removeOldestMessage();
    }

    // Check count limit
    while (this._totalCount >= this._config.maxTotalMessages) {
      this._removeOldestMessage();
    }
  }

  /**
     * Removes the oldest message from cache.
     * @private
     */
  _removeOldestMessage() {
    let oldestTime = Infinity;
    let oldestRecipient = null;

    for (const [recipientId, messages] of this._cache) {
      if (messages.length > 0 && messages[0].timestamp < oldestTime) {
        oldestTime = messages[0].timestamp;
        oldestRecipient = recipientId;
      }
    }

    if (oldestRecipient) {
      const messages = this._cache.get(oldestRecipient);
      const oldest = messages.shift();
      if (oldest) {
        this._totalSize -= oldest.size;
        this._totalCount--;
        this._stats.messagesDropped++;
      }
      if (messages.length === 0) {
        this._cache.delete(oldestRecipient);
      }
    }
  }

  /**
     * Generates a unique message ID.
     * @returns {string} Message ID
     * @private
     */
  _generateId() {
    const bytes = randomBytes(16);
    let id = '';
    for (let i = 0; i < bytes.length; i++) {
      id += HEX[bytes[i]];
    }
    return id;
  }

  /**
     * Starts the cleanup timer.
     * @private
     */
  _startCleanupTimer() {
    this._cleanupTimer = setInterval(
      () => this.pruneExpiredMessages(),
      this._config.cleanupIntervalMs
    );
    // Allow Node.js process to exit even if timer is active (important for tests)
    if (this._cleanupTimer && typeof this._cleanupTimer.unref === 'function') {
      this._cleanupTimer.unref();
    }
  }

  /**
     * Stops the cleanup timer.
     * @private
     */
  _stopCleanupTimer() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
  }
}

module.exports = StoreAndForwardManager;
