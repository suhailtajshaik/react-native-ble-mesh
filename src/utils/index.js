'use strict';

/**
 * @fileoverview Utility module exports
 * @module utils
 */

const bytes = require('./bytes');
const encoding = require('./encoding');
const uuid = require('./uuid');
const time = require('./time');
const validation = require('./validation');
const EventEmitter = require('./EventEmitter');
const LRUCache = require('./LRUCache');
const RateLimiter = require('./RateLimiter');
const retry = require('./retry');
const base64 = require('./base64');

module.exports = {
  // Byte manipulation
  concat: bytes.concat,
  constantTimeEqual: bytes.constantTimeEqual,
  randomBytes: bytes.randomBytes,
  xor: bytes.xor,
  fill: bytes.fill,
  copy: bytes.copy,
  secureWipe: bytes.secureWipe,
  equals: bytes.equals,
  slice: bytes.slice,

  // Encoding
  bytesToHex: encoding.bytesToHex,
  hexToBytes: encoding.hexToBytes,
  stringToBytes: encoding.stringToBytes,
  bytesToString: encoding.bytesToString,

  // Base64 (optimized for React Native)
  base64Encode: base64.encode,
  base64Decode: base64.decode,
  isValidBase64: base64.isValid,

  // UUID
  generateUUID: uuid.generateUUID,
  uuidToBytes: uuid.uuidToBytes,
  bytesToUuid: uuid.bytesToUuid,
  isValidUUID: uuid.isValidUUID,
  generateShortId: uuid.generateShortId,

  // Time
  delay: time.delay,
  withTimeout: time.withTimeout,
  now: time.now,
  isExpired: time.isExpired,
  debounce: time.debounce,
  throttle: time.throttle,

  // Validation
  validateString: validation.validateString,
  validateBytes: validation.validateBytes,
  validatePositiveInt: validation.validatePositiveInt,
  validateNonNegativeInt: validation.validateNonNegativeInt,
  validateBoolean: validation.validateBoolean,
  validateFunction: validation.validateFunction,
  validateObject: validation.validateObject,

  // Classes
  EventEmitter,
  LRUCache,
  RateLimiter,

  // Retry
  retry: retry.retry,
  retryable: retry.retryable,

  // Sub-modules
  bytes,
  encoding,
  uuid,
  time,
  validation,
  base64
};
