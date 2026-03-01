'use strict';

/**
 * @fileoverview Message error class
 * @module errors/MessageError
 */

const MeshError = require('./MeshError');
const { ERROR_MESSAGES } = require('../constants/errors');

/**
 * Error class for message-related failures
 * @class MessageError
 * @extends MeshError
 */
class MessageError extends MeshError {
  /**
   * Creates a new MessageError
   * @param {string} message - Human-readable error message
   * @param {string} [code='E500'] - Error code (E5xx range)
   * @param {string|null} [messageId=null] - ID of the message involved
   * @param {Object|null} [details=null] - Additional error context
   */
  constructor(message, code = 'E500', messageId = null, details = null) {
    super(message, code, details);
    this.name = 'MessageError';

    /**
     * ID of the message involved in the error
     * @type {string|null}
     */
    this.messageId = messageId;
  }

  /**
   * Creates an error from an error code
   * @param {string} code - Error code from ERROR_CODE constants
   * @param {string|null} [messageId=null] - ID of the message involved
   * @param {Object|null} [details=null] - Additional error context
   * @returns {MessageError} New MessageError instance
   */
  static fromCode(code, messageId = null, details = null) {
    const message = /** @type {Record<string, string>} */ (ERROR_MESSAGES)[code] || /** @type {Record<string, string>} */ (ERROR_MESSAGES).E500;
    return new MessageError(message, code, messageId, details);
  }

  /**
   * Creates a message too large error
   * @param {string|null} [messageId=null] - ID of the message
   * @param {Object|null} [details=null] - Additional error context
   * @returns {MessageError} New MessageError instance
   */
  static messageTooLarge(messageId = null, details = null) {
    return MessageError.fromCode('E500', messageId, details);
  }

  /**
   * Creates a message expired error
   * @param {string|null} [messageId=null] - ID of the message
   * @param {Object|null} [details=null] - Additional error context
   * @returns {MessageError} New MessageError instance
   */
  static messageExpired(messageId = null, details = null) {
    return MessageError.fromCode('E501', messageId, details);
  }

  /**
   * Creates an invalid format error
   * @param {string|null} [messageId=null] - ID of the message
   * @param {Object|null} [details=null] - Additional error context
   * @returns {MessageError} New MessageError instance
   */
  static invalidFormat(messageId = null, details = null) {
    return MessageError.fromCode('E502', messageId, details);
  }

  /**
   * Creates an invalid checksum error
   * @param {string|null} [messageId=null] - ID of the message
   * @param {Object|null} [details=null] - Additional error context
   * @returns {MessageError} New MessageError instance
   */
  static invalidChecksum(messageId = null, details = null) {
    return MessageError.fromCode('E503', messageId, details);
  }

  /**
   * Creates a duplicate message error
   * @param {string|null} [messageId=null] - ID of the message
   * @param {Object|null} [details=null] - Additional error context
   * @returns {MessageError} New MessageError instance
   */
  static duplicate(messageId = null, details = null) {
    return MessageError.fromCode('E504', messageId, details);
  }

  /**
   * Creates a max hops exceeded error
   * @param {string|null} [messageId=null] - ID of the message
   * @param {Object|null} [details=null] - Additional error context
   * @returns {MessageError} New MessageError instance
   */
  static maxHopsExceeded(messageId = null, details = null) {
    return MessageError.fromCode('E505', messageId, details);
  }

  /**
   * Creates a send failed error
   * @param {string|null} [messageId=null] - ID of the message
   * @param {Object|null} [details=null] - Additional error context
   * @returns {MessageError} New MessageError instance
   */
  static sendFailed(messageId = null, details = null) {
    return MessageError.fromCode('E506', messageId, details);
  }

  /**
   * Converts error to a JSON-serializable object
   * @returns {any} JSON representation of the error
   */
  toJSON() {
    return {
      ...super.toJSON(),
      messageId: this.messageId
    };
  }
}

module.exports = MessageError;
