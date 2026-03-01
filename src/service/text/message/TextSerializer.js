'use strict';

/**
 * @fileoverview Text message serialization helpers
 * @module service/text/message/TextSerializer
 */

/**
 * Text header flags
 * @constant {any}
 */
const TEXT_HEADER_FLAGS = Object.freeze({
  HAS_SENDER: 0x01,
  HAS_RECIPIENT: 0x02,
  HAS_CHANNEL: 0x04,
  IS_READ: 0x08,
  IS_COMPRESSED: 0x10,
  REQUIRES_ACK: 0x20
});

/**
 * Text header size (fixed portion)
 * @constant {number}
 */
const TEXT_HEADER_SIZE = 12;

/**
 * Serializes text content to bytes
 * @param {string} content - Text content
 * @returns {Uint8Array}
 */
function serializeTextPayload(content) {
  return new TextEncoder().encode(content);
}

/**
 * Deserializes bytes to text content
 * @param {Uint8Array} data - Serialized data
 * @returns {string}
 */
function deserializeTextPayload(data) {
  return new TextDecoder().decode(data);
}

/**
 * Creates a text message header
 * @param {Object} options - Header options
 * @param {number} [options.version=1] - Protocol version
 * @param {number} [options.type] - Message type
 * @param {number} [options.timestamp] - Message timestamp
 * @param {number} [options.payloadLength] - Payload length
 * @param {boolean} [options.hasSender] - Has sender ID
 * @param {boolean} [options.hasRecipient] - Has recipient ID
 * @param {boolean} [options.hasChannel] - Has channel ID
 * @param {boolean} [options.isRead] - Is read
 * @param {boolean} [options.requiresAck] - Requires acknowledgment
 * @returns {Uint8Array}
 */
function createTextHeader(options) {
  const {
    version = 1,
    type = 0x01,
    timestamp = Date.now(),
    payloadLength = 0,
    hasSender = false,
    hasRecipient = false,
    hasChannel = false,
    isRead = false,
    requiresAck = false
  } = options;

  const header = new Uint8Array(TEXT_HEADER_SIZE);
  const view = new DataView(header.buffer);

  // Calculate flags
  let flags = 0;
  if (hasSender) { flags |= TEXT_HEADER_FLAGS.HAS_SENDER; }
  if (hasRecipient) { flags |= TEXT_HEADER_FLAGS.HAS_RECIPIENT; }
  if (hasChannel) { flags |= TEXT_HEADER_FLAGS.HAS_CHANNEL; }
  if (isRead) { flags |= TEXT_HEADER_FLAGS.IS_READ; }
  if (requiresAck) { flags |= TEXT_HEADER_FLAGS.REQUIRES_ACK; }

  header[0] = version;
  header[1] = type;
  header[2] = flags;
  header[3] = 0; // reserved
  view.setUint32(4, Math.floor(timestamp / 1000), false); // seconds since epoch
  view.setUint16(8, timestamp % 1000, false); // milliseconds
  view.setUint16(10, payloadLength, false);

  return header;
}

/**
 * Parses a text message header
 * @param {Uint8Array} data - Header data
 * @returns {any}
 */
function parseTextHeader(data) {
  if (data.length < TEXT_HEADER_SIZE) {
    throw new Error('Invalid header: too short');
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const version = data[0];
  const type = data[1];
  const flags = data[2];
  const timestampSec = view.getUint32(4, false);
  const timestampMs = view.getUint16(8, false);
  const payloadLength = view.getUint16(10, false);

  return {
    version,
    type,
    flags,
    timestamp: timestampSec * 1000 + timestampMs,
    payloadLength,
    hasSender: (flags & TEXT_HEADER_FLAGS.HAS_SENDER) !== 0,
    hasRecipient: (flags & TEXT_HEADER_FLAGS.HAS_RECIPIENT) !== 0,
    hasChannel: (flags & TEXT_HEADER_FLAGS.HAS_CHANNEL) !== 0,
    isRead: (flags & TEXT_HEADER_FLAGS.IS_READ) !== 0,
    requiresAck: (flags & TEXT_HEADER_FLAGS.REQUIRES_ACK) !== 0
  };
}

/**
 * Serializes a string with length prefix
 * @param {string} str - String to serialize
 * @param {number} [maxLength=255] - Maximum length
 * @returns {Uint8Array}
 */
function serializeString(str, maxLength = 255) {
  const bytes = new TextEncoder().encode(str);
  const truncated = bytes.slice(0, maxLength);
  const result = new Uint8Array(1 + truncated.length);
  result[0] = truncated.length;
  result.set(truncated, 1);
  return result;
}

/**
 * Deserializes a length-prefixed string
 * @param {Uint8Array} data - Serialized data
 * @param {number} [offset=0] - Starting offset
 * @returns {{ value: string, bytesRead: number }}
 */
function deserializeString(data, offset = 0) {
  const length = data[offset];
  const bytes = data.slice(offset + 1, offset + 1 + length);
  const value = new TextDecoder().decode(bytes);
  return { value, bytesRead: 1 + length };
}

module.exports = {
  TEXT_HEADER_FLAGS,
  TEXT_HEADER_SIZE,
  serializeTextPayload,
  deserializeTextPayload,
  createTextHeader,
  parseTextHeader,
  serializeString,
  deserializeString
};
