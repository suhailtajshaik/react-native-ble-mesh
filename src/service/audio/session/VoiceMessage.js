'use strict';

/**
 * @fileoverview Voice message recording and playback
 * @module audio/session/VoiceMessage
 */

const EventEmitter = require('../../../utils/EventEmitter');
const AudioError = require('../../../errors/AudioError');
const { VOICE_MESSAGE_CONFIG, AUDIO_CODEC_TYPE } = require('../../../constants/audio');
const FrameBuffer = require('../buffer/FrameBuffer');

/**
 * Voice message header size
 * @constant {number}
 */
const VOICE_MESSAGE_HEADER_SIZE = VOICE_MESSAGE_CONFIG.HEADER_SIZE;

/**
 * Voice message magic bytes
 * @constant {Uint8Array}
 */
const VOICE_MESSAGE_MAGIC = new Uint8Array([0x56, 0x4D, 0x53, 0x47]); // 'VMSG'

/**
 * Voice message for store-and-forward audio
 * @class VoiceMessage
 */
class VoiceMessage {
  /**
   * Creates a VoiceMessage from recorded frames
   * @param {any} options - Message options
   */
  constructor(options) {
    const { frames, metadata, senderId } = options;

    /** @type {any} @private */
    this._frames = frames;
    /** @type {any} @private */
    this._metadata = {
      version: 1,
      codec: metadata.codec || AUDIO_CODEC_TYPE.LC3,
      sampleRate: metadata.sampleRate || 16000,
      bitRate: metadata.bitRate || 24000,
      frameMs: metadata.frameMs || 10,
      channels: metadata.channels || 1,
      createdAt: metadata.createdAt || Date.now()
    };
    /** @type {Uint8Array} @private */
    this._senderId = senderId || new Uint8Array(32);
    /** @type {number} @private */
    this._playbackPosition = 0;
  }

  /**
   * Starts recording a new voice message
   * @param {any} options - Recording options
   * @returns {VoiceMessageRecorder}
   */
  static startRecording(options) {
    // eslint-disable-next-line no-use-before-define
    return new VoiceMessageRecorder(options);
  }

  /**
   * Creates a VoiceMessage from serialized data
   * @param {Uint8Array} data - Serialized voice message
   * @returns {VoiceMessage}
   */
  static fromSerialized(data) {
    if (data.length < VOICE_MESSAGE_HEADER_SIZE) {
      throw AudioError.decodingFailed({ reason: 'Voice message too short' });
    }

    // Verify magic
    for (let i = 0; i < 4; i++) {
      if (data[i] !== VOICE_MESSAGE_MAGIC[i]) {
        throw AudioError.decodingFailed({ reason: 'Invalid voice message magic' });
      }
    }

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    const metadata = {
      version: data[4],
      codec: data[5],
      sampleRate: view.getUint16(6, false),
      bitRate: view.getUint16(8, false),
      frameMs: data[10] / 10,
      channels: data[11],
      totalFrames: view.getUint32(12, false),
      durationMs: view.getUint32(16, false),
      createdAt: view.getUint32(20, false) * 1000
    };

    const senderId = data.slice(24, 56);
    const frameData = data.slice(VOICE_MESSAGE_HEADER_SIZE);
    const frames = FrameBuffer.deserialize(frameData);

    return new VoiceMessage({ frames, metadata, senderId });
  }

  /**
   * Serializes the voice message
   * @returns {Uint8Array}
   */
  serialize() {
    const frameData = this._frames.serialize();
    const totalLen = VOICE_MESSAGE_HEADER_SIZE + frameData.length;
    const result = new Uint8Array(totalLen);
    const view = new DataView(result.buffer);

    // Header
    result.set(VOICE_MESSAGE_MAGIC, 0);
    result[4] = this._metadata.version;
    result[5] = this._metadata.codec;
    view.setUint16(6, this._metadata.sampleRate, false);
    view.setUint16(8, this._metadata.bitRate, false);
    result[10] = Math.round(this._metadata.frameMs * 10);
    result[11] = this._metadata.channels;
    view.setUint32(12, this._frames.getFrameCount(), false);
    view.setUint32(16, this.getDurationMs(), false);
    view.setUint32(20, Math.floor(this._metadata.createdAt / 1000), false);
    result.set(this._senderId.slice(0, 32), 24);

    // Frame data
    result.set(frameData, VOICE_MESSAGE_HEADER_SIZE);

    return result;
  }

  /**
   * Returns duration in milliseconds
   * @returns {number}
   */
  getDurationMs() {
    return this._frames.getDurationMs(this._metadata.frameMs);
  }

  /**
   * Returns total size in bytes
   * @returns {number}
   */
  getSize() {
    return VOICE_MESSAGE_HEADER_SIZE + this._frames.getTotalBytes();
  }

  /**
   * Returns frame count
   * @returns {number}
   */
  getFrameCount() {
    return this._frames.getFrameCount();
  }

  /**
   * Returns metadata
   * @returns {any}
   */
  getMetadata() {
    return {
      ...this._metadata,
      frameCount: this._frames.getFrameCount(),
      durationMs: this.getDurationMs(),
      size: this.getSize()
    };
  }

