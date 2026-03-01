'use strict';

/**
 * @fileoverview Broadcast message handling
 * @module service/text/broadcast/BroadcastManager
 */

const EventEmitter = require('../../../utils/EventEmitter');
const TextMessage = require('../message/TextMessage');

/**
 * Broadcast configuration
 * @constant {any}
 */
const BROADCAST_CONFIG = Object.freeze({
  MAX_MESSAGE_SIZE: 1000,
  MAX_RECENT_BROADCASTS: 100,
  DEDUP_WINDOW_MS: 5 * 60 * 1000 // 5 minutes
});

/**
 * Manages broadcast message handling
 * @class BroadcastManager
 * @extends EventEmitter
 */
class BroadcastManager extends EventEmitter {
  /**
   * Creates a new BroadcastManager
   * @param {any} [options] - Manager options
   */
  constructor(options = {}) {
    super();

    /** @type {number} @private */
    this._maxRecentBroadcasts = options.maxRecentBroadcasts || BROADCAST_CONFIG.MAX_RECENT_BROADCASTS;
    /** @type {number} @private */
    this._dedupWindowMs = options.dedupWindowMs || BROADCAST_CONFIG.DEDUP_WINDOW_MS;
    /** @type {any[]} @private */
    this._recentBroadcasts = [];
    /** @type {Map<string, number>} @private */
    this._seenMessageIds = new Map(); // messageId -> timestamp
    /** @type {string | null} @private */
    this._senderId = null;
    /** @type {Function | null} @private */
    this._sendCallback = null;
    /** @type {ReturnType<typeof setInterval> | null} @private */
    this._cleanupTimer = null;

    // Auto-cleanup every 5 minutes
    this._cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);

    if (this._cleanupTimer && typeof this._cleanupTimer.unref === 'function') {
      this._cleanupTimer.unref();
    }
  }

  /**
   * Initializes the broadcast manager
   * @param {any} options - Init options
   */
  initialize(options) {
    this._senderId = options.senderId;
    this._sendCallback = options.sendCallback;
  }

  /**
   * Sends a broadcast message
   * @param {string} content - Message content
   * @returns {string} Message ID
   */
  broadcast(content) {
    if (content.length > BROADCAST_CONFIG.MAX_MESSAGE_SIZE) {
      throw new Error(`Broadcast message too large (max ${BROADCAST_CONFIG.MAX_MESSAGE_SIZE} bytes)`);
    }

    const message = TextMessage.fromString(content, {
      senderId: this._senderId
    });

    const messageId = message.getId();

    // Mark as seen to avoid echo
    this._seenMessageIds.set(messageId, Date.now());

    // Add to recent broadcasts
    this._addToRecent(message);

    // Send via callback
    if (this._sendCallback) {
      this._sendCallback(message);
    }

    this.emit('broadcast-sent', {
      messageId,
      content,
      timestamp: message.getTimestamp()
    });

    return messageId;
  }

  /**
   * Handles an incoming broadcast message
   * @param {string} peerId - Sender peer ID
   * @param {Uint8Array} payload - Message payload
   */
  handleIncomingBroadcast(peerId, payload) {
    let message;

    // Try to deserialize
    try {
      if (payload instanceof Uint8Array) {
        message = TextMessage.fromSerialized(payload);
      } else if (typeof payload === 'string') {
        message = TextMessage.fromString(payload, { senderId: peerId });
      } else {
        return;
      }
    } catch {
      // If deserialization fails, treat as plain text
      const content = typeof payload === 'string'
        ? payload
        : new TextDecoder().decode(payload);
      message = TextMessage.fromString(content, { senderId: peerId });
    }

    const messageId = message.getId();

    // Check for duplicate
    if (this._isDuplicate(messageId)) {
      return;
    }

    // Mark as seen
    this._seenMessageIds.set(messageId, Date.now());

    // Add to recent broadcasts
    this._addToRecent(message);

    this.emit('broadcast-received', {
      messageId,
      peerId,
      content: message.getContent(),
      timestamp: message.getTimestamp(),
      message
    });
  }

  /**
   * Gets recent broadcasts
   * @param {number} [limit] - Maximum number to return
   * @returns {any[]}
   */
  getRecentBroadcasts(limit) {
    const broadcasts = [...this._recentBroadcasts];
    if (limit && limit > 0) {
      return broadcasts.slice(-limit);
    }
    return broadcasts;
  }

  /**
   * Clears all broadcast data
   */
  clear() {
    this._recentBroadcasts = [];
    this._seenMessageIds.clear();

    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
  }

  /**
   * Gets broadcast statistics
   * @returns {any}
   */
  getStats() {
    return {
      recentCount: this._recentBroadcasts.length,
      seenCount: this._seenMessageIds.size
    };
  }

  /**
   * Cleans up old dedup entries
   */
  cleanup() {
    const now = Date.now();
    const cutoff = now - this._dedupWindowMs;

    for (const [messageId, timestamp] of this._seenMessageIds) {
      if (timestamp < cutoff) {
        this._seenMessageIds.delete(messageId);
      }
    }
  }

  /**
   * Checks if a message is a duplicate
   * @private
   * @param {string} messageId - Message ID
   * @returns {boolean}
   */
  _isDuplicate(messageId) {
    const seenAt = this._seenMessageIds.get(messageId);
    if (!seenAt) { return false; }

    // Check if within dedup window
    const age = Date.now() - seenAt;
    return age < this._dedupWindowMs;
  }

  /**
   * Adds a message to recent broadcasts
   * @private
   * @param {any} message - Message to add
   */
  _addToRecent(message) {
    this._recentBroadcasts.push(message);

    // Trim if over limit
    while (this._recentBroadcasts.length > this._maxRecentBroadcasts) {
      this._recentBroadcasts.shift();
    }
  }
}

/** @type {any} */
BroadcastManager.CONFIG = BROADCAST_CONFIG;

module.exports = BroadcastManager;
