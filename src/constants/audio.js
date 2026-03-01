/**
 * @fileoverview Audio constants for LC3 codec and audio streaming
 * @module constants/audio
 */

'use strict';

/**
 * LC3 codec configuration
 * @constant {any}
 */
const LC3_CONFIG = Object.freeze({
  /** Supported sample rates (Hz) */
  SAMPLE_RATES: [16000, 24000, 32000, 48000],
  /** Default sample rate for voice (optimized for speech) */
  DEFAULT_SAMPLE_RATE: 16000,
  /** Supported frame durations (ms) */
  FRAME_DURATIONS: [7.5, 10],
  /** Default frame duration */
  DEFAULT_FRAME_DURATION_MS: 10,
  /** Bit rate presets (bps) */
  BIT_RATES: {
    LOW: 16000,
    MEDIUM: 24000,
    HIGH: 32000
  },
  /** Default bit rate for voice */
  DEFAULT_BIT_RATE: 24000,
  /** Channels */
  CHANNELS: {
    MONO: 1,
    STEREO: 2
  },
  /** Default channel count (mono for voice) */
  DEFAULT_CHANNELS: 1
});

/**
 * Audio quality presets
 * @constant {Object.<string, Object>}
 */
const AUDIO_QUALITY = Object.freeze({
  LOW: {
    sampleRate: 16000,
    bitRate: 16000,
    frameMs: 10,
    channels: 1
  },
  MEDIUM: {
    sampleRate: 16000,
    bitRate: 24000,
    frameMs: 10,
    channels: 1
  },
  HIGH: {
    sampleRate: 24000,
    bitRate: 32000,
    frameMs: 10,
    channels: 1
  }
});

/**
 * Voice message configuration
 * @constant {any}
 */
const VOICE_MESSAGE_CONFIG = Object.freeze({
  /** Maximum voice message duration in seconds */
  MAX_DURATION_SEC: 300,
  /** Maximum voice message size in bytes (512KB) */
  MAX_SIZE_BYTES: 512 * 1024,
  /** Chunk size for voice message data (fits BLE MTU) */
  CHUNK_SIZE: 180,
  /** Voice message assembly timeout in milliseconds */
  TIMEOUT_MS: 120000,
  /** Voice message header size */
  HEADER_SIZE: 51
});

/**
 * Audio streaming configuration
 * @constant {any}
 */
const AUDIO_STREAM_CONFIG = Object.freeze({
  /** Default jitter buffer size in frames */
  JITTER_BUFFER_FRAMES: 5,
  /** Maximum jitter buffer size in frames */
  MAX_JITTER_BUFFER_FRAMES: 20,
  /** Frame timeout in milliseconds */
  FRAME_TIMEOUT_MS: 100,
  /** Maximum consecutive dropped frames before quality event */
  MAX_DROPPED_FRAMES: 10,
  /** Session timeout in milliseconds */
  SESSION_TIMEOUT_MS: 60000,
  /** Audio frame header size */
  FRAME_HEADER_SIZE: 8
});

/**
 * Audio session states
 * @type {Record<string, string>}
 */
const AUDIO_SESSION_STATE = Object.freeze({
  IDLE: 'idle',
  REQUESTING: 'requesting',
  PENDING: 'pending',
  ACTIVE: 'active',
  PAUSED: 'paused',
  ENDING: 'ending',
  ENDED: 'ended',
  FAILED: 'failed'
});

/**
 * Audio codec types
 * @constant {Object.<string, number>}
 */
const AUDIO_CODEC_TYPE = Object.freeze({
  LC3: 0x01,
  OPUS: 0x02
});

module.exports = {
  LC3_CONFIG,
  AUDIO_QUALITY,
  VOICE_MESSAGE_CONFIG,
  AUDIO_STREAM_CONFIG,
  AUDIO_SESSION_STATE,
  AUDIO_CODEC_TYPE
};
