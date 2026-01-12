'use strict';

/**
 * @fileoverview Protocol module exports for BLE Mesh Network library.
 * Provides message serialization, deserialization, and validation.
 * @module protocol
 */

const { crc32, verifyCrc32, CRC32_POLYNOMIAL } = require('./crc32');
const { MessageHeader, HEADER_SIZE, generateUuid } = require('./header');
const { Message } = require('./message');
const { serialize, serializeHeader, serializeBatch } = require('./serializer');
const {
  deserialize,
  deserializeHeader,
  tryDeserialize,
  deserializeBatch,
  peekMessageType,
  peekMessageId
} = require('./deserializer');
const {
  validateMessage,
  validateHeader,
  validateChecksum,
  validateRawMessage,
  isValidMessageType,
  isExpired,
  hasExceededMaxHops
} = require('./validator');

module.exports = {
  // CRC32
  crc32,
  verifyCrc32,
  CRC32_POLYNOMIAL,

  // Header
  MessageHeader,
  HEADER_SIZE,
  generateUuid,

  // Message
  Message,

  // Serialization
  serialize,
  serializeHeader,
  serializeBatch,

  // Deserialization
  deserialize,
  deserializeHeader,
  tryDeserialize,
  deserializeBatch,
  peekMessageType,
  peekMessageId,

  // Validation
  validateMessage,
  validateHeader,
  validateChecksum,
  validateRawMessage,
  isValidMessageType,
  isExpired,
  hasExceededMaxHops
};
