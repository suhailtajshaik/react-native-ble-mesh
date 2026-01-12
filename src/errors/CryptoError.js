'use strict';

/**
 * @fileoverview Cryptographic error class
 * @module errors/CryptoError
 */

const MeshError = require('./MeshError');
const { ERROR_MESSAGES } = require('../constants/errors');

/**
 * Error class for cryptographic operation failures
 * @class CryptoError
 * @extends MeshError
 */
class CryptoError extends MeshError {
  /**
   * Creates a new CryptoError
   * @param {string} message - Human-readable error message
   * @param {string} [code='E400'] - Error code (E4xx range)
   * @param {Object|null} [details=null] - Additional error context
   */
  constructor(message, code = 'E400', details = null) {
    super(message, code, details);
    this.name = 'CryptoError';
  }

  /**
   * Creates an error from an error code
   * @param {string} code - Error code from ERROR_CODE constants
   * @param {Object|null} [details=null] - Additional error context
   * @returns {CryptoError} New CryptoError instance
   */
  static fromCode(code, details = null) {
    const message = ERROR_MESSAGES[code] || ERROR_MESSAGES.E400;
    return new CryptoError(message, code, details);
  }

  /**
   * Creates a key generation error
   * @param {Object|null} [details=null] - Additional error context
   * @returns {CryptoError} New CryptoError instance
   */
  static keyGenerationFailed(details = null) {
    return CryptoError.fromCode('E400', details);
  }

  /**
   * Creates an encryption error
   * @param {Object|null} [details=null] - Additional error context
   * @returns {CryptoError} New CryptoError instance
   */
  static encryptionFailed(details = null) {
    return CryptoError.fromCode('E401', details);
  }

  /**
   * Creates a decryption error
   * @param {Object|null} [details=null] - Additional error context
   * @returns {CryptoError} New CryptoError instance
   */
  static decryptionFailed(details = null) {
    return CryptoError.fromCode('E402', details);
  }

  /**
   * Creates an invalid key error
   * @param {Object|null} [details=null] - Additional error context
   * @returns {CryptoError} New CryptoError instance
   */
  static invalidKey(details = null) {
    return CryptoError.fromCode('E403', details);
  }

  /**
   * Creates an invalid nonce error
   * @param {Object|null} [details=null] - Additional error context
   * @returns {CryptoError} New CryptoError instance
   */
  static invalidNonce(details = null) {
    return CryptoError.fromCode('E404', details);
  }

  /**
   * Creates an authentication tag mismatch error
   * @param {Object|null} [details=null] - Additional error context
   * @returns {CryptoError} New CryptoError instance
   */
  static authTagMismatch(details = null) {
    return CryptoError.fromCode('E405', details);
  }

  /**
   * Creates a nonce exhausted error
   * @param {Object|null} [details=null] - Additional error context
   * @returns {CryptoError} New CryptoError instance
   */
  static nonceExhausted(details = null) {
    return CryptoError.fromCode('E406', details);
  }
}

module.exports = CryptoError;
