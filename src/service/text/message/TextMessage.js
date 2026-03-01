'use strict';

/**
 * @fileoverview Text message class for text-based messaging
 * @module service/text/message/TextMessage
 */

const { generateUUID } = require('../../../utils');

/**
 * Text message for private, broadcast, and channel messaging
 * @class TextMessage
 */
class TextMessage {
  /**
   * Creates a new TextMessage
   * @param {any} options - Message options
   */
  constructor(options) {
    const { id, content, senderId, recipientId, channelId, timestamp, isRead } = options;

    /** @type {string} @private */
    this._id = id || generateUUID();
    /** @type {string} @private */
    this._content = content || '';
    /** @type {string | null} @private */
    this._senderId = senderId || null;
    /** @type {string | null} @private */
    this._recipientId = recipientId || null;
    /** @type {string | null} @private */
    this._channelId = channelId || null;
    /** @type {number} @private */
    this._timestamp = timestamp || Date.now();
    /** @type {boolean} @private */
    this._isRead = isRead || false;
  }

  /**
   * Creates a TextMessage from a string
   * @param {string} content - Message content
   * @param {any} [options] - Additional options
   * @returns {TextMessage}
   */
  static fromString(content, options = {}) {
    return new TextMessage({ content, ...options });
  }

  /**
   * Creates a TextMessage from serialized data
   * @param {Uint8Array} data - Serialized message data
   * @returns {TextMessage}
   */
  static fromSerialized(data) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    // Read header - version is at data[0] (reserved for future use)
    const flags = data[1];
    const timestamp = Number(view.getBigUint64(2, false));
    const contentLength = view.getUint16(10, false);

    let offset = 12;

    // Read sender ID if present
    let senderId = null;
    if (flags & 0x01) {
      senderId = new TextDecoder().decode(data.slice(offset, offset + 36));
      offset += 36;
    }

    // Read recipient ID if present
    let recipientId = null;
    if (flags & 0x02) {
      recipientId = new TextDecoder().decode(data.slice(offset, offset + 36));
      offset += 36;
    }

    // Read channel ID if present
    let channelId = null;
    if (flags & 0x04) {
      const channelIdLength = data[offset];
      offset += 1;
      channelId = new TextDecoder().decode(data.slice(offset, offset + channelIdLength));
      offset += channelIdLength;
    }

    // Read message ID
    const messageIdLength = data[offset];
    offset += 1;
    const id = new TextDecoder().decode(data.slice(offset, offset + messageIdLength));
    offset += messageIdLength;

    // Read content
    const content = new TextDecoder().decode(data.slice(offset, offset + contentLength));

    return new TextMessage({
      id,
      content,
      senderId,
      recipientId,
      channelId,
      timestamp,
      isRead: (flags & 0x08) !== 0
    });
  }

  /**
   * Returns the message ID
   * @returns {string}
   */
  getId() {
    return this._id;
  }

  /**
   * Returns the message content
   * @returns {string}
   */
  getContent() {
    return this._content;
  }

  /**
   * Returns the message content as bytes
   * @returns {Uint8Array}
   */
  getContentBytes() {
    return new TextEncoder().encode(this._content);
  }

  /**
   * Returns the sender ID
   * @returns {string|null}
   */
  getSenderId() {
    return this._senderId;
  }

  /**
   * Returns the recipient ID
   * @returns {string|null}
   */
  getRecipientId() {
    return this._recipientId;
  }

  /**
   * Returns the channel ID
   * @returns {string|null}
   */
  getChannelId() {
    return this._channelId;
  }

  /**
   * Returns the message timestamp
   * @returns {number}
   */
  getTimestamp() {
    return this._timestamp;
  }

  /**
   * Returns whether the message has been read
   * @returns {boolean}
   */
  isRead() {
    return this._isRead;
  }

  /**
   * Marks the message as read
   */
  markAsRead() {
    this._isRead = true;
  }

  /**
   * Serializes the message to bytes
   * @returns {Uint8Array}
   */
  serialize() {
    const contentBytes = this.getContentBytes();
    const idBytes = new TextEncoder().encode(this._id);

    // Calculate flags
    let flags = 0;
    if (this._senderId) { flags |= 0x01; }
    if (this._recipientId) { flags |= 0x02; }
    if (this._channelId) { flags |= 0x04; }
    if (this._isRead) { flags |= 0x08; }

    // Calculate size
    let size = 12 + 1 + idBytes.length + contentBytes.length; // header + id length + id + content
    if (this._senderId) { size += 36; }
    if (this._recipientId) { size += 36; }
    if (this._channelId) {
      const channelIdBytes = new TextEncoder().encode(this._channelId);
      size += 1 + channelIdBytes.length;
    }

    const result = new Uint8Array(size);
    const view = new DataView(result.buffer);

    // Write header
    result[0] = 1; // version
    result[1] = flags;
    view.setBigUint64(2, BigInt(this._timestamp), false);
    view.setUint16(10, contentBytes.length, false);

    let offset = 12;

    // Write sender ID if present
    if (this._senderId) {
      const senderBytes = new TextEncoder().encode(this._senderId.padEnd(36, '\0').slice(0, 36));
      result.set(senderBytes, offset);
      offset += 36;
    }

    // Write recipient ID if present
    if (this._recipientId) {
      const recipientBytes = new TextEncoder().encode(this._recipientId.padEnd(36, '\0').slice(0, 36));
      result.set(recipientBytes, offset);
      offset += 36;
    }

    // Write channel ID if present
    if (this._channelId) {
      const channelIdBytes = new TextEncoder().encode(this._channelId);
      result[offset] = channelIdBytes.length;
      offset += 1;
      result.set(channelIdBytes, offset);
      offset += channelIdBytes.length;
    }

    // Write message ID
    result[offset] = idBytes.length;
    offset += 1;
    result.set(idBytes, offset);
    offset += idBytes.length;

    // Write content
    result.set(contentBytes, offset);

    return result;
  }

  /**
   * Returns message metadata
   * @returns {any}
   */
  getMetadata() {
    return {
      id: this._id,
      senderId: this._senderId,
      recipientId: this._recipientId,
      channelId: this._channelId,
      timestamp: this._timestamp,
      isRead: this._isRead,
      contentLength: this._content.length
    };
  }

  /**
   * Converts to JSON representation
   * @returns {any}
   */
  toJSON() {
    return {
      id: this._id,
      content: this._content,
      senderId: this._senderId,
      recipientId: this._recipientId,
      channelId: this._channelId,
      timestamp: this._timestamp,
      isRead: this._isRead
    };
  }

  /**
   * Creates a TextMessage from JSON
   * @param {any} json - JSON object
   * @returns {TextMessage}
   */
  static fromJSON(json) {
    return new TextMessage(json);
  }
}

module.exports = TextMessage;
