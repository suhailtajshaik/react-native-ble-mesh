'use strict';

/**
 * @fileoverview Validation error class
 * @module errors/ValidationError
 */

const MeshError = require('./MeshError');
const { ERROR_MESSAGES } = require('../constants/errors');

/**
 * Error class for input validation failures
 * @class ValidationError
 * @extends MeshError
 */
class ValidationError extends MeshError {
  /**
   * Creates a new ValidationError
   * @param {string} message - Human-readable error message
   * @param {string} [code='E800'] - Error code (E8xx range)
   * @param {string|null} [field=null] - Name of the field that failed validation
   * @param {*} [value=undefined] - The invalid value
   * @param {Object|null} [details=null] - Additional error context
   */
  constructor(message, code = 'E800', field = null, value = undefined, details = null) {
    super(message, code, details);
    this.name = 'ValidationError';

    /**
     * Name of the field that failed validation
     * @type {string|null}
     */
    this.field = field;

    /**
     * The invalid value (sanitized to prevent secret exposure)
     * @type {string|undefined}
     */
    this.value = value !== undefined ? ValidationError.sanitizeValue(value) : undefined;
  }

  /**
   * Sanitizes a value for safe inclusion in error output
   * @param {*} value - The value to sanitize
   * @returns {string} Sanitized string representation
   * @private
   */
  static sanitizeValue(value) {
    if (value === null) { return 'null'; }
    if (value === undefined) { return 'undefined'; }

    const type = typeof value;

    if (type === 'string') {
      // Truncate long strings and mask potentially sensitive data
      if (value.length > 50) {
        return `"${value.substring(0, 47)}..." (${value.length} chars)`;
      }
      return `"${value}"`;
    }

    if (type === 'number' || type === 'boolean') {
      return String(value);
    }

    if (value instanceof Uint8Array) {
      return `Uint8Array(${value.length})`;
    }

    if (Array.isArray(value)) {
      return `Array(${value.length})`;
    }

    if (type === 'object') {
      return `Object(${Object.keys(value).length} keys)`;
    }

    return `[${type}]`;
  }

  /**
   * Creates an error from an error code
   * @param {string} code - Error code from ERROR_CODE constants
   * @param {string|null} [field=null] - Name of the field
   * @param {*} [value=undefined] - The invalid value
   * @param {Object|null} [details=null] - Additional error context
   * @returns {ValidationError} New ValidationError instance
   */
  static fromCode(code, field = null, value = undefined, details = null) {
    const message = ERROR_MESSAGES[code] || ERROR_MESSAGES.E800;
    return new ValidationError(message, code, field, value, details);
  }

  /**
   * Creates an invalid argument error
   * @param {string} field - Name of the field
   * @param {*} [value=undefined] - The invalid value
   * @param {Object|null} [details=null] - Additional error context
   * @returns {ValidationError} New ValidationError instance
   */
  static invalidArgument(field, value = undefined, details = null) {
    return ValidationError.fromCode('E801', field, value, details);
  }

  /**
   * Creates a missing argument error
   * @param {string} field - Name of the missing field
   * @param {Object|null} [details=null] - Additional error context
   * @returns {ValidationError} New ValidationError instance
   */
  static missingArgument(field, details = null) {
    return ValidationError.fromCode('E802', field, undefined, details);
  }

  /**
   * Creates an invalid type error
   * @param {string} field - Name of the field
   * @param {*} value - The invalid value
   * @param {string} expectedType - Expected type description
   * @returns {ValidationError} New ValidationError instance
   */
  static invalidType(field, value, expectedType) {
    return ValidationError.fromCode('E803', field, value, { expectedType });
  }

  /**
   * Creates an out of range error
   * @param {string} field - Name of the field
   * @param {*} value - The invalid value
   * @param {Object} range - Expected range { min, max }
   * @returns {ValidationError} New ValidationError instance
   */
  static outOfRange(field, value, range) {
    return ValidationError.fromCode('E804', field, value, { range });
  }

  /**
   * Converts error to a JSON-serializable object
   * @returns {Object} JSON representation of the error
   */
  toJSON() {
    return {
      ...super.toJSON(),
      field: this.field,
      value: this.value
    };
  }
}

module.exports = ValidationError;
