'use strict';

/**
 * @fileoverview Message container class combining header and payload.
 * @module protocol/message
 */

const { MessageHeader, HEADER_SIZE, generateUuid } = require('./header');
const { MESSAGE_FLAGS, MESH_CONFIG } = require('../constants');
const { MessageError } = require('../errors');

// Cached TextEncoder/TextDecoder singletons (avoids per-call allocation)
/** @type {any} */ let _encoder = null;
/** @type {any} */ let _decoder = null;
function _getEncoder() {
  if (!_encoder) { _encoder = new TextEncoder(); }
  return _encoder;
}
function _getDecoder() {
  if (!_decoder) { _decoder = new TextDecoder(); }
  return _decoder;
}

/**
 * Message class representing a complete mesh network message.
 * @class Message
 */
class Message {
  /**
   * Creates a new Message instance.
   * @param {any} header - Message header
   * @param {Uint8Array} payload - Message payload
   */
  constructor(header, payload) {
    /** @type {any} */
    this.header = header;
    /** @type {Uint8Array} */
    this.payload = payload;
  }

  /**
   * Creates a new message with the given options.
   * @param {any} options - Message options   *
   * @returns {Message} New message instance
   */
  static create(options) {
    let payload = options.payload;

    // Convert string payload to bytes
    if (typeof payload === 'string') {
      payload = _getEncoder().encode(payload);
    }

    if (!(payload instanceof Uint8Array)) {
      payload = new Uint8Array(0);
    }

    const now = Date.now();
    const ttl = options.ttlMs ?? MESH_CONFIG.MESSAGE_TTL_MS;

    const header = new MessageHeader({
      type: options.type,
      flags: options.flags ?? MESSAGE_FLAGS.NONE,
      maxHops: options.maxHops ?? MESH_CONFIG.MAX_HOPS,
      messageId: options.messageId ?? generateUuid(),
      timestamp: now,
      expiresAt: now + ttl,
      payloadLength: payload.length,
      fragmentIndex: options.fragmentIndex ?? 0,
      fragmentTotal: options.fragmentTotal ?? 1
    });

    return new Message(header, payload);
  }

  /**
   * Deserializes a message from bytes.
   * @param {Uint8Array} data - Raw message bytes
   * @returns {Message} Parsed message
   * @throws {MessageError} If data is invalid
   */
  static fromBytes(data) {
    if (!(data instanceof Uint8Array)) {
      throw MessageError.invalidFormat(null, { reason: 'Data must be Uint8Array' });
    }

    if (data.length < HEADER_SIZE) {
      throw MessageError.invalidFormat(null, {
        reason: 'Message too small',
        size: data.length,
        minSize: HEADER_SIZE
      });
    }

    const header = MessageHeader.fromBytes(data);
    const expectedLength = HEADER_SIZE + header.payloadLength;

    if (data.length < expectedLength) {
      throw MessageError.invalidFormat(header.getMessageIdHex(), {
        reason: 'Incomplete payload',
        expected: expectedLength,
        actual: data.length
      });
    }

    const payload = data.subarray(HEADER_SIZE, HEADER_SIZE + header.payloadLength);

    return new Message(header, payload);
  }

  /**
   * Serializes the message to bytes.
   * @returns {Uint8Array} Complete message bytes
   */
  toBytes() {
    const headerBytes = this.header.toBytes();
    const result = new Uint8Array(headerBytes.length + this.payload.length);
    result.set(headerBytes, 0);
    result.set(this.payload, headerBytes.length);
    return result;
  }

  /**
   * Checks if the message has expired.
   * @returns {boolean} True if expired
   */
  isExpired() {
    return Date.now() > this.header.expiresAt;
  }

  /**
   * Checks if the message is a fragment.
   * @returns {boolean} True if this is a fragment
   */
  isFragment() {
    return this.header.fragmentTotal > 1 ||
      (this.header.flags & MESSAGE_FLAGS.IS_FRAGMENT) !== 0;
  }

  /**
   * Checks if the message payload is encrypted.
   * @returns {boolean} True if encrypted
   */
  isEncrypted() {
    return (this.header.flags & MESSAGE_FLAGS.ENCRYPTED) !== 0;
  }

  /**
   * Checks if the message requires acknowledgment.
   * @returns {boolean} True if ACK required
   */
  requiresAck() {
    return (this.header.flags & MESSAGE_FLAGS.REQUIRES_ACK) !== 0;
  }

  /**
   * Checks if the message is a broadcast.
   * @returns {boolean} True if broadcast
   */
  isBroadcast() {
    return (this.header.flags & MESSAGE_FLAGS.IS_BROADCAST) !== 0;
  }

  /**
   * Checks if the message is high priority.
   * @returns {boolean} True if high priority
   */
  isHighPriority() {
    return (this.header.flags & MESSAGE_FLAGS.HIGH_PRIORITY) !== 0;
  }

  /**
   * Gets the payload content as a UTF-8 string.
   * Only meaningful for text message types.
   * @returns {string} Decoded payload content
   */
  getContent() {
    return _getDecoder().decode(this.payload);
  }

  /**
   * Gets the message ID as a hex string.
   * @returns {string} Message ID hex string
   */
  getMessageId() {
    return this.header.getMessageIdHex();
  }

  /**
   * Gets the total size of the message in bytes.
   * @returns {number} Total message size
   */
  getSize() {
    return HEADER_SIZE + this.payload.length;
  }

  /**
   * Increments the hop count. Used when relaying messages.
   * @throws {MessageError} If max hops exceeded
   */
  incrementHopCount() {
    if (this.header.hopCount >= this.header.maxHops) {
      throw MessageError.maxHopsExceeded(this.getMessageId(), {
        hopCount: this.header.hopCount,
        maxHops: this.header.maxHops
      });
    }
    this.header.hopCount++;
  }

  /**
   * Creates a clone of this message.
   * @returns {Message} Cloned message
   */
  clone() {
    const headerClone = new MessageHeader({
      version: this.header.version,
      type: this.header.type,
      flags: this.header.flags,
      hopCount: this.header.hopCount,
      maxHops: this.header.maxHops,
      messageId: new Uint8Array(this.header.messageId),
      timestamp: this.header.timestamp,
      expiresAt: this.header.expiresAt,
      payloadLength: this.header.payloadLength,
      fragmentIndex: this.header.fragmentIndex,
      fragmentTotal: this.header.fragmentTotal,
      checksum: this.header.checksum
    });

    return new Message(headerClone, new Uint8Array(this.payload));
  }
}

module.exports = {
  Message
};
