'use strict';

/**
 * @fileoverview Jitter buffer for real-time audio streaming
 * @module audio/buffer/JitterBuffer
 */

const EventEmitter = require('../../../utils/EventEmitter');
const { AUDIO_STREAM_CONFIG } = require('../../../constants/audio');

/**
 * Jitter buffer for smoothing network jitter in audio streams
 * @class JitterBuffer
 * @extends EventEmitter
 */
class JitterBuffer extends EventEmitter {
  /**
   * Creates a new JitterBuffer
   * @param {Object} [options] - Buffer options
   * @param {number} [options.depth=5] - Target buffer depth in frames
   * @param {number} [options.maxDepth=20] - Maximum buffer depth
   * @param {number} [options.frameMs=10] - Frame duration in ms
   */
  constructor(options = {}) {
    super();

    /** @private */
    this._targetDepth = options.depth || AUDIO_STREAM_CONFIG.JITTER_BUFFER_FRAMES;
    /** @private */
    this._maxDepth = options.maxDepth || AUDIO_STREAM_CONFIG.MAX_JITTER_BUFFER_FRAMES;
    /** @private */
    this._frameMs = options.frameMs || 10;
    /** @private */
    this._buffer = new Map(); // sequenceNumber -> { frame, timestamp }
    /** @private */
    this._nextPlaySeq = 0;
    /** @private */
    this._initialized = false;
    /** @private */
    this._stats = {
      framesReceived: 0,
      framesPlayed: 0,
      framesDropped: 0,
      plcFrames: 0,
      underruns: 0,
      overflows: 0
    };
  }

  /**
   * Pushes a frame into the buffer
   * @param {Uint8Array} frame - Audio frame data
   * @param {number} sequenceNumber - Frame sequence number
   * @param {number} [timestamp] - Frame timestamp
   */
  push(frame, sequenceNumber, timestamp = Date.now()) {
    this._stats.framesReceived++;

    // Initialize on first frame
    if (!this._initialized) {
      this._nextPlaySeq = sequenceNumber;
      this._initialized = true;
    }

    // Drop if too old
    if (sequenceNumber < this._nextPlaySeq) {
      this._stats.framesDropped++;
      return;
    }

    // Check for overflow
    if (this._buffer.size >= this._maxDepth) {
      this._stats.overflows++;
      this.emit('overflow', { bufferSize: this._buffer.size });
      // Drop oldest frame
      const oldestSeq = Math.min(...this._buffer.keys());
      this._buffer.delete(oldestSeq);
    }

    this._buffer.set(sequenceNumber, { frame: new Uint8Array(frame), timestamp });

    // Emit ready when we have enough frames
    if (this._buffer.size >= this._targetDepth) {
      this.emit('ready', { bufferSize: this._buffer.size });
    }
  }

  /**
   * Pops the next frame from the buffer
   * @returns {{frame: Uint8Array|null, isPLC: boolean, sequenceNumber: number}}
   */
  pop() {
    const seq = this._nextPlaySeq;
    this._nextPlaySeq++;

    if (this._buffer.has(seq)) {
      const { frame } = this._buffer.get(seq);
      this._buffer.delete(seq);
      this._stats.framesPlayed++;
      return { frame, isPLC: false, sequenceNumber: seq };
    }

    // Frame missing - generate PLC marker
    this._stats.plcFrames++;

    if (this._buffer.size === 0) {
      this._stats.underruns++;
      this.emit('underrun', { sequenceNumber: seq });
    }

    return { frame: null, isPLC: true, sequenceNumber: seq };
  }

  /**
   * Peeks at the next frame without removing it
   * @returns {{frame: Uint8Array|null, sequenceNumber: number}|null}
   */
  peek() {
    if (this._buffer.has(this._nextPlaySeq)) {
      const { frame } = this._buffer.get(this._nextPlaySeq);
      return { frame, sequenceNumber: this._nextPlaySeq };
    }
    return null;
  }

  /**
   * Returns current buffer level
   * @returns {number}
   */
  getBufferLevel() {
    return this._buffer.size;
  }

  /**
   * Returns buffer level in milliseconds
   * @returns {number}
   */
  getBufferMs() {
    return this._buffer.size * this._frameMs;
  }

  /**
   * Returns whether buffer has enough frames
   * @returns {boolean}
   */
  isReady() {
    return this._buffer.size >= this._targetDepth;
  }

  /**
   * Returns buffer statistics
   * @returns {any}
   */
  getStats() {
    return {
      ...this._stats,
      currentLevel: this._buffer.size,
      targetDepth: this._targetDepth,
      bufferMs: this.getBufferMs(),
      lossRatio: this._stats.framesReceived > 0
        ? this._stats.plcFrames / this._stats.framesReceived
        : 0
    };
  }

  /**
   * Clears the buffer
   */
  clear() {
    this._buffer.clear();
    this._initialized = false;
    this._nextPlaySeq = 0;
  }

  /**
   * Pauses playback (stops advancing sequence)
   */
  pause() {
    this._paused = true;
  }

  /**
   * Resumes playback
   */
  resume() {
    this._paused = false;
  }
}

module.exports = JitterBuffer;
