'use strict';

/**
 * @fileoverview Audio-specific error class for LC3 codec and streaming
 * @module errors/AudioError
 */

const MeshError = require('./MeshError');
const { ERROR_MESSAGES } = require('../constants/errors');

/**
 * Error class for audio operation failures
 * @class AudioError
 * @extends MeshError
 */
class AudioError extends MeshError {
  /**
   * Creates a new AudioError
   * @param {string} message - Human-readable error message
   * @param {string} [code='EA00'] - Error code (EAxx range)
   * @param {Object|null} [details=null] - Additional error context
   */
  constructor(message, code = 'EA00', details = null) {
    super(message, code, details);
    this.name = 'AudioError';
  }

  /**
   * Creates an error from an error code
   * @param {string} code - Error code
   * @param {Object|null} [details=null] - Additional error context
   * @returns {AudioError}
   */
  static fromCode(code, details = null) {
    const message = ERROR_MESSAGES[code] || 'Audio operation failed';
    return new AudioError(message, code, details);
  }

  /**
   * Creates a codec initialization error
   * @param {Object|null} [details=null] - Additional error context
   * @returns {AudioError}
   */
  static codecInitFailed(details = null) {
    return new AudioError('LC3 codec initialization failed', 'EA01', details);
  }

  /**
   * Creates an encoding error
   * @param {Object|null} [details=null] - Additional error context
   * @returns {AudioError}
   */
  static encodingFailed(details = null) {
    return new AudioError('Audio encoding failed', 'EA02', details);
  }

  /**
   * Creates a decoding error
   * @param {Object|null} [details=null] - Additional error context
   * @returns {AudioError}
   */
  static decodingFailed(details = null) {
    return new AudioError('Audio decoding failed', 'EA03', details);
  }

  /**
   * Creates a session error
   * @param {string} peerId - Peer ID
   * @param {Object|null} [details=null] - Additional error context
   * @returns {AudioError}
   */
  static sessionFailed(peerId, details = null) {
    return new AudioError(
      `Audio session failed with peer ${peerId}`,
      'EA04',
      { peerId, ...details }
    );
  }

  /**
   * Creates a buffer overflow error
   * @param {Object|null} [details=null] - Additional error context
   * @returns {AudioError}
   */
  static bufferOverflow(details = null) {
    return new AudioError('Audio buffer overflow', 'EA05', details);
  }

  /**
   * Creates a buffer underrun error
   * @param {Object|null} [details=null] - Additional error context
   * @returns {AudioError}
   */
  static bufferUnderrun(details = null) {
    return new AudioError('Audio buffer underrun', 'EA06', details);
  }

  /**
   * Creates a voice message too large error
   * @param {number} size - Actual size in bytes
   * @param {number} maxSize - Maximum allowed size in bytes
   * @returns {AudioError}
   */
  static voiceMessageTooLarge(size, maxSize) {
    return new AudioError(
      `Voice message too large: ${size} bytes (max: ${maxSize})`,
      'EA07',
      { size, maxSize }
    );
  }

  /**
   * Creates a stream rejected error
   * @param {string} peerId - Peer ID
   * @param {string} [reason] - Rejection reason
   * @returns {AudioError}
   */
  static streamRejected(peerId, reason) {
    return new AudioError(
      `Audio stream rejected by peer ${peerId}`,
      'EA08',
      { peerId, reason }
    );
  }

  /**
   * Creates a codec not available error
   * @returns {AudioError}
   */
  static codecNotAvailable() {
    return new AudioError(
      'LC3 codec not available - native module not installed',
      'EA09'
    );
  }

  /**
   * Creates an invalid configuration error
   * @param {string} [reason] - Reason for invalid configuration
   * @returns {AudioError}
   */
  static invalidConfig(reason) {
    return new AudioError(
      `Invalid audio configuration: ${reason || 'unknown'}`,
      'EA10',
      { reason }
    );
  }

  /**
   * Creates a voice message timeout error
   * @param {string} messageId - Message ID
   * @returns {AudioError}
   */
  static voiceMessageTimeout(messageId) {
    return new AudioError(
      `Voice message assembly timed out: ${messageId}`,
      'EA11',
      { messageId }
    );
  }
}

module.exports = AudioError;
