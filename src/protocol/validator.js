'use strict';

/**
 * @fileoverview Message and header validation for mesh protocol.
 * @module protocol/validator
 */

const { HEADER_SIZE } = require('./header');
const { crc32 } = require('./crc32');
const { PROTOCOL_VERSION, MESSAGE_TYPE, MESH_CONFIG } = require('../constants');

/**
 * Set of valid message type values for fast lookup.
 * @type {Set<number>}
 */
const VALID_MESSAGE_TYPES = new Set(Object.values(MESSAGE_TYPE));

/**
 * Cached frozen result for valid validations to avoid repeated allocations.
 * @type {{ valid: boolean, errors: string[] }}
 */
const VALID_RESULT = Object.freeze({ valid: true, errors: Object.freeze([]) });

/**
 * Validates a message header.
 *
 * @param {MessageHeader|Object} header - Header to validate
 * @returns {{ valid: boolean, errors: string[] }} Validation result
 *
 * @example
 * const result = validateHeader(header);
 * if (!result.valid) {
 *   console.error('Header errors:', result.errors);
 * }
 */
function validateHeader(header) {
  const errors = [];

  if (!header || typeof header !== 'object') {
    return { valid: false, errors: ['Header must be an object'] };
  }

  // Validate protocol version
  if (header.version !== PROTOCOL_VERSION) {
    errors.push(`Unsupported protocol version: ${header.version}, expected: ${PROTOCOL_VERSION}`);
  }

  // Validate message type
  if (!VALID_MESSAGE_TYPES.has(header.type)) {
    errors.push(`Invalid message type: 0x${header.type?.toString(16) ?? 'undefined'}`);
  }

  // Validate hop count
  if (typeof header.hopCount !== 'number' || header.hopCount < 0) {
    errors.push(`Invalid hop count: ${header.hopCount}`);
  }

  // Validate max hops
  if (typeof header.maxHops !== 'number' || header.maxHops < 1) {
    errors.push(`Invalid max hops: ${header.maxHops}`);
  }

  // Validate hop count vs max hops
  if (header.hopCount > header.maxHops) {
    errors.push(`Hop count (${header.hopCount}) exceeds max hops (${header.maxHops})`);
  }

  // Validate message ID
  if (!header.messageId || !(header.messageId instanceof Uint8Array)) {
    errors.push('Message ID must be a Uint8Array');
  } else if (header.messageId.length !== 16) {
    errors.push(`Message ID must be 16 bytes, got ${header.messageId.length}`);
  }

  // Validate timestamps
  if (typeof header.timestamp !== 'number' || header.timestamp <= 0) {
    errors.push(`Invalid timestamp: ${header.timestamp}`);
  }

  if (typeof header.expiresAt !== 'number' || header.expiresAt <= 0) {
    errors.push(`Invalid expiresAt: ${header.expiresAt}`);
  }

  // Check if expired
  if (header.expiresAt <= Date.now()) {
    errors.push('Message has expired');
  }

  // Validate payload length
  if (typeof header.payloadLength !== 'number' || header.payloadLength < 0) {
    errors.push(`Invalid payload length: ${header.payloadLength}`);
  }

  if (header.payloadLength > MESH_CONFIG.MAX_MESSAGE_SIZE) {
    errors.push(`Payload too large: ${header.payloadLength} > ${MESH_CONFIG.MAX_MESSAGE_SIZE}`);
  }

  // Validate fragment fields
  if (typeof header.fragmentIndex !== 'number' || header.fragmentIndex < 0) {
    errors.push(`Invalid fragment index: ${header.fragmentIndex}`);
  }

  if (typeof header.fragmentTotal !== 'number' || header.fragmentTotal < 1) {
    errors.push(`Invalid fragment total: ${header.fragmentTotal}`);
  }

  if (header.fragmentIndex >= header.fragmentTotal) {
    errors.push(`Fragment index (${header.fragmentIndex}) >= total (${header.fragmentTotal})`);
  }

  if (errors.length === 0) {
    return VALID_RESULT;
  }

  return {
    valid: false,
    errors
  };
}

/**
 * Validates a complete message (header + payload).
 *
 * @param {Message|Object} message - Message to validate
 * @returns {{ valid: boolean, errors: string[] }} Validation result
 *
 * @example
 * const result = validateMessage(message);
 * if (!result.valid) {
 *   console.error('Message errors:', result.errors);
 * }
 */
