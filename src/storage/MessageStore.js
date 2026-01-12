'use strict';

/**
 * @fileoverview Message persistence layer for BLE Mesh Network
 * @module storage/MessageStore
 */

const MemoryStorage = require('./MemoryStorage');
const { MESH_CONFIG } = require('../constants');

/**
 * Message store for persisting and retrieving mesh network messages.
 * Provides message caching, deduplication support, and cleanup functionality.
 *
 * @class MessageStore
 */
class MessageStore {
  /**
   * Creates a new MessageStore instance
   * @param {Object} [options={}] - Store options
   * @param {Object} [options.storage] - Storage backend (defaults to MemoryStorage)
   * @param {number} [options.maxMessages=1000] - Maximum messages to store
   * @param {number} [options.messageTtlMs] - Message TTL in milliseconds
   */
  constructor(options = {}) {
    /**
     * Storage backend
     * @type {Object}
     * @private
     */
    this._storage = options.storage || new MemoryStorage({
      prefix: 'msg',
      maxSize: options.maxMessages || 1000
    });

    /**
     * Message TTL in milliseconds
     * @type {number}
     * @private
     */
    this._messageTtlMs = options.messageTtlMs || MESH_CONFIG.MESSAGE_TTL_MS;

    /**
     * Index storage for queries
     * @type {Object}
     * @private
     */
    this._indexStorage = options.indexStorage || new MemoryStorage({
      prefix: 'msg_idx'
    });
  }

  /**
   * Saves a message to storage
   * @param {Object} message - Message to save
   * @param {string} message.id - Message ID
   * @param {number} message.type - Message type
   * @param {Uint8Array} [message.payload] - Message payload
   * @param {string} [message.senderId] - Sender peer ID
   * @param {string} [message.recipientId] - Recipient peer ID
   * @param {number} [message.timestamp] - Message timestamp
   * @returns {Promise<void>}
   */
  async saveMessage(message) {
    if (!message || !message.id) {
      throw new Error('Message must have an id');
    }

    const storedMessage = {
      ...message,
      payload: message.payload
        ? Array.from(message.payload)
        : undefined,
      storedAt: Date.now()
    };

    await this._storage.set(message.id, storedMessage, {
      ttl: this._messageTtlMs
    });

    // Update indexes
    await this._updateIndexes(storedMessage);
  }

  /**
   * Gets a message by ID
   * @param {string} id - Message ID
   * @returns {Promise<Object|null>} Message or null if not found
   */
  async getMessage(id) {
    const message = await this._storage.get(id);

    if (!message) {
      return null;
    }

    // Convert payload back to Uint8Array
    if (message.payload) {
      message.payload = new Uint8Array(message.payload);
    }

    return message;
  }

  /**
   * Gets messages matching query options
   * @param {Object} [options={}] - Query options
   * @param {string} [options.senderId] - Filter by sender ID
   * @param {string} [options.recipientId] - Filter by recipient ID
   * @param {number} [options.type] - Filter by message type
   * @param {number} [options.since] - Filter messages since timestamp
   * @param {number} [options.until] - Filter messages until timestamp
   * @param {number} [options.limit=50] - Maximum messages to return
   * @param {number} [options.offset=0] - Offset for pagination
   * @returns {Promise<Object[]>} Array of messages
   */
  async getMessages(options = {}) {
    const {
      senderId,
      recipientId,
      type,
      since,
      until,
      limit = 50,
      offset = 0
    } = options;

    const allKeys = await this._storage.keys();
    const messages = [];

    for (const key of allKeys) {
      const message = await this.getMessage(key);
      if (!message) continue;

      // Apply filters
      if (senderId && message.senderId !== senderId) continue;
      if (recipientId && message.recipientId !== recipientId) continue;
      if (type !== undefined && message.type !== type) continue;
      if (since && message.timestamp < since) continue;
      if (until && message.timestamp > until) continue;

      messages.push(message);
    }

    // Sort by timestamp (newest first)
    messages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Apply pagination
    return messages.slice(offset, offset + limit);
  }

  /**
   * Deletes a message by ID
   * @param {string} id - Message ID
   * @returns {Promise<void>}
   */
  async deleteMessage(id) {
    const message = await this.getMessage(id);
    if (message) {
      await this._removeFromIndexes(message);
    }
    await this._storage.delete(id);
  }

