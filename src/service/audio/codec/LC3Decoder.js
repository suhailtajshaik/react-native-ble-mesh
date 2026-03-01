'use strict';

/**
 * @fileoverview LC3 decoder with PLC support
 * @module audio/codec/LC3Decoder
 */

const EventEmitter = require('../../../utils/EventEmitter');
const AudioError = require('../../../errors/AudioError');

/**
 * LC3 Decoder with Packet Loss Concealment
 * @class LC3Decoder
 * @extends EventEmitter
 */
class LC3Decoder extends EventEmitter {
  /**
   * Creates a new LC3Decoder
   * @param {any} codec - Initialized LC3 codec instance
   */
  constructor(codec) {
    super();

    if (!codec || !codec.isInitialized()) {
      throw AudioError.codecInitFailed({ reason: 'Codec must be initialized' });
    }

    /** @type {any} @private */
    this._codec = codec;
    /** @type {number} @private */
    this._frameSamples = codec.getFrameSamples();
    /** @type {number} @private */
    this._framesDecoded = 0;
    /** @type {number} @private */
    this._plcFrames = 0;
    /** @type {number} @private */
    this._errors = 0;
    /** @type {number} @private */
    this._lastSequence = -1;
  }

  /**
   * Decodes an LC3 frame to PCM samples
   * @param {Uint8Array} lc3Frame - Encoded LC3 frame
   * @param {number} [sequenceNumber] - Optional sequence number for gap detection
   * @returns {Promise<Int16Array>} Decoded PCM samples
   */
  async decode(lc3Frame, sequenceNumber) {
    // Check for gaps in sequence
    if (sequenceNumber !== undefined && this._lastSequence >= 0) {
      const gap = sequenceNumber - this._lastSequence - 1;
      if (gap > 0) {
        this.emit('gap-detected', { missing: gap, lastSeq: this._lastSequence });
      }
    }

    if (sequenceNumber !== undefined) {
      this._lastSequence = sequenceNumber;
    }

    try {
      const samples = await this._codec.decode(lc3Frame);
      this._framesDecoded++;
      this.emit('samples', { samples, index: this._framesDecoded });
      return samples;
    } catch (/** @type {any} */ error) {
      this._errors++;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Generates a PLC frame for packet loss concealment
   * @returns {Promise<Int16Array>} Concealed PCM samples
   */
  async decodePLC() {
    try {
      const samples = await this._codec.decodePLC();
      this._plcFrames++;
      this.emit('plc', { samples, plcCount: this._plcFrames });
      return samples;
    } catch (/** @type {any} */ error) {
      this._errors++;
      this.emit('error', error);
      // Return silence on PLC failure
      return new Int16Array(this._frameSamples);
    }
  }

  /**
   * Decodes a frame or generates PLC if frame is missing
   * @param {Uint8Array|null} lc3Frame - LC3 frame or null for PLC
   * @param {number} [sequenceNumber] - Sequence number
   * @returns {Promise<{samples: Int16Array, isPLC: boolean}>}
   */
  async decodeOrPLC(lc3Frame, sequenceNumber) {
    if (lc3Frame === null || lc3Frame === undefined) {
      const samples = await this.decodePLC();
      return { samples, isPLC: true };
    }

    const samples = await this.decode(lc3Frame, sequenceNumber);
    return { samples, isPLC: false };
  }

  /**
   * Returns decoder statistics
   * @returns {any}
   */
  getStats() {
    return {
      framesDecoded: this._framesDecoded,
      plcFrames: this._plcFrames,
      errors: this._errors,
      plcRatio: this._framesDecoded > 0
        ? this._plcFrames / (this._framesDecoded + this._plcFrames)
        : 0,
      lastSequence: this._lastSequence
    };
  }

  /**
   * Resets the decoder state
   */
  reset() {
    this._lastSequence = -1;
  }
}

module.exports = LC3Decoder;
