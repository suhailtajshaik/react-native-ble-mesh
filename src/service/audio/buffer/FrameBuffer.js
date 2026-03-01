'use strict';

/**
 * @fileoverview LC3 frame buffer for voice message storage
 * @module audio/buffer/FrameBuffer
 */

const { VOICE_MESSAGE_CONFIG } = require('../../../constants/audio');

/**
 * Buffer for storing LC3 encoded frames
 * @class FrameBuffer
 */
class FrameBuffer {
  /**
   * Creates a new FrameBuffer
   * @param {any} [options] - Buffer options
   */
  constructor(options = {}) {
    /** @type {number} @private */
    this._maxFrames = options.maxFrames || 30000;
    /** @type {number} @private */
    this._maxBytes = options.maxBytes || VOICE_MESSAGE_CONFIG.MAX_SIZE_BYTES;
    /** @type {Uint8Array[]} @private */
    this._frames = [];
    /** @type {number} @private */
    this._totalBytes = 0;
  }

  /**
   * Adds a frame to the buffer
   * @param {Uint8Array} frame - LC3 encoded frame
   * @returns {boolean} True if frame was added
   */
  push(frame) {
    if (this._frames.length >= this._maxFrames) {
      return false;
    }

    if (this._totalBytes + frame.length > this._maxBytes) {
      return false;
    }

    this._frames.push(new Uint8Array(frame));
    this._totalBytes += frame.length;
    return true;
  }

  /**
   * Gets a frame by index
   * @param {number} index - Frame index
   * @returns {Uint8Array|null}
   */
  getFrame(index) {
    if (index < 0 || index >= this._frames.length) {
      return null;
    }
    return this._frames[index];
  }

  /**
   * Returns the number of frames
   * @returns {number}
   */
  getFrameCount() {
    return this._frames.length;
  }

  /**
   * Returns total bytes stored
   * @returns {number}
   */
  getTotalBytes() {
    return this._totalBytes;
  }

  /**
   * Returns duration in milliseconds
   * @param {number} frameMs - Frame duration in ms
   * @returns {number}
   */
  getDurationMs(frameMs) {
    return this._frames.length * frameMs;
  }

  /**
   * Returns all frames as array
   * @returns {Uint8Array[]}
   */
  toArray() {
    return this._frames.slice();
  }

  /**
   * Serializes buffer to single Uint8Array
   * @returns {Uint8Array}
   */
  serialize() {
    // Format: [frameCount(4)] + [frameLen(2) + frameData]...
    /** @type {Uint8Array[]} */
    const parts = [];
    const countBytes = new Uint8Array(4);
    new DataView(countBytes.buffer).setUint32(0, this._frames.length, false);
    parts.push(countBytes);

    for (const frame of this._frames) {
      const lenBytes = new Uint8Array(2);
      new DataView(lenBytes.buffer).setUint16(0, frame.length, false);
      parts.push(lenBytes);
      parts.push(frame);
    }

    const totalLen = parts.reduce((/** @type {number} */ sum, /** @type {Uint8Array} */ p) => sum + p.length, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;

    for (const part of parts) {
      result.set(part, offset);
      offset += part.length;
    }

    return result;
  }

  /**
   * Deserializes buffer from Uint8Array
   * @param {Uint8Array} data - Serialized data
   * @returns {FrameBuffer}
   */
  static deserialize(data) {
    const buffer = new FrameBuffer();
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    const frameCount = view.getUint32(0, false);
    let offset = 4;

    for (let i = 0; i < frameCount && offset < data.length; i++) {
      const frameLen = view.getUint16(offset, false);
      offset += 2;

      if (offset + frameLen <= data.length) {
        const frame = data.slice(offset, offset + frameLen);
        buffer.push(frame);
        offset += frameLen;
      }
    }

    return buffer;
  }

  /**
   * Creates an iterator for frames
   * @returns {Iterator<Uint8Array>}
   */
  [Symbol.iterator]() {
    return this._frames[Symbol.iterator]();
  }

  /**
   * Clears the buffer
   */
  clear() {
    this._frames = [];
    this._totalBytes = 0;
  }
}

module.exports = FrameBuffer;
