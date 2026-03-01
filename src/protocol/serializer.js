'use strict';

/**
 * @fileoverview Binary serialization for mesh protocol messages.
 * @module protocol/serializer
 */

const { HEADER_SIZE } = require('./header');
const { Message } = require('./message');
const { crc32 } = require('./crc32');
const { PROTOCOL_VERSION, MESSAGE_FLAGS, MESH_CONFIG } = require('../constants');
const { MessageError } = require('../errors');

/**
 * Serializes a message header to bytes.
 * Calculates CRC32 checksum and includes it in the output.
 *
 * @param {any} header - Header to serialize
 * @returns {Uint8Array} 48-byte serialized header
 * @throws {MessageError} If header is invalid
 *
 * @example
 * const header = MessageHeader.create({ type: MESSAGE_TYPE.TEXT, payloadLength: 5 });
 * const bytes = serializeHeader(header);
 */
function serializeHeader(header) {
  if (!header || typeof header !== 'object') {
    throw MessageError.invalidFormat(null, { reason: 'Header must be an object' });
  }

  const buffer = new Uint8Array(HEADER_SIZE);
  const view = new DataView(buffer.buffer);

  // Validate required fields
  if (header.messageId === null || header.messageId === undefined || header.messageId.length !== 16) {
    throw new Error('Invalid messageId');
  }

  // Byte 0: version
  buffer[0] = header.version ?? PROTOCOL_VERSION;

  // Byte 1: type
  buffer[1] = header.type;

  // Byte 2: flags
  buffer[2] = header.flags ?? MESSAGE_FLAGS.NONE;

  // Byte 3: hopCount
  buffer[3] = header.hopCount ?? 0;

  // Byte 4: maxHops
  buffer[4] = header.maxHops ?? MESH_CONFIG.MAX_HOPS;

  // Bytes 5-7: reserved (already zeros)

  // Bytes 8-23: messageId (16 bytes)
  buffer.set(header.messageId, 8);

  // Bytes 24-31: timestamp (big-endian uint64)
  writeUint64BE(view, 24, header.timestamp);

  // Bytes 32-39: expiresAt (big-endian uint64)
  writeUint64BE(view, 32, header.expiresAt);

  // Bytes 40-41: payloadLength (big-endian uint16)
  view.setUint16(40, header.payloadLength, false);

  // Byte 42: fragmentIndex
  buffer[42] = header.fragmentIndex ?? 0;

  // Byte 43: fragmentTotal
  buffer[43] = header.fragmentTotal ?? 1;

  // Bytes 44-47: checksum (calculated over bytes 0-43, subarray = zero-copy view)
  const checksum = crc32(buffer.subarray(0, 44));
  view.setUint32(44, checksum, false);

  return buffer;
}

/**
 * Serializes a complete message (header + payload) to bytes.
 *
 * @param {any} message - Message to serialize
 * @returns {Uint8Array} Serialized message bytes
 * @throws {MessageError} If message is invalid
 *
 * @example
 * const message = Message.create({ type: MESSAGE_TYPE.TEXT, payload: 'Hello' });
 * const bytes = serialize(message);
 */
function serialize(message) {
  if (!message || typeof message !== 'object') {
    throw MessageError.invalidFormat(null, { reason: 'Message must be an object' });
  }

  // Handle Message instances
  if (message instanceof Message) {
    return message.toBytes();
  }

  // Handle plain objects with header and payload
  const header = message.header;
  let payload = message.payload;

  if (!header) {
    throw MessageError.invalidFormat(null, { reason: 'Message must have a header' });
  }

  // Convert string payload to bytes
  if (typeof payload === 'string') {
    if (!(/** @type {any} */ (serialize))._encoder) { /** @type {any} */ (serialize)._encoder = new TextEncoder(); }
    payload = /** @type {any} */ (serialize)._encoder.encode(payload);
  }

  // Default to empty payload
  if (!payload) {
    payload = new Uint8Array(0);
  }

  if (!(payload instanceof Uint8Array)) {
    throw MessageError.invalidFormat(null, { reason: 'Payload must be Uint8Array or string' });
  }

  // Update payloadLength directly (avoids object spread allocation)
  header.payloadLength = payload.length;

  const headerBytes = serializeHeader(header);
  const result = new Uint8Array(headerBytes.length + payload.length);

  result.set(headerBytes, 0);
  result.set(payload, headerBytes.length);

  return result;
}

/**
 * Writes a 64-bit unsigned integer in big-endian format.
 * JavaScript numbers can safely represent integers up to 2^53.
 *
 * @param {DataView} view - DataView to write to
 * @param {number} offset - Byte offset
 * @param {number} value - Value to write
 */
function writeUint64BE(view, offset, value) {
  // Split into high and low 32-bit parts
  const high = Math.floor(value / 0x100000000);
  const low = value >>> 0;

  view.setUint32(offset, high, false);
  view.setUint32(offset + 4, low, false);
}

/**
 * Serializes multiple messages into a single buffer.
 * Useful for batch transmission.
 *
 * @param {Array<Message>} messages - Array of messages
 * @returns {Uint8Array} Concatenated message bytes
 */
function serializeBatch(messages) {
  if (!Array.isArray(messages)) {
    throw MessageError.invalidFormat(null, { reason: 'Messages must be an array' });
  }

  const serialized = messages.map(msg => serialize(msg));
  const totalLength = serialized.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);

  let offset = 0;
  for (const bytes of serialized) {
    result.set(bytes, offset);
    offset += bytes.length;
  }

  return result;
}

module.exports = {
  serialize,
  serializeHeader,
  serializeBatch
};
