'use strict';

/**
 * @fileoverview UUID generation and manipulation utilities
 * @module utils/uuid
 */

const { randomBytes } = require('./bytes');
const { bytesToHex, hexToBytes } = require('./encoding');

/**
 * UUID v4 regex pattern
 * @private
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Generates a UUID v4 (random)
 * @returns {string} UUID string in format xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
function generateUUID() {
  const bytes = randomBytes(16);

  // Set version (4) in byte 6
  bytes[6] = (bytes[6] & 0x0f) | 0x40;

  // Set variant (10xx) in byte 8
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytesToHex(bytes);

  return (
    `${hex.substring(0, 8)}-${
      hex.substring(8, 12)}-${
      hex.substring(12, 16)}-${
      hex.substring(16, 20)}-${
      hex.substring(20, 32)}`
  );
}

/**
 * Converts a UUID string to a 16-byte array
 * @param {string} uuid - UUID string
 * @returns {Uint8Array} 16-byte array
 * @throws {Error} If UUID format is invalid
 */
function uuidToBytes(uuid) {
  if (typeof uuid !== 'string') {
    throw new Error('UUID must be a string');
  }

  // Remove dashes
  const hex = uuid.replace(/-/g, '');

  if (hex.length !== 32) {
    throw new Error('Invalid UUID format');
  }

  return hexToBytes(hex);
}

/**
 * Converts a 16-byte array to a UUID string
 * @param {Uint8Array} bytes - 16-byte array
 * @returns {string} UUID string
 * @throws {Error} If bytes length is not 16
 */
function bytesToUuid(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new Error('Input must be a Uint8Array');
  }

  if (bytes.length !== 16) {
    throw new Error('UUID must be exactly 16 bytes');
  }

  const hex = bytesToHex(bytes);

  return (
    `${hex.substring(0, 8)}-${
      hex.substring(8, 12)}-${
      hex.substring(12, 16)}-${
      hex.substring(16, 20)}-${
      hex.substring(20, 32)}`
  );
}

/**
 * Validates a UUID string format
 * @param {string} uuid - UUID string to validate
 * @returns {boolean} True if valid UUID v4 format
 */
function isValidUUID(uuid) {
  if (typeof uuid !== 'string') {
    return false;
  }

  return UUID_REGEX.test(uuid);
}

/**
 * Generates a short ID (8 hex characters) for display purposes
 * Not guaranteed to be unique, use for UI display only
 * @returns {string} 8-character hex string
 */
function generateShortId() {
  return bytesToHex(randomBytes(4));
}

/**
 * Extracts the first 8 characters of a UUID for display
 * @param {string} uuid - Full UUID string
 * @returns {string} Shortened UUID
 */
function shortenUUID(uuid) {
  if (typeof uuid !== 'string') {
    return '';
  }

  return uuid.substring(0, 8);
}

/**
 * Compares two UUIDs for equality (case-insensitive)
 * @param {string} uuid1 - First UUID
 * @param {string} uuid2 - Second UUID
 * @returns {boolean} True if UUIDs are equal
 */
function compareUUID(uuid1, uuid2) {
  if (typeof uuid1 !== 'string' || typeof uuid2 !== 'string') {
    return false;
  }

  return uuid1.toLowerCase() === uuid2.toLowerCase();
}

module.exports = {
  generateUUID,
  uuidToBytes,
  bytesToUuid,
  isValidUUID,
  generateShortId,
  shortenUUID,
  compareUUID
};
