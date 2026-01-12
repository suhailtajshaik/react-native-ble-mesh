'use strict';

/**
 * @fileoverview Connection error class
 * @module errors/ConnectionError
 */

const MeshError = require('./MeshError');
const { ERROR_MESSAGES } = require('../constants/errors');

/**
 * Error class for connection-related failures
 * @class ConnectionError
 * @extends MeshError
 */
class ConnectionError extends MeshError {
  /**
   * Creates a new ConnectionError
   * @param {string} message - Human-readable error message
   * @param {string} [code='E200'] - Error code (E2xx range)
   * @param {string|null} [peerId=null] - ID of the peer involved
   * @param {Object|null} [details=null] - Additional error context
   */
  constructor(message, code = 'E200', peerId = null, details = null) {
    super(message, code, details);
    this.name = 'ConnectionError';

    /**
     * ID of the peer involved in the connection error
     * @type {string|null}
     */
    this.peerId = peerId;
  }

  /**
   * Creates an error from an error code
   * @param {string} code - Error code from ERROR_CODE constants
   * @param {string|null} [peerId=null] - ID of the peer involved
   * @param {Object|null} [details=null] - Additional error context
   * @returns {ConnectionError} New ConnectionError instance
   */
  static fromCode(code, peerId = null, details = null) {
    const message = ERROR_MESSAGES[code] || ERROR_MESSAGES.E200;
    return new ConnectionError(message, code, peerId, details);
  }

  /**
   * Creates a connection failed error
   * @param {string|null} [peerId=null] - ID of the peer
   * @param {Object|null} [details=null] - Additional error context
   * @returns {ConnectionError} New ConnectionError instance
   */
  static connectionFailed(peerId = null, details = null) {
    return ConnectionError.fromCode('E200', peerId, details);
  }

  /**
   * Creates a connection timeout error
   * @param {string|null} [peerId=null] - ID of the peer
   * @param {Object|null} [details=null] - Additional error context
   * @returns {ConnectionError} New ConnectionError instance
   */
  static connectionTimeout(peerId = null, details = null) {
    return ConnectionError.fromCode('E201', peerId, details);
  }

  /**
   * Creates a connection lost error
   * @param {string|null} [peerId=null] - ID of the peer
   * @param {Object|null} [details=null] - Additional error context
   * @returns {ConnectionError} New ConnectionError instance
   */
  static connectionLost(peerId = null, details = null) {
    return ConnectionError.fromCode('E202', peerId, details);
  }

  /**
   * Creates a peer not found error
   * @param {string|null} [peerId=null] - ID of the peer
   * @param {Object|null} [details=null] - Additional error context
   * @returns {ConnectionError} New ConnectionError instance
   */
  static peerNotFound(peerId = null, details = null) {
    return ConnectionError.fromCode('E204', peerId, details);
  }

  /**
   * Creates a peer blocked error
   * @param {string|null} [peerId=null] - ID of the peer
   * @param {Object|null} [details=null] - Additional error context
   * @returns {ConnectionError} New ConnectionError instance
   */
  static peerBlocked(peerId = null, details = null) {
    return ConnectionError.fromCode('E205', peerId, details);
  }

  /**
   * Converts error to a JSON-serializable object
   * @returns {Object} JSON representation of the error
   */
  toJSON() {
    return {
      ...super.toJSON(),
      peerId: this.peerId
    };
  }
}

module.exports = ConnectionError;
