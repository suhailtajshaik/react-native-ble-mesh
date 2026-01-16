'use strict';

/**
 * @fileoverview Audio streaming session management
 * @module audio/session/AudioSession
 */

const EventEmitter = require('../../../utils/EventEmitter');
const AudioError = require('../../../errors/AudioError');
const { AUDIO_SESSION_STATE, AUDIO_STREAM_CONFIG } = require('../../../constants/audio');
const JitterBuffer = require('../buffer/JitterBuffer');
const LC3Encoder = require('../codec/LC3Encoder');
const LC3Decoder = require('../codec/LC3Decoder');

/**
 * Audio streaming session between two peers
 * @class AudioSession
 * @extends EventEmitter
 */
class AudioSession extends EventEmitter {
  /**
   * Creates a new AudioSession
   * @param {Object} options - Session options
   * @param {string} options.peerId - Remote peer ID
   * @param {LC3Codec} options.codec - Initialized codec
   * @param {boolean} options.isInitiator - Whether local peer initiated
   * @param {Function} [options.sendCallback] - Callback to send data
   */
  constructor(options) {
    super();

    const { peerId, codec, isInitiator, sendCallback } = options;

    if (!codec || !codec.isInitialized()) {
      throw AudioError.codecInitFailed({ reason: 'Codec must be initialized' });
    }

    /** @private */
    this._peerId = peerId;
    /** @private */
    this._codec = codec;
    /** @private */
    this._isInitiator = isInitiator;
    /** @private */
    this._sendCallback = sendCallback || (() => {});
    /** @private */
    this._state = AUDIO_SESSION_STATE.IDLE;
    /** @private */
    this._encoder = new LC3Encoder(codec);
    /** @private */
    this._decoder = new LC3Decoder(codec);
    /** @private */
    this._jitterBuffer = new JitterBuffer({
      depth: AUDIO_STREAM_CONFIG.JITTER_BUFFER_FRAMES,
      frameMs: codec.getConfig().frameMs
    });
    /** @private */
    this._sendSequence = 0;
    /** @private */
    this._startTime = null;
    /** @private */
    this._stats = {
      framesSent: 0,
      framesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0
    };

    this._setupBufferEvents();
  }

  /**
   * Sets up jitter buffer event forwarding
   * @private
   */
  _setupBufferEvents() {
    this._jitterBuffer.on('underrun', (data) => {
      this.emit('underrun', data);
    });

    this._jitterBuffer.on('ready', () => {
      this.emit('audio-ready');
    });
  }

  /**
   * Starts the audio session
   * @returns {Promise<void>}
   */
  async start() {
    if (this._state !== AUDIO_SESSION_STATE.IDLE &&
        this._state !== AUDIO_SESSION_STATE.PENDING) {
      throw AudioError.sessionFailed(this._peerId, { reason: 'Invalid state for start' });
    }

    this._setState(AUDIO_SESSION_STATE.ACTIVE);
    this._startTime = Date.now();
  }

  /**
   * Sends audio samples
   * @param {Int16Array} samples - PCM audio samples
   * @returns {Promise<void>}
   */
  async sendAudio(samples) {
    if (this._state !== AUDIO_SESSION_STATE.ACTIVE) {
      return;
    }

    const frames = await this._encoder.pushSamples(samples);

    for (const frame of frames) {
      const timestampDelta = Date.now() - this._startTime;

      await this._sendCallback({
        peerId: this._peerId,
        frame,
        sequenceNumber: this._sendSequence++,
        timestampDelta
      });

      this._stats.framesSent++;
      this._stats.bytesSent += frame.length;
    }
  }

  /**
   * Receives an audio frame
   * @param {Uint8Array} frame - LC3 audio frame
   * @param {number} sequenceNumber - Frame sequence number
   * @param {number} [timestamp] - Frame timestamp
   */
  receiveAudio(frame, sequenceNumber, timestamp) {
    if (this._state !== AUDIO_SESSION_STATE.ACTIVE) {
      return;
    }

    this._jitterBuffer.push(frame, sequenceNumber, timestamp);
    this._stats.framesReceived++;
    this._stats.bytesReceived += frame.length;
  }

  /**
   * Gets decoded audio for playback
   * @returns {Promise<{samples: Int16Array, isPLC: boolean}|null>}
   */
  async getAudio() {
    if (this._state !== AUDIO_SESSION_STATE.ACTIVE) {
      return null;
    }

    const { frame, isPLC, sequenceNumber } = this._jitterBuffer.pop();

    if (isPLC) {
      const samples = await this._decoder.decodePLC();
      return { samples, isPLC: true, sequenceNumber };
    }

    if (frame) {
      const samples = await this._decoder.decode(frame, sequenceNumber);
      return { samples, isPLC: false, sequenceNumber };
    }

    return null;
  }

  /**
   * Pauses the session
   */
  pause() {
    if (this._state === AUDIO_SESSION_STATE.ACTIVE) {
      this._setState(AUDIO_SESSION_STATE.PAUSED);
      this._jitterBuffer.pause();
    }
  }

  /**
   * Resumes the session
   */
  resume() {
    if (this._state === AUDIO_SESSION_STATE.PAUSED) {
      this._setState(AUDIO_SESSION_STATE.ACTIVE);
      this._jitterBuffer.resume();
    }
  }

  /**
   * Ends the session
   * @returns {Promise<void>}
   */
  async end() {
    if (this._state === AUDIO_SESSION_STATE.ENDED ||
        this._state === AUDIO_SESSION_STATE.FAILED) {
      return;
    }

    this._setState(AUDIO_SESSION_STATE.ENDING);

    // Flush encoder
    await this._encoder.flush();

    this._setState(AUDIO_SESSION_STATE.ENDED);
    this.emit('ended', { peerId: this._peerId, stats: this.getStats() });
  }

  /**
   * Destroys the session
   */
  destroy() {
    this._jitterBuffer.clear();
    this._encoder.reset();
    this._decoder.reset();
    this.removeAllListeners();
  }

  /**
   * Sets session state
   * @private
   */
  _setState(newState) {
    const oldState = this._state;
    this._state = newState;
    this.emit('state-changed', { oldState, newState, peerId: this._peerId });
  }

  /**
   * Returns session state
   * @returns {string}
   */
  getState() {
    return this._state;
  }

  /**
   * Returns peer ID
   * @returns {string}
   */
  getPeerId() {
    return this._peerId;
  }

  /**
   * Returns whether this peer initiated
   * @returns {boolean}
   */
  isInitiator() {
    return this._isInitiator;
  }

  /**
   * Returns session statistics
   * @returns {Object}
   */
  getStats() {
    const bufferStats = this._jitterBuffer.getStats();
    const encoderStats = this._encoder.getStats();
    const decoderStats = this._decoder.getStats();

    return {
      ...this._stats,
      state: this._state,
      peerId: this._peerId,
      durationMs: this._startTime ? Date.now() - this._startTime : 0,
      buffer: bufferStats,
      encoder: encoderStats,
      decoder: decoderStats
    };
  }

  /**
   * Sets the state to pending (waiting for acceptance)
   */
  setPending() {
    this._setState(AUDIO_SESSION_STATE.PENDING);
  }

  /**
   * Sets the state to requesting
   */
  setRequesting() {
    this._setState(AUDIO_SESSION_STATE.REQUESTING);
  }

  /**
   * Marks session as failed
   * @param {string} [reason] - Failure reason
   */
  setFailed(reason) {
    this._setState(AUDIO_SESSION_STATE.FAILED);
    this.emit('error', AudioError.sessionFailed(this._peerId, { reason }));
  }
}

module.exports = AudioSession;
