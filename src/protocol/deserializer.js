'use strict';

/**
 * @fileoverview Binary deserialization for mesh protocol messages.
 * @module protocol/deserializer
 */

const { MessageHeader, HEADER_SIZE } = require('./header');
const { Message } = require('./message');
const { crc32, verifyCrc32 } = require('./crc32');
const { MessageError } = require('../errors');

/**
 * Deserializes a message header from bytes.
 * Validates minimum length and verifies checksum.
 *
 * @param {Uint8Array} data - Raw header bytes (minimum 48 bytes)
 * @returns {MessageHeader} Parsed header
 * @throws {MessageError} If data is invalid or checksum fails
 *
 * @example
 * const header = deserializeHeader(headerBytes);
 * console.log(header.type, header.messageId);
 */
function deserializeHeader(data) {
  // Validate input type
  if (!(data instanceof Uint8Array)) {
    throw MessageError.invalidFormat(null, {
      reason: 'Data must be a Uint8Array'
    });
  }

  // Validate minimum length
  if (data.length < HEADER_SIZE) {
    throw MessageError.invalidFormat(null, {
      reason: 'Data too short for header',
      expected: HEADER_SIZE,
      actual: data.length
    });
  }

  const headerData = data.slice(0, HEADER_SIZE);
  const view = new DataView(headerData.buffer, headerData.byteOffset, HEADER_SIZE);

  // Extract checksum from bytes 44-47 (big-endian)
  const storedChecksum = view.getUint32(44, false);

  // Calculate checksum over bytes 0-43
  const checksumData = headerData.slice(0, 44);
  const calculatedChecksum = crc32(checksumData);

  // Verify checksum
  if (storedChecksum !== calculatedChecksum) {
    throw MessageError.invalidChecksum(null, {
      stored: storedChecksum.toString(16),
      calculated: calculatedChecksum.toString(16)
    });
  }

  // Parse header fields
  const header = new MessageHeader({
    version: headerData[0],
    type: headerData[1],
    flags: headerData[2],
    hopCount: headerData[3],
    maxHops: headerData[4],
    // bytes 5-7 are reserved
    messageId: headerData.slice(8, 24),
    timestamp: readUint64BE(view, 24),
    expiresAt: readUint64BE(view, 32),
    payloadLength: view.getUint16(40, false),
    fragmentIndex: headerData[42],
    fragmentTotal: headerData[43],
    checksum: storedChecksum
  });

  return header;
}

/**
 * Deserializes a complete message (header + payload) from bytes.
 * Validates header checksum and payload length.
 *
 * @param {Uint8Array} data - Raw message bytes
 * @returns {Message} Parsed message
 * @throws {MessageError} If data is invalid
 *
 * @example
 * const message = deserialize(rawBytes);
 * console.log(message.getContent());
 */
function deserialize(data) {
  // Validate input type
  if (!(data instanceof Uint8Array)) {
    throw MessageError.invalidFormat(null, {
      reason: 'Data must be a Uint8Array'
    });
  }

  // Validate minimum length for header
  if (data.length < HEADER_SIZE) {
    throw MessageError.invalidFormat(null, {
      reason: 'Data too short for message',
      minSize: HEADER_SIZE,
      actual: data.length
    });
  }

  // Parse header first
  const header = deserializeHeader(data);

  // Validate total message length
  const expectedLength = HEADER_SIZE + header.payloadLength;

  if (data.length < expectedLength) {
    throw MessageError.invalidFormat(header.getMessageIdHex(), {
      reason: 'Incomplete payload',
      expected: expectedLength,
      actual: data.length
    });
  }

  // Extract payload
  const payload = data.slice(HEADER_SIZE, HEADER_SIZE + header.payloadLength);

  return new Message(header, payload);
}

/**
 * Attempts to deserialize a message, returning null on failure.
 * Useful when processing potentially malformed data.
 *
 * @param {Uint8Array} data - Raw message bytes
 * @returns {Message|null} Parsed message or null if invalid
 */
function tryDeserialize(data) {
  try {
    return deserialize(data);
  } catch (error) {
    return null;
  }
}

/**
 * Deserializes multiple messages from a concatenated buffer.
 * Stops at first invalid message.
 *
 * @param {Uint8Array} data - Buffer containing multiple messages
 * @returns {Array<Message>} Array of parsed messages
 */
function deserializeBatch(data) {
  if (!(data instanceof Uint8Array)) {
    throw MessageError.invalidFormat(null, {
      reason: 'Data must be a Uint8Array'
    });
  }

  const messages = [];
  let offset = 0;

  while (offset < data.length) {
    // Need at least header size remaining
    if (data.length - offset < HEADER_SIZE) {
      break;
    }

    // Peek at payload length to know full message size
    const view = new DataView(data.buffer, data.byteOffset + offset, HEADER_SIZE);
    const payloadLength = view.getUint16(40, false);
    const messageLength = HEADER_SIZE + payloadLength;

    // Check if we have the complete message
    if (data.length - offset < messageLength) {
      break;
    }

    // Extract and deserialize this message
    const messageData = data.slice(offset, offset + messageLength);

    try {
      const message = deserialize(messageData);
      messages.push(message);
      offset += messageLength;
    } catch (error) {
      // Stop on first error
      break;
    }
  }

  return messages;
}

/**
 * Reads a 64-bit unsigned integer in big-endian format.
 * JavaScript numbers can safely represent integers up to 2^53.
 *
 * @param {DataView} view - DataView to read from
 * @param {number} offset - Byte offset
 * @returns {number} 64-bit value
 */
function readUint64BE(view, offset) {
  const high = view.getUint32(offset, false);
  const low = view.getUint32(offset + 4, false);
  return high * 0x100000000 + low;
}

/**
 * Peeks at message type without full deserialization.
 * Useful for routing decisions.
 *
 * @param {Uint8Array} data - Raw message bytes
 * @returns {number|null} Message type or null if invalid
 */
function peekMessageType(data) {
  if (!(data instanceof Uint8Array) || data.length < 2) {
    return null;
  }
  return data[1];
}

/**
 * Peeks at message ID without full deserialization.
 *
 * @param {Uint8Array} data - Raw message bytes
 * @returns {Uint8Array|null} 16-byte message ID or null if invalid
 */
function peekMessageId(data) {
  if (!(data instanceof Uint8Array) || data.length < 24) {
    return null;
  }
  return data.slice(8, 24);
}

module.exports = {
  deserialize,
  deserializeHeader,
  tryDeserialize,
  deserializeBatch,
  peekMessageType,
  peekMessageId
};
