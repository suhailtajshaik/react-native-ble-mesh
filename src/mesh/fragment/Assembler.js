'use strict';

/**
 * @fileoverview Fragment assembler for reconstructing fragmented messages
 * @module mesh/fragment/Assembler
 */

const { MESH_CONFIG } = require('../../constants');
const { MessageError, ValidationError } = require('../../errors');
const { getFragmentInfo, isValidFragment } = require('./Fragmenter');

/**
 * Default assembly timeout
 * @constant
 * @private
 */
const DEFAULT_TIMEOUT = MESH_CONFIG.FRAGMENT_TIMEOUT_MS;

/**
 * Pending fragment set
 * @class PendingFragmentSet
 * @private
 */
class PendingFragmentSet {
  /**
   * Creates a new PendingFragmentSet
   * @param {string} messageId - Message ID
   * @param {number} total - Total expected fragments
   * @param {number} timeout - Timeout in milliseconds
   */
  constructor(messageId, total, timeout) {
    this.messageId = messageId;
    this.total = total;
    /** @type {Map<number, Uint8Array>} */
    this.received = new Map();
    this.createdAt = Date.now();
    this.expiresAt = this.createdAt + timeout;
    this.totalPayloadLength = 0;
  }

  /**
   * Checks if the fragment set is complete
   * @returns {boolean} True if all fragments received
   */
  isComplete() {
    return this.received.size === this.total;
  }

  /**
   * Checks if the fragment set has expired
   * @returns {boolean} True if expired
   */
  isExpired() {
    return Date.now() > this.expiresAt;
  }

  /**
   * Adds a fragment to the set
   * @param {number} index - Fragment index
   * @param {Uint8Array} payload - Fragment payload
   * @returns {boolean} True if fragment was new
   */
  addFragment(index, payload) {
    if (this.received.has(index)) {
      return false;
    }
    this.received.set(index, payload);
    this.totalPayloadLength += payload.length;
    return true;
  }

  /**
   * Assembles all fragments into complete payload
   * @returns {Uint8Array} Complete assembled payload
   */
  assemble() {
    const MAX_ASSEMBLY_SIZE = 500 * 1024; // 500KB max for mesh messages
    if (this.totalPayloadLength > MAX_ASSEMBLY_SIZE) {
      throw new Error(`Fragment assembly too large: ${this.totalPayloadLength} bytes exceeds ${MAX_ASSEMBLY_SIZE} byte limit`);
    }

    const result = new Uint8Array(this.totalPayloadLength);
    let offset = 0;

    for (let i = 0; i < this.total; i++) {
      const payload = this.received.get(i);
      if (!payload) {
        throw MessageError.fromCode('E508', this.messageId, {
          reason: `Missing fragment ${i}`
        });
      }
      result.set(payload, offset);
      offset += payload.length;
    }

    return result;
  }

  /**
   * Gets progress information
   * @returns {any} Progress { received, total, percent }
   */
  getProgress() {
    return {
      received: this.received.size,
      total: this.total,
      percent: Math.round((this.received.size / this.total) * 100)
    };
  }
}

/**
 * Fragment assembler for reconstructing fragmented messages
 * @class Assembler
 */
class Assembler {
  /**
   * Creates a new Assembler
   * @param {number} [timeout] - Timeout for incomplete fragment sets
   */
  constructor(timeout = DEFAULT_TIMEOUT) {
    if (!Number.isInteger(timeout) || timeout <= 0) {
      throw ValidationError.outOfRange('timeout', timeout, { min: 1 });
    }

    /**
     * Timeout for incomplete fragment sets
     * @type {number}
     */
    this.timeout = timeout;

    /**
     * Pending fragment sets by message ID
     * @type {Map<string, PendingFragmentSet>}
     * @private
     */
    this._pending = new Map();

    /**
     * Statistics
     * @type {any}
     * @private
     */
    this._stats = {
      fragmentsReceived: 0,
      messagesAssembled: 0,
      duplicateFragments: 0,
      expiredSets: 0
    };
  }

  /**
   * Adds a fragment and returns assembled payload if complete
   * @param {string} messageId - Message ID
   * @param {Uint8Array} fragmentData - Fragment data with header
   * @returns {Uint8Array|null} Assembled payload or null if incomplete
   */
  addFragment(messageId, fragmentData) {
    if (typeof messageId !== 'string' || messageId.length === 0) {
      throw ValidationError.invalidArgument('messageId', messageId);
    }
    if (!isValidFragment(fragmentData)) {
      throw MessageError.invalidFormat(messageId, {
        reason: 'Invalid fragment data'
      });
    }

    const info = getFragmentInfo(fragmentData);
    this._stats.fragmentsReceived++;

    // Get or create pending set
    let pendingSet = this._pending.get(messageId);
    if (!pendingSet) {
      pendingSet = new PendingFragmentSet(messageId, info.total, this.timeout);
      this._pending.set(messageId, pendingSet);
    }

    // Validate fragment belongs to this set
    if (info.total !== pendingSet.total) {
      throw MessageError.invalidFormat(messageId, {
        reason: 'Fragment total mismatch'
      });
    }

    // Add fragment
    const isNew = pendingSet.addFragment(info.index, info.payload);
    if (!isNew) {
      this._stats.duplicateFragments++;
    }

    // Check if complete
    if (pendingSet.isComplete()) {
      const payload = pendingSet.assemble();
      this._pending.delete(messageId);
      this._stats.messagesAssembled++;
      return payload;
    }

    return null;
  }

  /**
   * Cleans up expired pending fragment sets
   * @returns {string[]} Array of expired message IDs
   */
  cleanup() {
    const expired = [];

    for (const [messageId, pendingSet] of this._pending) {
      if (pendingSet.isExpired()) {
        expired.push(messageId);
        this._pending.delete(messageId);
        this._stats.expiredSets++;
      }
    }

    return expired;
  }

  /**
   * Gets the number of pending fragment sets
   * @returns {number} Count of pending sets
   */
  getPendingCount() {
    return this._pending.size;
  }

  /**
   * Checks if there are pending fragments for a message
   * @param {string} messageId - Message ID to check
   * @returns {boolean} True if there are pending fragments
   */
  hasPending(messageId) {
    return this._pending.has(messageId);
  }

  /**
   * Gets progress for a pending message
   * @param {string} messageId - Message ID
   * @returns {any} Progress or null if not found
   */
  getProgress(messageId) {
    const pendingSet = this._pending.get(messageId);
    return pendingSet ? pendingSet.getProgress() : null;
  }

  /**
   * Removes a pending fragment set
   * @param {string} messageId - Message ID to remove
   * @returns {boolean} True if removed
   */
  removePending(messageId) {
    return this._pending.delete(messageId);
  }

  /**
   * Gets assembler statistics
   * @returns {any} Statistics
   */
  getStats() {
    return {
      ...this._stats,
      pendingCount: this._pending.size
    };
  }

  /**
   * Resets statistics
   */
  resetStats() {
    this._stats = {
      fragmentsReceived: 0,
      messagesAssembled: 0,
      duplicateFragments: 0,
      expiredSets: 0
    };
  }

  /**
   * Clears all pending fragment sets
   */
  clear() {
    this._pending.clear();
  }
}

module.exports = Assembler;
