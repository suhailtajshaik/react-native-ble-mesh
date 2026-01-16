'use strict';

/**
 * @fileoverview Channel class for group messaging
 * @module service/text/channel/Channel
 */

/**
 * Represents a communication channel for group messaging
 * @class Channel
 */
class Channel {
  /**
   * Creates a new Channel
   * @param {Object} options - Channel options
   * @param {string} options.id - Channel ID
   * @param {string} [options.name] - Channel display name
   * @param {string} [options.password] - Channel password (hashed)
   * @param {number} [options.createdAt] - Creation timestamp
   */
  constructor(options) {
    const { id, name, password, createdAt } = options;

    if (!id || typeof id !== 'string') {
      throw new Error('Channel ID is required');
    }

    /** @private */
    this._id = id;
    /** @private */
    this._name = name || id;
    /** @private */
    this._passwordHash = password ? this._hashPassword(password) : null;
    /** @private */
    this._members = new Set();
    /** @private */
    this._createdAt = createdAt || Date.now();
    /** @private */
    this._joinedAt = Date.now();
  }

  /**
   * Returns the channel ID
   * @returns {string}
   */
  getId() {
    return this._id;
  }

  /**
   * Returns the channel name
   * @returns {string}
   */
  getName() {
    return this._name;
  }

  /**
   * Sets the channel name
   * @param {string} name - New channel name
   */
  setName(name) {
    this._name = name;
  }

  /**
   * Returns channel member peer IDs
   * @returns {string[]}
   */
  getMembers() {
    return Array.from(this._members);
  }

  /**
   * Returns the number of members
   * @returns {number}
   */
  getMemberCount() {
    return this._members.size;
  }

  /**
   * Adds a member to the channel
   * @param {string} peerId - Peer ID to add
   * @returns {boolean} True if member was added (not already present)
   */
  addMember(peerId) {
    if (this._members.has(peerId)) {
      return false;
    }
    this._members.add(peerId);
    return true;
  }

  /**
   * Removes a member from the channel
   * @param {string} peerId - Peer ID to remove
   * @returns {boolean} True if member was removed
   */
  removeMember(peerId) {
    return this._members.delete(peerId);
  }

  /**
   * Checks if a peer is a member
   * @param {string} peerId - Peer ID to check
   * @returns {boolean}
   */
  hasMember(peerId) {
    return this._members.has(peerId);
  }

  /**
   * Returns whether the channel is password protected
   * @returns {boolean}
   */
  isPasswordProtected() {
    return this._passwordHash !== null;
  }

  /**
   * Validates a password against the channel password
   * @param {string} password - Password to validate
   * @returns {boolean}
   */
  validatePassword(password) {
    if (!this._passwordHash) {
      return true;
    }
    const hash = this._hashPassword(password);
    return this._constantTimeEqual(this._passwordHash, hash);
  }

  /**
   * Sets a new password for the channel
   * @param {string|null} password - New password or null to remove
   */
  setPassword(password) {
    this._passwordHash = password ? this._hashPassword(password) : null;
  }

  /**
   * Returns the creation timestamp
   * @returns {number}
   */
  getCreatedAt() {
    return this._createdAt;
  }

  /**
   * Returns the joined timestamp
   * @returns {number}
   */
  getJoinedAt() {
    return this._joinedAt;
  }

  /**
   * Converts to JSON representation
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this._id,
      name: this._name,
      memberCount: this._members.size,
      members: Array.from(this._members),
      isPasswordProtected: this.isPasswordProtected(),
      createdAt: this._createdAt,
      joinedAt: this._joinedAt
    };
  }

  /**
   * Creates a Channel from JSON
   * @param {Object} json - JSON object
   * @returns {Channel}
   */
  static fromJSON(json) {
    const channel = new Channel({
      id: json.id,
      name: json.name,
      createdAt: json.createdAt
    });

    if (json.members) {
      json.members.forEach(peerId => channel.addMember(peerId));
    }

    channel._joinedAt = json.joinedAt || Date.now();
    return channel;
  }

  /**
   * Simple password hash function
   * @private
   * @param {string} password - Password to hash
   * @returns {Uint8Array}
   */
  _hashPassword(password) {
    const data = new TextEncoder().encode(password);
    const hash = new Uint8Array(32);
    for (let i = 0; i < data.length; i++) {
      hash[i % 32] ^= data[i];
    }
    return hash;
  }

  /**
   * Constant-time comparison
   * @private
   * @param {Uint8Array} a - First array
   * @param {Uint8Array} b - Second array
   * @returns {boolean}
   */
  _constantTimeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff |= a[i] ^ b[i];
    }
    return diff === 0;
  }
}

module.exports = Channel;
