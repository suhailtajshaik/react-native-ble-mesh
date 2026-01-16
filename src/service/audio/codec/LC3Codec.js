'use strict';

/**
 * @fileoverview LC3 codec wrapper for React Native
 * @module audio/codec/LC3Codec
 */

const EventEmitter = require('../../../utils/EventEmitter');
const AudioError = require('../../../errors/AudioError');
const { LC3_CONFIG, AUDIO_QUALITY } = require('../../../constants/audio');

/**
 * LC3 Codec wrapper that bridges to React Native native modules
 * @class LC3Codec
 * @extends EventEmitter
 */
class LC3Codec extends EventEmitter {
  /**
   * Creates a new LC3Codec instance
   * @param {Object} [options] - Codec configuration
   * @param {number} [options.sampleRate=16000] - Sample rate in Hz
   * @param {number} [options.frameMs=10] - Frame duration in milliseconds
   * @param {number} [options.bitRate=24000] - Bit rate in bps
   * @param {number} [options.channels=1] - Number of audio channels
   */
  constructor(options = {}) {
    super();

    const quality = options.quality ? AUDIO_QUALITY[options.quality] : null;

    /** @private */
    this._sampleRate = quality?.sampleRate || options.sampleRate || LC3_CONFIG.DEFAULT_SAMPLE_RATE;
    /** @private */
    this._frameMs = quality?.frameMs || options.frameMs || LC3_CONFIG.DEFAULT_FRAME_DURATION_MS;
    /** @private */
    this._bitRate = quality?.bitRate || options.bitRate || LC3_CONFIG.DEFAULT_BIT_RATE;
    /** @private */
    this._channels = quality?.channels || options.channels || LC3_CONFIG.DEFAULT_CHANNELS;
    /** @private */
    this._initialized = false;
    /** @private */
    this._nativeModule = null;
    /** @private */
    this._useMock = false;

    this._validateConfig();
  }

  /**
   * Validates codec configuration
   * @private
   */
  _validateConfig() {
    if (!LC3_CONFIG.SAMPLE_RATES.includes(this._sampleRate)) {
      throw AudioError.invalidConfig(`Invalid sample rate: ${this._sampleRate}`);
    }
    if (!LC3_CONFIG.FRAME_DURATIONS.includes(this._frameMs)) {
      throw AudioError.invalidConfig(`Invalid frame duration: ${this._frameMs}`);
    }
  }

  /**
   * Initializes the codec
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this._initialized) {
      return;
    }

    try {
      // Try to load native module
      this._nativeModule = this._loadNativeModule();

      if (this._nativeModule) {
        await this._nativeModule.initialize({
          sampleRate: this._sampleRate,
          frameMs: this._frameMs,
          bitRate: this._bitRate,
          channels: this._channels
        });
      } else {
        // Use mock implementation for testing
        this._useMock = true;
        console.warn('LC3Codec: Native module not available, using mock implementation');
      }

      this._initialized = true;
      this.emit('initialized', this.getConfig());
    } catch (error) {
      throw AudioError.codecInitFailed({ reason: error.message });
    }
  }

  /**
   * Attempts to load the native LC3 module
   * @private
   * @returns {Object|null}
   */
  _loadNativeModule() {
    try {
      // Try React Native NativeModules
      const { NativeModules } = require('react-native');
      if (NativeModules && NativeModules.RNLc3Codec) {
        return NativeModules.RNLc3Codec;
      }
    } catch {
      // Not in React Native environment
    }
    return null;
  }

  /**
   * Returns whether the codec is initialized
   * @returns {boolean}
   */
  isInitialized() {
    return this._initialized;
  }

  /**
   * Returns whether using mock implementation
   * @returns {boolean}
   */
  isMock() {
    return this._useMock;
  }

