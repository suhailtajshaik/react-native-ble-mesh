'use strict';

/**
 * @fileoverview Audio session module exports
 * @module audio/session
 */

const { VoiceMessage, VoiceMessageRecorder, VOICE_MESSAGE_HEADER_SIZE } = require('./VoiceMessage');
const AudioSession = require('./AudioSession');

module.exports = {
  VoiceMessage,
  VoiceMessageRecorder,
  AudioSession,
  VOICE_MESSAGE_HEADER_SIZE
};
