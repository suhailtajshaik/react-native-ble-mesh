'use strict';

/**
 * @fileoverview Message header structure and serialization (48 bytes).
 * @module protocol/header
 */

const { crc32 } = require('./crc32');
const { PROTOCOL_VERSION, MESSAGE_FLAGS, MESH_CONFIG } = require('../constants');
const { MessageError } = require('../errors');

/**
 * Header size in bytes.
 * @constant {number}
 */
const HEADER_SIZE = 48;

/**
 * Message header class representing the 48-byte header structure.
 * @class MessageHeader
 */
class MessageHeader {
  /**
   * Creates a new MessageHeader instance.
   * @param {Object} options - Header options
   * @param {number} [options.version=1] - Protocol version
   * @param {number} options.type - Message type from MESSAGE_TYPE
   * @param {number} [options.flags=0] - Message flags
   * @param {number} [options.hopCount=0] - Current hop count
   * @param {number} [options.maxHops=7] - Maximum hops allowed
   * @param {Uint8Array} options.messageId - 16-byte UUID
   * @param {number} options.timestamp - Unix timestamp in ms
   * @param {number} options.expiresAt - Expiration timestamp in ms
   * @param {number} options.payloadLength - Payload size in bytes
   * @param {number} [options.fragmentIndex=0] - Fragment index (0-based)
   * @param {number} [options.fragmentTotal=1] - Total fragments
   * @param {number} [options.checksum=0] - CRC32 checksum
   */
  constructor(options) {
    this.version = options.version ?? PROTOCOL_VERSION;
    this.type = options.type;
    this.flags = options.flags ?? MESSAGE_FLAGS.NONE;
    this.hopCount = options.hopCount ?? 0;
    this.maxHops = options.maxHops ?? MESH_CONFIG.MAX_HOPS;
    this.reserved = new Uint8Array(3);
    this.messageId = options.messageId;
    this.timestamp = options.timestamp;
    this.expiresAt = options.expiresAt;
    this.payloadLength = options.payloadLength;
    this.fragmentIndex = options.fragmentIndex ?? 0;
    this.fragmentTotal = options.fragmentTotal ?? 1;
    this.checksum = options.checksum ?? 0;
  }

  /**
   * Creates a new MessageHeader with generated UUID and timestamps.
   * @param {Object} options - Header creation options
   * @param {number} options.type - Message type
   * @param {number} [options.flags=0] - Message flags
   * @param {number} [options.maxHops=7] - Maximum hops
   * @param {number} options.payloadLength - Payload size
   * @param {number} [options.fragmentIndex=0] - Fragment index
   * @param {number} [options.fragmentTotal=1] - Total fragments
   * @param {number} [options.ttlMs] - Time-to-live in ms
   * @returns {MessageHeader} New header instance
   */
  static create(options) {
    const now = Date.now();
    const ttl = options.ttlMs ?? MESH_CONFIG.MESSAGE_TTL_MS;

    return new MessageHeader({
      version: PROTOCOL_VERSION,
      type: options.type,
      flags: options.flags ?? MESSAGE_FLAGS.NONE,
      hopCount: 0,
      maxHops: options.maxHops ?? MESH_CONFIG.MAX_HOPS,
      messageId: generateUuid(),
      timestamp: now,
      expiresAt: now + ttl,
      payloadLength: options.payloadLength,
      fragmentIndex: options.fragmentIndex ?? 0,
      fragmentTotal: options.fragmentTotal ?? 1,
      checksum: 0
    });
  }

  /**
   * Deserializes a header from bytes.
   * @param {Uint8Array} data - 48-byte header data
   * @returns {MessageHeader} Parsed header
   * @throws {MessageError} If data is invalid
   */
  static fromBytes(data) {
    if (!(data instanceof Uint8Array) || data.length < HEADER_SIZE) {
      throw MessageError.invalidFormat(null, { reason: 'Header too small' });
    }

    const view = new DataView(data.buffer, data.byteOffset, HEADER_SIZE);

    return new MessageHeader({
      version: data[0],
      type: data[1],
      flags: data[2],
      hopCount: data[3],
      maxHops: data[4],
      messageId: data.slice(8, 24),
      timestamp: readUint64BE(view, 24),
      expiresAt: readUint64BE(view, 32),
      payloadLength: view.getUint16(40, false),
      fragmentIndex: data[42],
      fragmentTotal: data[43],
      checksum: view.getUint32(44, false)
    });
  }

  /**
   * Serializes the header to bytes.
   * @returns {Uint8Array} 48-byte header
   */
  toBytes() {
    return MessageHeader.toBytes(this);
  }

  /**
   * Serializes a header to bytes.
   * @param {MessageHeader} header - Header to serialize
   * @returns {Uint8Array} 48-byte header
   */
  static toBytes(header) {
    const buffer = new Uint8Array(HEADER_SIZE);
    const view = new DataView(buffer.buffer);

    buffer[0] = header.version;
    buffer[1] = header.type;
    buffer[2] = header.flags;
    buffer[3] = header.hopCount;
    buffer[4] = header.maxHops;
    // bytes 5-7 reserved (zeros)
    buffer.set(header.messageId, 8);
    writeUint64BE(view, 24, header.timestamp);
    writeUint64BE(view, 32, header.expiresAt);
    view.setUint16(40, header.payloadLength, false);
    buffer[42] = header.fragmentIndex;
    buffer[43] = header.fragmentTotal;
    // Calculate checksum over header without checksum field
    const checksumData = buffer.slice(0, 44);
    const checksum = crc32(checksumData);
    view.setUint32(44, checksum, false);
    header.checksum = checksum;

    return buffer;
  }

  /**
   * Returns the message ID as a hex string.
   * @returns {string} UUID hex string
   */
  getMessageIdHex() {
    return bytesToHex(this.messageId);
  }
}

/**
 * Generates a random 16-byte UUID.
 * @returns {Uint8Array} 16-byte UUID
 */
function generateUuid() {
  const uuid = new Uint8Array(16);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(uuid);
  } else {
    const nodeCrypto = require('crypto');
    const randomBuffer = nodeCrypto.randomBytes(16);
    uuid.set(randomBuffer);
  }
  // Set version 4 (random) and variant bits
  uuid[6] = (uuid[6] & 0x0f) | 0x40;
  uuid[8] = (uuid[8] & 0x3f) | 0x80;
  return uuid;
}

/**
 * Reads a 64-bit unsigned integer (big-endian) from DataView.
 * @param {DataView} view - DataView to read from
 * @param {number} offset - Byte offset
 * @returns {number} 64-bit value (may lose precision for large values)
 */
function readUint64BE(view, offset) {
  const high = view.getUint32(offset, false);
  const low = view.getUint32(offset + 4, false);
  return high * 0x100000000 + low;
}

/**
 * Writes a 64-bit unsigned integer (big-endian) to DataView.
 * @param {DataView} view - DataView to write to
 * @param {number} offset - Byte offset
 * @param {number} value - Value to write
 */
function writeUint64BE(view, offset, value) {
  const high = Math.floor(value / 0x100000000);
  const low = value >>> 0;
  view.setUint32(offset, high, false);
  view.setUint32(offset + 4, low, false);
}

/**
 * Converts bytes to hex string.
 * @param {Uint8Array} bytes - Bytes to convert
 * @returns {string} Hex string
 */
function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

module.exports = {
  MessageHeader,
  HEADER_SIZE,
  generateUuid
};
