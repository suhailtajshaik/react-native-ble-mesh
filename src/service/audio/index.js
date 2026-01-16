'use strict';

/**
 * @fileoverview Audio module exports for LC3 codec and voice messaging
 * @module service/audio
 */

const codec = require('./codec');
const buffer = require('./buffer');
const transport = require('./transport');
const session = require('./session');
const AudioManager = require('./AudioManager');

module.exports = {
  // Main service
  AudioManager,

  // Codec
  LC3Codec: codec.LC3Codec,
  LC3Encoder: codec.LC3Encoder,
  LC3Decoder: codec.LC3Decoder,

  // Buffers
  FrameBuffer: buffer.FrameBuffer,
  JitterBuffer: buffer.JitterBuffer,

  // Transport
  AudioFramer: transport,
  AudioFragmenter: transport.AudioFragmenter,
  AudioAssembler: transport.AudioAssembler,

  // Session
  VoiceMessage: session.VoiceMessage,
  VoiceMessageRecorder: session.VoiceMessageRecorder,
  AudioSession: session.AudioSession,

  // Submodules for advanced usage
  codec,
  buffer,
  transport,
  session
};
