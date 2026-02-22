'use strict';

/**
 * @fileoverview File chunker — splits files into mesh-compatible chunks
 * @module service/file/FileChunker
 */

const DEFAULT_CHUNK_SIZE = 4096; // 4KB chunks
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB default max

/**
 * Splits a file (Uint8Array) into chunks for mesh transfer.
 * @class FileChunker
 */
class FileChunker {
  /**
   * @param {Object} [options={}]
   * @param {number} [options.chunkSize=4096] - Chunk size in bytes
   * @param {number} [options.maxFileSize=10485760] - Max file size in bytes
   */
  constructor(options = {}) {
    this._chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
    this._maxFileSize = options.maxFileSize || MAX_FILE_SIZE;
  }

  /**
   * Splits data into chunks
   * @param {Uint8Array} data - File data
   * @param {string} transferId - Transfer ID
   * @returns {Object[]} Array of chunk objects
   * @throws {Error} If data exceeds max file size
   */
  chunk(data, transferId) {
    if (!(data instanceof Uint8Array)) {
      throw new Error('Data must be a Uint8Array');
    }
    if (data.length > this._maxFileSize) {
      throw new Error(`File size ${data.length} exceeds max ${this._maxFileSize} bytes`);
    }
    if (data.length === 0) {
      return [];
    }

    const chunks = [];
    const totalChunks = Math.ceil(data.length / this._chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * this._chunkSize;
      const end = Math.min(start + this._chunkSize, data.length);
      chunks.push({
        transferId,
        index: i,
        totalChunks,
        data: data.slice(start, end),
      });
    }

    return chunks;
  }

  /**
   * Gets the number of chunks needed for a given data size
   * @param {number} dataSize - Data size in bytes
   * @returns {number} Number of chunks
   */
  getChunkCount(dataSize) {
    return Math.ceil(dataSize / this._chunkSize);
  }

  /**
   * Gets the chunk size
   * @returns {number}
   */
  get chunkSize() {
    return this._chunkSize;
  }
}

module.exports = FileChunker;
