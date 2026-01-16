'use strict';

/**
 * @fileoverview LC3 encoder with frame management
 * @module audio/codec/LC3Encoder
 */

const EventEmitter = require('../../../utils/EventEmitter');
const AudioError = require('../../../errors/AudioError');

/**
 * LC3 Encoder with internal sample buffering
 * @class LC3Encoder
 * @extends EventEmitter
 */
class LC3Encoder extends EventEmitter {
  /**
   * Creates a new LC3Encoder
   * @param {LC3Codec} codec - Initialized LC3 codec instance
   */
  constructor(codec) {
    super();

    if (!codec || !codec.isInitialized()) {
      throw AudioError.codecInitFailed({ reason: 'Codec must be initialized' });
    }

    /** @private */
    this._codec = codec;
    /** @private */
    this._frameSamples = codec.getFrameSamples();
    /** @private */
    this._sampleBuffer = new Int16Array(this._frameSamples * 2);
    /** @private */
    this._bufferOffset = 0;
    /** @private */
    this._framesEncoded = 0;
    /** @private */
    this._errors = 0;
  }

  /**
   * Pushes PCM samples and returns any complete encoded frames
   * @param {Int16Array} samples - PCM audio samples
   * @returns {Promise<Uint8Array[]>} Array of encoded LC3 frames
   */
  async pushSamples(samples) {
    const frames = [];
    let offset = 0;

    while (offset < samples.length) {
      const remaining = this._frameSamples - this._bufferOffset;
      const toCopy = Math.min(remaining, samples.length - offset);

      // Copy samples to buffer
      this._sampleBuffer.set(
        samples.subarray(offset, offset + toCopy),
        this._bufferOffset
      );
      this._bufferOffset += toCopy;
      offset += toCopy;

      // Encode if we have a complete frame
      if (this._bufferOffset >= this._frameSamples) {
        try {
          const frameData = this._sampleBuffer.slice(0, this._frameSamples);
          const encoded = await this._codec.encode(frameData);
          frames.push(encoded);
          this._framesEncoded++;
          this.emit('frame', { frame: encoded, index: this._framesEncoded });
        } catch (error) {
          this._errors++;
          this.emit('error', error);
        }
        this._bufferOffset = 0;
      }
    }

    return frames;
  }

  /**
   * Flushes any remaining samples (pads with silence if needed)
   * @returns {Promise<Uint8Array[]>} Array of encoded LC3 frames
   */
  async flush() {
    const frames = [];

    if (this._bufferOffset > 0) {
      // Pad remaining buffer with silence
      this._sampleBuffer.fill(0, this._bufferOffset, this._frameSamples);

      try {
        const frameData = this._sampleBuffer.slice(0, this._frameSamples);
        const encoded = await this._codec.encode(frameData);
        frames.push(encoded);
        this._framesEncoded++;
        this.emit('frame', { frame: encoded, index: this._framesEncoded, padded: true });
      } catch (error) {
        this._errors++;
        this.emit('error', error);
      }

      this._bufferOffset = 0;
    }

    return frames;
  }

  /**
   * Returns the number of buffered samples
   * @returns {number}
   */
  getBufferedSamples() {
    return this._bufferOffset;
  }

  /**
   * Returns encoder statistics
   * @returns {Object}
   */
  getStats() {
    return {
      framesEncoded: this._framesEncoded,
      errors: this._errors,
      bufferedSamples: this._bufferOffset,
      frameSamples: this._frameSamples
    };
  }

  /**
   * Resets the encoder state
   */
  reset() {
    this._bufferOffset = 0;
    this._sampleBuffer.fill(0);
  }
}

module.exports = LC3Encoder;