  /**
   * Encodes PCM samples to LC3 frame
   * @param {Int16Array} pcmSamples - PCM audio samples
   * @returns {Promise<Uint8Array>} Encoded LC3 frame
   */
  async encode(pcmSamples) {
    if (!this._initialized) {
      throw AudioError.codecInitFailed({ reason: 'Codec not initialized' });
    }

    const expectedSamples = this.getFrameSamples();
    if (pcmSamples.length !== expectedSamples) {
      throw AudioError.encodingFailed({
        reason: `Expected ${expectedSamples} samples, got ${pcmSamples.length}`
      });
    }

    if (this._useMock) {
      return this._mockEncode(pcmSamples);
    }

    try {
      const result = await this._nativeModule.encode(Array.from(pcmSamples));
      return new Uint8Array(result);
    } catch (error) {
      throw AudioError.encodingFailed({ reason: error.message });
    }
  }

  /**
   * Decodes LC3 frame to PCM samples
   * @param {Uint8Array} lc3Frame - Encoded LC3 frame
   * @returns {Promise<Int16Array>} Decoded PCM samples
   */
  async decode(lc3Frame) {
    if (!this._initialized) {
      throw AudioError.codecInitFailed({ reason: 'Codec not initialized' });
    }

    if (this._useMock) {
      return this._mockDecode(lc3Frame);
    }

    try {
      const result = await this._nativeModule.decode(Array.from(lc3Frame));
      return new Int16Array(result);
    } catch (error) {
      throw AudioError.decodingFailed({ reason: error.message });
    }
  }

  /**
   * Generates PLC (Packet Loss Concealment) frame
   * @returns {Promise<Int16Array>} Concealed PCM samples
   */
  async decodePLC() {
    if (!this._initialized) {
      throw AudioError.codecInitFailed({ reason: 'Codec not initialized' });
    }

    if (this._useMock) {
      return this._mockDecodePLC();
    }

    try {
      const result = await this._nativeModule.decodePLC();
      return new Int16Array(result);
    } catch (error) {
      throw AudioError.decodingFailed({ reason: error.message });
    }
  }

  /**
   * Mock encode implementation for testing
   * @private
   */
  _mockEncode(pcmSamples) {
    // Simple mock: compress by taking every 4th sample and convert to bytes
    const frameBytes = this.getFrameBytes();
    const encoded = new Uint8Array(frameBytes);

    for (let i = 0; i < frameBytes && i * 2 < pcmSamples.length; i++) {
      const sample = pcmSamples[i * 2];
      encoded[i] = (sample >> 8) & 0xFF;
    }

    return encoded;
  }

  /**
   * Mock decode implementation for testing
   * @private
   */
  _mockDecode(lc3Frame) {
    const samples = this.getFrameSamples();
    const decoded = new Int16Array(samples);

    for (let i = 0; i < samples && i < lc3Frame.length; i++) {
      decoded[i * 2] = (lc3Frame[i] << 8);
      if (i * 2 + 1 < samples) {
        decoded[i * 2 + 1] = (lc3Frame[i] << 8);
      }
    }

    return decoded;
  }

  /**
   * Mock PLC implementation for testing
   * @private
   */
  _mockDecodePLC() {
    // Return silence for PLC
    return new Int16Array(this.getFrameSamples());
  }

  /**
   * Returns the number of samples per frame
   * @returns {number}
   */
  getFrameSamples() {
    return Math.floor(this._sampleRate * this._frameMs / 1000);
  }

  /**
   * Returns the encoded frame size in bytes
   * @returns {number}
   */
  getFrameBytes() {
    // LC3 frame size formula: bitRate * frameMs / 8000
    return Math.ceil(this._bitRate * this._frameMs / 8000);
  }

  /**
   * Returns the current codec configuration
   * @returns {Object}
   */
  getConfig() {
    return {
      sampleRate: this._sampleRate,
      frameMs: this._frameMs,
      bitRate: this._bitRate,
      channels: this._channels,
      frameSamples: this.getFrameSamples(),
      frameBytes: this.getFrameBytes(),
      isMock: this._useMock
    };
  }

  /**
   * Destroys the codec and releases resources
   */
  destroy() {
    if (this._nativeModule && typeof this._nativeModule.destroy === 'function') {
      this._nativeModule.destroy();
    }
    this._initialized = false;
    this._nativeModule = null;
    this.removeAllListeners();
  }
}

module.exports = LC3Codec;