  /**
   * Returns sender ID
   * @returns {Uint8Array}
   */
  getSenderId() {
    return this._senderId;
  }

  /**
   * Gets frame at index for playback
   * @param {number} index - Frame index
   * @returns {Uint8Array|null}
   */
  getFrame(index) {
    return this._frames.getFrame(index);
  }

  /**
   * Gets next frame for playback
   * @returns {any}
   */
  getNextFrame() {
    if (this._playbackPosition >= this._frames.getFrameCount()) {
      return { frame: null, index: this._playbackPosition, done: true };
    }

    const frame = this._frames.getFrame(this._playbackPosition);
    const index = this._playbackPosition;
    this._playbackPosition++;

    return { frame, index, done: false };
  }

  /**
   * Seeks to position in milliseconds
   * @param {number} positionMs - Position in ms
   */
  seek(positionMs) {
    const frameIndex = Math.floor(positionMs / this._metadata.frameMs);
    this._playbackPosition = Math.max(0, Math.min(frameIndex, this._frames.getFrameCount()));
  }

  /**
   * Resets playback position
   */
  resetPlayback() {
    this._playbackPosition = 0;
  }

  /**
   * Returns current playback position in ms
   * @returns {number}
   */
  getPlaybackPositionMs() {
    return this._playbackPosition * this._metadata.frameMs;
  }
}

/**
 * Voice message recorder
 * @class VoiceMessageRecorder
 * @extends EventEmitter
 */
class VoiceMessageRecorder extends EventEmitter {
  /**
   * Creates a new recorder
   * @param {any} options - Recorder options
   */
  constructor(options) {
    super();

    const { codec, senderId } = options;

    if (!codec || !codec.isInitialized()) {
      throw AudioError.codecInitFailed({ reason: 'Codec must be initialized' });
    }

    /** @type {any} @private */
    this._codec = codec;
    /** @type {Uint8Array} @private */
    this._senderId = senderId || new Uint8Array(32);
    /** @private */
    this._frames = new FrameBuffer();
    /** @type {any} @private */
    this._encoder = null;
    /** @type {number} @private */
    this._startTime = Date.now();
    /** @type {boolean} @private */
    this._cancelled = false;
    /** @type {any} @private */
    this._config = codec.getConfig();

    // Lazy load encoder
    const LC3Encoder = require('../codec/LC3Encoder');
    this._encoder = new LC3Encoder(codec);
  }

  /**
   * Pushes PCM samples to recording
   * @param {Int16Array} samples - PCM audio samples
   * @returns {Promise<void>}
   */
  async pushSamples(samples) {
    if (this._cancelled) { return; }

    const frames = await this._encoder.pushSamples(samples);

    for (const frame of frames) {
      const added = this._frames.push(frame);

      if (!added) {
        this.emit('limit-warning', {
          type: 'size',
          current: this._frames.getTotalBytes(),
          max: VOICE_MESSAGE_CONFIG.MAX_SIZE_BYTES
        });
        return;
      }

      this.emit('frame', {
        index: this._frames.getFrameCount(),
        durationMs: this.getDurationMs()
      });
    }

    // Check duration limit
    if (this.getDurationMs() >= VOICE_MESSAGE_CONFIG.MAX_DURATION_SEC * 1000) {
      this.emit('limit-warning', {
        type: 'duration',
        current: this.getDurationMs(),
        max: VOICE_MESSAGE_CONFIG.MAX_DURATION_SEC * 1000
      });
    }
  }

  /**
   * Stops recording and returns voice message
   * @returns {Promise<VoiceMessage>}
   */
  async stop() {
    if (this._cancelled) {
      throw AudioError.fromCode('EA00', { reason: 'Recording cancelled' });
    }

    // Flush remaining samples
    const frames = await this._encoder.flush();
    for (const frame of frames) {
      this._frames.push(frame);
    }

    return new VoiceMessage({
      frames: this._frames,
      metadata: {
        codec: AUDIO_CODEC_TYPE.LC3,
        sampleRate: this._config.sampleRate,
        bitRate: this._config.bitRate,
        frameMs: this._config.frameMs,
        channels: this._config.channels,
        createdAt: this._startTime
      },
      senderId: this._senderId
    });
  }

  /**
   * Cancels recording
   */
  cancel() {
    this._cancelled = true;
    this._frames.clear();
  }

  /**
   * Returns current duration in ms
   * @returns {number}
   */
  getDurationMs() {
    return this._frames.getDurationMs(this._config.frameMs);
  }

  /**
   * Returns current size in bytes
   * @returns {number}
   */
  getSize() {
    return this._frames.getTotalBytes();
  }

  /**
   * Returns recording status
   * @returns {boolean}
   */
  isRecording() {
    return !this._cancelled;
  }
}

module.exports = {
  VoiceMessage,
  VoiceMessageRecorder,
  VOICE_MESSAGE_HEADER_SIZE,
  VOICE_MESSAGE_MAGIC
};
