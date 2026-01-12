'use strict';

/**
 * @fileoverview Input validation utilities
 * @module utils/validation
 */

const { ValidationError } = require('../errors');

/**
 * Validates that a value is a non-empty string
 * @param {*} value - Value to validate
 * @param {string} name - Name of the parameter for error messages
 * @throws {ValidationError} If value is not a valid string
 */
function validateString(value, name) {
  if (value === undefined || value === null) {
    throw ValidationError.missingArgument(name);
  }

  if (typeof value !== 'string') {
    throw ValidationError.invalidType(name, value, 'string');
  }

  if (value.length === 0) {
    throw ValidationError.invalidArgument(name, value, { reason: 'String cannot be empty' });
  }
}

/**
 * Validates that a value is a Uint8Array with optional length check
 * @param {*} value - Value to validate
 * @param {string} name - Name of the parameter for error messages
 * @param {number} [expectedLength] - Expected length (optional)
 * @throws {ValidationError} If value is not a valid Uint8Array
 */
function validateBytes(value, name, expectedLength) {
  if (value === undefined || value === null) {
    throw ValidationError.missingArgument(name);
  }

  if (!(value instanceof Uint8Array)) {
    throw ValidationError.invalidType(name, value, 'Uint8Array');
  }

  if (expectedLength !== undefined && value.length !== expectedLength) {
    throw ValidationError.invalidArgument(name, value, {
      reason: `Expected ${expectedLength} bytes, got ${value.length}`
    });
  }
}

/**
 * Validates that a value is a positive integer
 * @param {*} value - Value to validate
 * @param {string} name - Name of the parameter for error messages
 * @throws {ValidationError} If value is not a positive integer
 */
function validatePositiveInt(value, name) {
  if (value === undefined || value === null) {
    throw ValidationError.missingArgument(name);
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw ValidationError.invalidType(name, value, 'integer');
  }

  if (value <= 0) {
    throw ValidationError.outOfRange(name, value, { min: 1 });
  }
}

/**
 * Validates that a value is one of the allowed values
 * @param {*} value - Value to validate
 * @param {string} name - Name of the parameter for error messages
 * @param {Array} allowed - Array of allowed values
 * @throws {ValidationError} If value is not in allowed list
 */
function validateEnum(value, name, allowed) {
  if (value === undefined || value === null) {
    throw ValidationError.missingArgument(name);
  }

  if (!allowed.includes(value)) {
    throw ValidationError.invalidArgument(name, value, {
      allowed: allowed
    });
  }
}

/**
 * Validates that a value is a non-negative integer
 * @param {*} value - Value to validate
 * @param {string} name - Name of the parameter for error messages
 * @throws {ValidationError} If value is not a non-negative integer
 */
function validateNonNegativeInt(value, name) {
  if (value === undefined || value === null) {
    throw ValidationError.missingArgument(name);
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw ValidationError.invalidType(name, value, 'integer');
  }

  if (value < 0) {
    throw ValidationError.outOfRange(name, value, { min: 0 });
  }
}

/**
 * Validates that a value is a number within a range
 * @param {*} value - Value to validate
 * @param {string} name - Name of the parameter for error messages
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @throws {ValidationError} If value is not within range
 */
function validateRange(value, name, min, max) {
  if (value === undefined || value === null) {
    throw ValidationError.missingArgument(name);
  }

  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw ValidationError.invalidType(name, value, 'number');
  }

  if (value < min || value > max) {
    throw ValidationError.outOfRange(name, value, { min, max });
  }
}

/**
 * Validates that a value is a boolean
 * @param {*} value - Value to validate
 * @param {string} name - Name of the parameter for error messages
 * @throws {ValidationError} If value is not a boolean
 */
function validateBoolean(value, name) {
  if (value === undefined || value === null) {
    throw ValidationError.missingArgument(name);
  }

  if (typeof value !== 'boolean') {
    throw ValidationError.invalidType(name, value, 'boolean');
  }
}

/**
 * Validates that a value is a function
 * @param {*} value - Value to validate
 * @param {string} name - Name of the parameter for error messages
 * @throws {ValidationError} If value is not a function
 */
function validateFunction(value, name) {
  if (value === undefined || value === null) {
    throw ValidationError.missingArgument(name);
  }

  if (typeof value !== 'function') {
    throw ValidationError.invalidType(name, value, 'function');
  }
}

/**
 * Validates that a value is a plain object
 * @param {*} value - Value to validate
 * @param {string} name - Name of the parameter for error messages
 * @throws {ValidationError} If value is not a plain object
 */
function validateObject(value, name) {
  if (value === undefined || value === null) {
    throw ValidationError.missingArgument(name);
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw ValidationError.invalidType(name, value, 'object');
  }
}

/**
 * Validates an optional value (only if present)
 * @param {*} value - Value to validate
 * @param {function} validator - Validation function to apply
 * @param {string} name - Name of the parameter for error messages
 */
function validateOptional(value, validator, name) {
  if (value !== undefined && value !== null) {
    validator(value, name);
  }
}

module.exports = {
  validateString,
  validateBytes,
  validatePositiveInt,
  validateEnum,
  validateNonNegativeInt,
  validateRange,
  validateBoolean,
  validateFunction,
  validateObject,
  validateOptional
};
