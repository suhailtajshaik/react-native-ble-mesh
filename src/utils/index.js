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
const debug = require('./debug');

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
  bytesToBase64: encoding.bytesToBase64,
  base64ToBytes: encoding.base64ToBytes,
  stringToBytes: encoding.stringToBytes,
  bytesToString: encoding.bytesToString,

  // UUID
  generateUUID: uuid.generateUUID,
  uuidToBytes: uuid.uuidToBytes,
  bytesToUuid: uuid.bytesToUuid,
  isValidUUID: uuid.isValidUUID,
  generateShortId: uuid.generateShortId,
  shortenUUID: uuid.shortenUUID,
  compareUUID: uuid.compareUUID,

  // Time
  delay: time.delay,
  withTimeout: time.withTimeout,
  now: time.now,
  hrTime: time.hrTime,
  elapsed: time.elapsed,
  isExpired: time.isExpired,
  formatDuration: time.formatDuration,
  debounce: time.debounce,
  throttle: time.throttle,

  // Validation
  validateString: validation.validateString,
  validateBytes: validation.validateBytes,
  validatePositiveInt: validation.validatePositiveInt,
  validateEnum: validation.validateEnum,
  validateNonNegativeInt: validation.validateNonNegativeInt,
  validateRange: validation.validateRange,
  validateBoolean: validation.validateBoolean,
  validateFunction: validation.validateFunction,
  validateObject: validation.validateObject,
  validateOptional: validation.validateOptional,

  // Classes
  EventEmitter,
  LRUCache,
  RateLimiter,

  // Retry
  retry: retry.retry,
  retryable: retry.retryable,
  retryOn: retry.retryOn,
  retryExcept: retry.retryExcept,
  retryOnCodes: retry.retryOnCodes,

  // Debug
  debug,
  createDebugger: debug.createDebugger,
  enableDebug: debug.enable,
  disableDebug: debug.disable,

  // Sub-modules (for specific imports)
  bytes,
  encoding,
  uuid,
  time,
  validation
};