function validateMessage(message) {
  const errors = [];

  if (!message || typeof message !== 'object') {
    return { valid: false, errors: ['Message must be an object'] };
  }

  // Validate header exists
  if (!message.header) {
    errors.push('Message must have a header');
    return { valid: false, errors };
  }

  // Validate header
  const headerResult = validateHeader(message.header);
  errors.push(...headerResult.errors);

  // Validate payload exists
  if (!message.payload) {
    errors.push('Message must have a payload');
  } else if (!(message.payload instanceof Uint8Array)) {
    errors.push('Payload must be a Uint8Array');
  } else {
    // Validate payload length matches header
    if (message.payload.length !== message.header.payloadLength) {
      errors.push(
        `Payload length mismatch: header says ${message.header.payloadLength}, ` +
        `actual is ${message.payload.length}`
      );
    }
  }

  if (errors.length === 0) {
    return VALID_RESULT;
  }

  return {
    valid: false,
    errors
  };
}

/**
 * Validates message checksum against the header data.
 *
 * @param {Uint8Array} headerBytes - Raw 48-byte header
 * @returns {{ valid: boolean, expected: number, actual: number }} Checksum result
 */
function validateChecksum(headerBytes) {
  if (!(headerBytes instanceof Uint8Array) || headerBytes.length < HEADER_SIZE) {
    return { valid: false, expected: 0, actual: 0 };
  }

  const view = new DataView(headerBytes.buffer, headerBytes.byteOffset, HEADER_SIZE);
  const storedChecksum = view.getUint32(44, false);
  const checksumData = headerBytes.subarray(0, 44);
  const calculatedChecksum = crc32(checksumData);

  return {
    valid: storedChecksum === calculatedChecksum,
    expected: storedChecksum,
    actual: calculatedChecksum
  };
}

/**
 * Checks if a message type is valid.
 *
 * @param {number} type - Message type to check
 * @returns {boolean} True if valid
 */
function isValidMessageType(type) {
  return VALID_MESSAGE_TYPES.has(type);
}

/**
 * Checks if a message is expired.
 *
 * @param {Message|MessageHeader|Object} messageOrHeader - Message or header
 * @returns {boolean} True if expired
 */
function isExpired(messageOrHeader) {
  const header = messageOrHeader.header || messageOrHeader;
  return header.expiresAt <= Date.now();
}

/**
 * Checks if hop count has exceeded maximum.
 *
 * @param {Message|MessageHeader|Object} messageOrHeader - Message or header
 * @returns {boolean} True if exceeded
 */
function hasExceededMaxHops(messageOrHeader) {
  const header = messageOrHeader.header || messageOrHeader;
  return header.hopCount > header.maxHops;
}

/**
 * Validates raw bytes can be parsed as a valid message.
 * Does not fully parse, just validates structure.
 *
 * @param {Uint8Array} data - Raw message bytes
 * @returns {{ valid: boolean, errors: string[] }} Validation result
 */
function validateRawMessage(data) {
  const errors = [];

  if (!(data instanceof Uint8Array)) {
    return { valid: false, errors: ['Data must be a Uint8Array'] };
  }

  if (data.length < HEADER_SIZE) {
    return { valid: false, errors: [`Data too short: ${data.length} < ${HEADER_SIZE}`] };
  }

  // Check version
  if (data[0] !== PROTOCOL_VERSION) {
    errors.push(`Unsupported version: ${data[0]}`);
  }

  // Check message type
  if (!VALID_MESSAGE_TYPES.has(data[1])) {
    errors.push(`Invalid message type: 0x${data[1].toString(16)}`);
  }

  // Validate checksum
  const checksumResult = validateChecksum(data.subarray(0, HEADER_SIZE));
  if (!checksumResult.valid) {
    errors.push(
      `Checksum mismatch: expected 0x${checksumResult.expected.toString(16)}, ` +
      `got 0x${checksumResult.actual.toString(16)}`
    );
  }

  // Check payload length
  const view = new DataView(data.buffer, data.byteOffset, HEADER_SIZE);
  const payloadLength = view.getUint16(40, false);
  const expectedTotal = HEADER_SIZE + payloadLength;

  if (data.length < expectedTotal) {
    errors.push(`Incomplete message: expected ${expectedTotal} bytes, got ${data.length}`);
  }

  if (errors.length === 0) {
    return VALID_RESULT;
  }

  return {
    valid: false,
    errors
  };
}

module.exports = {
  validateMessage,
  validateHeader,
  validateChecksum,
  validateRawMessage,
  isValidMessageType,
  isExpired,
  hasExceededMaxHops
};