  /**
   * Checks if a message exists
   * @param {string} id - Message ID
   * @returns {Promise<boolean>} True if message exists
   */
  async hasMessage(id) {
    return this._storage.has(id);
  }

  /**
   * Cleans up expired messages
   * @param {number} [maxAgeMs] - Maximum message age in milliseconds
   * @returns {Promise<number>} Number of messages removed
   */
  async cleanup(maxAgeMs) {
    const maxAge = maxAgeMs || this._messageTtlMs;
    const cutoff = Date.now() - maxAge;
    const allKeys = await this._storage.keys();
    let removed = 0;

    for (const key of allKeys) {
      const message = await this._storage.get(key);
      if (message) {
        const messageTime = message.timestamp || message.storedAt || 0;
        if (messageTime < cutoff) {
          await this.deleteMessage(key);
          removed++;
        }
      }
    }

    return removed;
  }

  /**
   * Gets the count of stored messages
   * @returns {Promise<number>} Number of messages
   */
  async getCount() {
    return this._storage.size();
  }

  /**
   * Clears all stored messages
   * @returns {Promise<void>}
   */
  async clear() {
    await this._storage.clear();
    await this._indexStorage.clear();
  }

  /**
   * Gets messages by sender
   * @param {string} senderId - Sender peer ID
   * @param {number} [limit=50] - Maximum messages
   * @returns {Promise<Object[]>} Array of messages
   */
  async getMessagesBySender(senderId, limit = 50) {
    return this.getMessages({ senderId, limit });
  }

  /**
   * Gets messages by recipient
   * @param {string} recipientId - Recipient peer ID
   * @param {number} [limit=50] - Maximum messages
   * @returns {Promise<Object[]>} Array of messages
   */
  async getMessagesByRecipient(recipientId, limit = 50) {
    return this.getMessages({ recipientId, limit });
  }

  /**
   * Gets conversation messages between two peers
   * @param {string} peerId1 - First peer ID
   * @param {string} peerId2 - Second peer ID
   * @param {number} [limit=50] - Maximum messages
   * @returns {Promise<Object[]>} Array of messages
   */
  async getConversation(peerId1, peerId2, limit = 50) {
    const allKeys = await this._storage.keys();
    const messages = [];

    for (const key of allKeys) {
      const message = await this.getMessage(key);
      if (!message) continue;

      const isMatch =
        (message.senderId === peerId1 && message.recipientId === peerId2) ||
        (message.senderId === peerId2 && message.recipientId === peerId1);

      if (isMatch) {
        messages.push(message);
      }
    }

    messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    return messages.slice(-limit);
  }

  /**
   * Updates indexes for a message
   * @param {Object} message - Message to index
   * @returns {Promise<void>}
   * @private
   */
  async _updateIndexes(message) {
    // Sender index
    if (message.senderId) {
      const key = `sender:${message.senderId}`;
      const ids = (await this._indexStorage.get(key)) || [];
      if (!ids.includes(message.id)) {
        ids.push(message.id);
        await this._indexStorage.set(key, ids);
      }
    }

    // Recipient index
    if (message.recipientId) {
      const key = `recipient:${message.recipientId}`;
      const ids = (await this._indexStorage.get(key)) || [];
      if (!ids.includes(message.id)) {
        ids.push(message.id);
        await this._indexStorage.set(key, ids);
      }
    }
  }

  /**
   * Removes a message from indexes
   * @param {Object} message - Message to remove from indexes
   * @returns {Promise<void>}
   * @private
   */
  async _removeFromIndexes(message) {
    if (message.senderId) {
      const key = `sender:${message.senderId}`;
      const ids = (await this._indexStorage.get(key)) || [];
      const filtered = ids.filter(id => id !== message.id);
      await this._indexStorage.set(key, filtered);
    }

    if (message.recipientId) {
      const key = `recipient:${message.recipientId}`;
      const ids = (await this._indexStorage.get(key)) || [];
      const filtered = ids.filter(id => id !== message.id);
      await this._indexStorage.set(key, filtered);
    }
  }
}

module.exports = MessageStore;
