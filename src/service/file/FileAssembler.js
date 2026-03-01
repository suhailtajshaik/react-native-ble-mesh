'use strict';

/**
 * @fileoverview File assembler — reassembles chunks into complete files
 * @module service/file/FileAssembler
 */

/**
 * Reassembles file chunks into a complete file.
 * @class FileAssembler
 */
class FileAssembler {
  /**
   * @param {string} transferId - Transfer ID
   * @param {number} totalChunks - Expected total chunks
   * @param {number} totalSize - Expected total file size
   */
  constructor(transferId, totalChunks, totalSize) {
    this._transferId = transferId;
    this._totalChunks = totalChunks;
    this._totalSize = totalSize;
    /** @type {Map<number, Uint8Array>} */
    this._chunks = new Map();
    this._receivedBytes = 0;
  }

  /**
   * Adds a chunk
   * @param {number} index - Chunk index
   * @param {Uint8Array} data - Chunk data
   * @returns {boolean} True if this was a new chunk
   */
  addChunk(index, data) {
    if (index < 0 || index >= this._totalChunks) {
      return false;
    }
    if (this._chunks.has(index)) {
      return false; // duplicate
    }
    this._chunks.set(index, data);
    this._receivedBytes += data.length;
    return true;
  }

  /**
   * Checks if all chunks have been received
   * @returns {boolean}
   */
  isComplete() {
    return this._chunks.size === this._totalChunks;
  }

  /**
   * Gets progress percentage
   * @returns {number} 0-100
   */
  get progress() {
    if (this._totalChunks === 0) { return 100; }
    return Math.round((this._chunks.size / this._totalChunks) * 100);
  }

  /**
   * Gets number of received chunks
   * @returns {number}
   */
  get receivedChunks() {
    return this._chunks.size;
  }

  /**
   * Assembles all chunks into a single Uint8Array
   * @returns {Uint8Array} Complete file data
   * @throws {Error} If not all chunks received
   */
  assemble() {
    if (!this.isComplete()) {
      throw new Error(
        `Cannot assemble: received ${this._chunks.size}/${this._totalChunks} chunks`
      );
    }

    const result = new Uint8Array(this._receivedBytes);
    let offset = 0;

    for (let i = 0; i < this._totalChunks; i++) {
      const chunk = this._chunks.get(i);
      if (chunk) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
    }

    // Free chunk memory immediately after assembly
    this._chunks.clear();

    return result;
  }

  /**
   * Clears all stored chunks
   */
  clear() {
    this._chunks.clear();
    this._receivedBytes = 0;
  }
}

module.exports = FileAssembler;
