'use strict';

/**
 * @fileoverview LRU message cache for duplicate detection backup
 * @module mesh/dedup/MessageCache
 */

/**
 * LRU Cache node for doubly-linked list
 * @class CacheNode
 * @private
 */
class CacheNode {
  /**
   * Creates a new CacheNode
   * @param {string} key - Message ID
   * @param {number} timestamp - When the message was seen
   */
  constructor(key, timestamp) {
    this.key = key;
    this.timestamp = timestamp;
    this.prev = null;
    this.next = null;
  }
}

/**
 * LRU message cache for storing recently seen message IDs
 * Uses doubly-linked list for O(1) operations
 * @class MessageCache
 */
class MessageCache {
  /**
   * Creates a new MessageCache
   * @param {number} maxSize - Maximum number of message IDs to store
   */
  constructor(maxSize) {
    if (!Number.isInteger(maxSize) || maxSize <= 0) {
      throw new Error('Max size must be a positive integer');
    }

    /**
     * Maximum number of entries
     * @type {number}
     */
    this.maxSize = maxSize;

    /**
     * Map of message IDs to cache nodes
     * @type {Map<string, CacheNode>}
     * @private
     */
    this._map = new Map();

    /**
     * Head of the LRU list (most recently used)
     * @type {CacheNode|null}
     * @private
     */
    this._head = null;

    /**
     * Tail of the LRU list (least recently used)
     * @type {CacheNode|null}
     * @private
     */
    this._tail = null;
  }

  /**
   * Moves a node to the head of the list
   * @param {CacheNode} node - Node to move
   * @private
   */
  _moveToHead(node) {
    if (node === this._head) { return; }

    // Remove from current position
    if (node.prev) { node.prev.next = node.next; }
    if (node.next) { node.next.prev = node.prev; }
    if (node === this._tail) { this._tail = node.prev; }

    // Move to head
    node.prev = null;
    node.next = this._head;
    if (this._head) { this._head.prev = node; }
    this._head = node;
    if (!this._tail) { this._tail = node; }
  }

  /**
   * Removes the tail node (least recently used)
   * @returns {string|null} Removed message ID or null
   * @private
   */
  _removeTail() {
    if (!this._tail) { return null; }

    const key = this._tail.key;
    this._map.delete(key);

    if (this._head === this._tail) {
      this._head = null;
      this._tail = null;
    } else {
      this._tail = this._tail.prev;
      if (this._tail) { this._tail.next = null; }
    }

    return key;
  }

  /**
   * Adds a message ID to the cache
   * @param {string} messageId - Message ID to add
   * @returns {boolean} True if newly added, false if already present
   */
  add(messageId) {
    if (typeof messageId !== 'string' || messageId.length === 0) {
      throw new Error('Message ID must be a non-empty string');
    }

    // Check if already exists
    const existing = this._map.get(messageId);
    if (existing) {
      existing.timestamp = Date.now();
      this._moveToHead(existing);
      return false;
    }

    // Create new node
    const node = new CacheNode(messageId, Date.now());
    this._map.set(messageId, node);

    // Add to head
    node.next = this._head;
    if (this._head) { this._head.prev = node; }
    this._head = node;
    if (!this._tail) { this._tail = node; }

    // Evict if over capacity
    if (this._map.size > this.maxSize) {
      this._removeTail();
    }

    return true;
  }

  /**
   * Checks if a message ID is in the cache
   * @param {string} messageId - Message ID to check
   * @returns {boolean} True if present
   */
  has(messageId) {
    return this._map.has(messageId);
  }

  /**
   * Gets the timestamp when a message was first seen
   * @param {string} messageId - Message ID to look up
   * @returns {number|null} Timestamp or null if not found
   */
  getTimestamp(messageId) {
    const node = this._map.get(messageId);
    return node ? node.timestamp : null;
  }

  /**
   * Removes a message ID from the cache
   * @param {string} messageId - Message ID to remove
   * @returns {boolean} True if removed, false if not found
   */
  delete(messageId) {
    const node = this._map.get(messageId);
    if (!node) { return false; }

    // Update linked list
    if (node.prev) { node.prev.next = node.next; }
    if (node.next) { node.next.prev = node.prev; }
    if (node === this._head) { this._head = node.next; }
    if (node === this._tail) { this._tail = node.prev; }

    this._map.delete(messageId);
    return true;
  }

  /**
   * Clears all entries from the cache
   */
  clear() {
    this._map.clear();
    this._head = null;
    this._tail = null;
  }

  /**
   * Gets the current number of entries
   * @returns {number} Number of cached message IDs
   */
  get size() {
    return this._map.size;
  }

  /**
   * Gets all message IDs in the cache (most recent first)
   * @returns {string[]} Array of message IDs
   */
  getAll() {
    const result = [];
    let node = this._head;
    while (node) {
      result.push(node.key);
      node = node.next;
    }
    return result;
  }
}

module.exports = MessageCache;
