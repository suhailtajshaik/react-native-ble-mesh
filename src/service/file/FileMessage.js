'use strict';

/**
 * @fileoverview File message metadata
 * @module service/file/FileMessage
 */

/**
 * File transfer message types
 * @constant {Object}
 */
const FILE_MESSAGE_TYPE = Object.freeze({
  /** Initial file offer with metadata */
  OFFER: 'file:offer',
  /** File chunk data */
  CHUNK: 'file:chunk',
  /** Transfer complete acknowledgment */
  COMPLETE: 'file:complete',
  /** Transfer cancelled */
  CANCEL: 'file:cancel',
});

/**
 * File transfer states
 * @constant {Object}
 */
const FILE_TRANSFER_STATE = Object.freeze({
  PENDING: 'pending',
  TRANSFERRING: 'transferring',
  COMPLETE: 'complete',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

/**
 * Represents a file being transferred over the mesh.
 * @class FileMessage
 */
class FileMessage {
  /**
   * @param {Object} options
   * @param {string} options.id - Transfer ID
   * @param {string} options.name - File name
   * @param {string} options.mimeType - MIME type
   * @param {number} options.size - Total size in bytes
   * @param {number} options.totalChunks - Total number of chunks
   * @param {number} [options.chunkSize=4096] - Chunk size in bytes
   * @param {string} [options.senderId] - Sender peer ID
   */
  constructor(options) {
    this.id = options.id;
    this.name = options.name;
    this.mimeType = options.mimeType || 'application/octet-stream';
    this.size = options.size;
    this.totalChunks = options.totalChunks;
    this.chunkSize = options.chunkSize || 4096;
    this.senderId = options.senderId || null;
    this.receivedChunks = 0;
    this.state = FILE_TRANSFER_STATE.PENDING;
    this.startedAt = null;
    this.completedAt = null;
  }

  /**
   * Gets transfer progress as percentage
   * @returns {number} 0-100
   */
  get progress() {
    if (this.totalChunks === 0) return 100;
    return Math.round((this.receivedChunks / this.totalChunks) * 100);
  }

  /**
   * Gets elapsed transfer time in ms
   * @returns {number}
   */
  get elapsedMs() {
    if (!this.startedAt) return 0;
    const end = this.completedAt || Date.now();
    return end - this.startedAt;
  }

  /**
   * Serializes the file offer metadata
   * @returns {Object}
   */
  toOffer() {
    return {
      type: FILE_MESSAGE_TYPE.OFFER,
      id: this.id,
      name: this.name,
      mimeType: this.mimeType,
      size: this.size,
      totalChunks: this.totalChunks,
      chunkSize: this.chunkSize,
    };
  }

  /**
   * Creates a FileMessage from an offer
   * @param {Object} offer
   * @param {string} senderId
   * @returns {FileMessage}
   */
  static fromOffer(offer, senderId) {
    return new FileMessage({
      id: offer.id,
      name: offer.name,
      mimeType: offer.mimeType,
      size: offer.size,
      totalChunks: offer.totalChunks,
      chunkSize: offer.chunkSize,
      senderId,
    });
  }
}

module.exports = {
  FileMessage,
  FILE_MESSAGE_TYPE,
  FILE_TRANSFER_STATE,
};
