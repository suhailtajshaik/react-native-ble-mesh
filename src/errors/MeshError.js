'use strict';

/**
 * @fileoverview Base error class for BLE Mesh Network library
 * @module errors/MeshError
 */

const { ERROR_CODE, ERROR_MESSAGES } = require('../constants/errors');

/**
 * Base error class for all mesh-related errors
 * @class MeshError
 * @extends Error
 */
class MeshError extends Error {
  /**
   * Creates a new MeshError
   * @param {string} message - Human-readable error message
   * @param {string} [code='E900'] - Error code from ERROR_CODE constants
   * @param {Object|null} [details=null] - Additional error context
   */
  constructor(message, code = 'E900', details = null) {
    super(message);

    /**
     * Error name
     * @type {string}
     */
    this.name = this.constructor.name;

    /**
     * Error code
     * @type {string}
     */
    this.code = code;

    /**
     * Additional error details
     * @type {Object|null}
     */
    this.details = details;

    /**
     * Timestamp when error occurred
     * @type {number}
     */
    this.timestamp = Date.now();

    // Capture stack trace (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Creates an error from an error code
   * @param {string} code - Error code from ERROR_CODE constants
   * @param {Object|null} [details=null] - Additional error context
   * @returns {MeshError} New MeshError instance
   */
  static fromCode(code, details = null) {
    const message = ERROR_MESSAGES[code] || ERROR_MESSAGES.E900;
    return new MeshError(message, code, details);
  }

  /**
   * Gets the error type name from ERROR_CODE
   * @returns {string} Error type name
   */
  getTypeName() {
    return ERROR_CODE[this.code] || 'UNKNOWN_ERROR';
  }

  /**
   * Converts error to a JSON-serializable object
   * @returns {Object} JSON representation of the error
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      typeName: this.getTypeName(),
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }

  /**
   * Creates a string representation of the error
   * @returns {string} String representation
   */
  toString() {
    const typeName = this.getTypeName();
    return `${this.name} [${this.code}:${typeName}]: ${this.message}`;
  }
}

module.exports = MeshError;
