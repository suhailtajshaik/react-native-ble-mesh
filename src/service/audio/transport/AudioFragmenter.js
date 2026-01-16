'use strict';

/**
 * @fileoverview Audio-specific fragmentation for voice messages
 * @module audio/transport/AudioFragmenter
 */

const EventEmitter = require('../../../utils/EventEmitter');
const { MESSAGE_TYPE } = require('../../../constants/protocol');
const { VOICE_MESSAGE_CONFIG } = require('../../../constants/audio');
const AudioError = require('../../../errors/AudioError');

/**
 * Fragments voice message data for BLE transport
 * @class AudioFragmenter
 */
class AudioFragmenter {
  /**
   * Fragments voice message data
   * @param {Uint8Array} voiceData - Serialized voice message
   * @param {Object} metadata - Voice message metadata
   * @param {string} metadata.messageId - Unique message ID
   * @param {number} [chunkSize] - Chunk size (default from config)
   * @returns {Uint8Array[]} Array of fragments
   */
  static fragment(voiceData, metadata, chunkSize = VOICE_MESSAGE_CONFIG.CHUNK_SIZE) {
    const { messageId } = metadata;
    const messageIdBytes = this._stringToBytes(messageId, 16);
    const totalChunks = Math.ceil(voiceData.length / chunkSize);
    const fragments = [];

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, voiceData.length);
      const chunk = voiceData.slice(start, end);

      let type;
      if (i === 0) {
        type = MESSAGE_TYPE.VOICE_MESSAGE_START;
      } else if (i === totalChunks - 1) {
        type = MESSAGE_TYPE.VOICE_MESSAGE_END;
      } else {
        type = MESSAGE_TYPE.VOICE_MESSAGE_DATA;
      }

      // Fragment format: [type(1)][messageId(16)][index(2)][total(2)][totalSize(4)][data...]
      const headerSize = type === MESSAGE_TYPE.VOICE_MESSAGE_START ? 25 : 21;
      const fragment = new Uint8Array(headerSize + chunk.length);
      const view = new DataView(fragment.buffer);

      fragment[0] = type;
      fragment.set(messageIdBytes, 1);
      view.setUint16(17, i, false);
      view.setUint16(19, totalChunks, false);

      if (type === MESSAGE_TYPE.VOICE_MESSAGE_START) {
        view.setUint32(21, voiceData.length, false);
        fragment.set(chunk, 25);
      } else {
        fragment.set(chunk, 21);
      }

      fragments.push(fragment);
    }

    return fragments;
  }

  /**
   * Returns fragment count for data size
   * @param {number} dataSize - Data size in bytes
   * @param {number} [chunkSize] - Chunk size
   * @returns {number}
   */
  static getFragmentCount(dataSize, chunkSize = VOICE_MESSAGE_CONFIG.CHUNK_SIZE) {
    return Math.ceil(dataSize / chunkSize);
  }

  /**
   * Converts string to fixed-length bytes
   * @private
   */
  static _stringToBytes(str, length) {
    const bytes = new Uint8Array(length);
    const encoder = new TextEncoder();
    const encoded = encoder.encode(str.slice(0, length));
    bytes.set(encoded.slice(0, length));
    return bytes;
  }
}

/**
 * Assembles fragmented voice messages
 * @class AudioAssembler
 * @extends EventEmitter
 */
class AudioAssembler extends EventEmitter {
  /**
   * Creates a new AudioAssembler
   * @param {Object} [options] - Assembler options
   * @param {number} [options.timeout=120000] - Assembly timeout in ms
   */
  constructor(options = {}) {
    super();

    /** @private */
    this._timeout = options.timeout || VOICE_MESSAGE_CONFIG.TIMEOUT_MS;
    /** @private */
    this._pending = new Map(); // messageId -> { fragments, totalSize, receivedSize, timer }
  }

  /**
   * Adds a fragment to assembly
   * @param {Uint8Array} fragment - Fragment data
   * @returns {Uint8Array|null} Complete voice data or null
   */
  addFragment(fragment) {
    const type = fragment[0];
    const messageId = this._bytesToString(fragment.slice(1, 17));
    const view = new DataView(fragment.buffer, fragment.byteOffset, fragment.byteLength);
    const index = view.getUint16(17, false);
    const total = view.getUint16(19, false);

    let chunkData;
    let totalSize = 0;

    if (type === MESSAGE_TYPE.VOICE_MESSAGE_START) {
      totalSize = view.getUint32(21, false);
      chunkData = fragment.slice(25);
    } else {
      chunkData = fragment.slice(21);
    }

    // Initialize pending entry
    if (!this._pending.has(messageId)) {
      if (type !== MESSAGE_TYPE.VOICE_MESSAGE_START) {
        // Missed the start fragment
        return null;
      }

      this._pending.set(messageId, {
        fragments: new Map(),
        totalSize,
        total,
        receivedSize: 0,
        timer: setTimeout(() => this._handleTimeout(messageId), this._timeout)
      });
    }

    const entry = this._pending.get(messageId);

    // Store fragment
    if (!entry.fragments.has(index)) {
      entry.fragments.set(index, chunkData);
      entry.receivedSize += chunkData.length;

      this.emit('progress', {
        messageId,
        received: entry.fragments.size,
        total: entry.total,
        progress: entry.fragments.size / entry.total
      });
    }

    // Check if complete
    if (entry.fragments.size === entry.total) {
      return this._assemble(messageId);
    }

    return null;
  }

  /**
   * Assembles complete voice message
   * @private
   */
  _assemble(messageId) {
    const entry = this._pending.get(messageId);
    if (!entry) return null;

    clearTimeout(entry.timer);

    // Combine fragments in order
    const result = new Uint8Array(entry.totalSize);
    let offset = 0;

    for (let i = 0; i < entry.total; i++) {
      const chunk = entry.fragments.get(i);
      if (chunk) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
    }

    this._pending.delete(messageId);
    this.emit('complete', { messageId, size: result.length });

    return result;
  }

  /**
   * Handles assembly timeout
   * @private
   */
  _handleTimeout(messageId) {
    this._pending.delete(messageId);
    this.emit('timeout', { messageId });
  }

  /**
   * Gets assembly progress
   * @param {string} messageId - Message ID
   * @returns {Object|null}
   */
  getProgress(messageId) {
    const entry = this._pending.get(messageId);
    if (!entry) return null;

    return {
      received: entry.fragments.size,
      total: entry.total,
      progress: entry.fragments.size / entry.total,
      receivedBytes: entry.receivedSize,
      totalBytes: entry.totalSize
    };
  }

  /**
   * Aborts assembly of a message
   * @param {string} messageId - Message ID
   */
  abort(messageId) {
    const entry = this._pending.get(messageId);
    if (entry) {
      clearTimeout(entry.timer);
      this._pending.delete(messageId);
    }
  }

  /**
   * Cleans up expired entries
   */
  cleanup() {
    // Timeouts are handled automatically
  }

  /**
   * Converts bytes to string
   * @private
   */
  _bytesToString(bytes) {
    const decoder = new TextDecoder();
    const nullIndex = bytes.indexOf(0);
    return decoder.decode(nullIndex >= 0 ? bytes.slice(0, nullIndex) : bytes);
  }
}

module.exports = {
  AudioFragmenter,
  AudioAssembler
};
