'use strict';

/**
 * @fileoverview Handshake error class
 * @module errors/HandshakeError
 */

const MeshError = require('./MeshError');
const { ERROR_MESSAGES } = require('../constants/errors');

/**
 * Error class for Noise Protocol handshake failures
 * @class HandshakeError
 * @extends MeshError
 */
class HandshakeError extends MeshError {
  /**
   * Creates a new HandshakeError
   * @param {string} message - Human-readable error message
   * @param {string} [code='E300'] - Error code (E3xx range)
   * @param {string|null} [peerId=null] - ID of the peer involved
   * @param {number|null} [step=null] - Handshake step where error occurred
   * @param {Object|null} [details=null] - Additional error context
   */
  constructor(message, code = 'E300', peerId = null, step = null, details = null) {
    super(message, code, details);
    this.name = 'HandshakeError';

    /**
     * ID of the peer involved in the handshake
     * @type {string|null}
     */
    this.peerId = peerId;

    /**
     * Handshake step where the error occurred (1, 2, or 3 for XX pattern)
     * @type {number|null}
     */
    this.step = step;
  }

  /**
   * Creates an error from an error code
   * @param {string} code - Error code from ERROR_CODE constants
   * @param {string|null} [peerId=null] - ID of the peer involved
   * @param {number|null} [step=null] - Handshake step where error occurred
   * @param {Object|null} [details=null] - Additional error context
   * @returns {HandshakeError} New HandshakeError instance
   */
  static fromCode(code, peerId = null, step = null, details = null) {
    const message = /** @type {Record<string, string>} */ (ERROR_MESSAGES)[code] || /** @type {Record<string, string>} */ (ERROR_MESSAGES).E300;
    return new HandshakeError(message, code, peerId, step, details);
  }

  /**
   * Creates a handshake failed error
   * @param {string|null} [peerId=null] - ID of the peer
   * @param {number|null} [step=null] - Handshake step
   * @param {Object|null} [details=null] - Additional error context
   * @returns {HandshakeError} New HandshakeError instance
   */
  static handshakeFailed(peerId = null, step = null, details = null) {
    return HandshakeError.fromCode('E300', peerId, step, details);
  }

  /**
   * Creates a handshake timeout error
   * @param {string|null} [peerId=null] - ID of the peer
   * @param {number|null} [step=null] - Handshake step
   * @param {Object|null} [details=null] - Additional error context
   * @returns {HandshakeError} New HandshakeError instance
   */
  static handshakeTimeout(peerId = null, step = null, details = null) {
    return HandshakeError.fromCode('E301', peerId, step, details);
  }

  /**
   * Creates an invalid handshake state error
   * @param {string|null} [peerId=null] - ID of the peer
   * @param {number|null} [step=null] - Handshake step
   * @param {Object|null} [details=null] - Additional error context
   * @returns {HandshakeError} New HandshakeError instance
   */
  static invalidState(peerId = null, step = null, details = null) {
    return HandshakeError.fromCode('E302', peerId, step, details);
  }

  /**
   * Creates a decryption failed error during handshake
   * @param {string|null} [peerId=null] - ID of the peer
   * @param {number|null} [step=null] - Handshake step
   * @param {Object|null} [details=null] - Additional error context
   * @returns {HandshakeError} New HandshakeError instance
   */
  static decryptionFailed(peerId = null, step = null, details = null) {
    return HandshakeError.fromCode('E303', peerId, step, details);
  }

  /**
   * Creates an already in progress error
   * @param {string|null} [peerId=null] - ID of the peer
   * @param {Object|null} [details=null] - Additional error context
   * @returns {HandshakeError} New HandshakeError instance
   */
  static alreadyInProgress(peerId = null, details = null) {
    return HandshakeError.fromCode('E304', peerId, null, details);
  }

  /**
   * Converts error to a JSON-serializable object
   * @returns {any} JSON representation of the error
   */
  toJSON() {
    return {
      ...super.toJSON(),
      peerId: this.peerId,
      step: this.step
    };
  }
}

module.exports = HandshakeError;
