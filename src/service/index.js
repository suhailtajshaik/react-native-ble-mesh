'use strict';

/**
 * @fileoverview Service module exports
 * @module service
 */

const MeshService = require('./MeshService');
const SessionManager = require('./SessionManager');
const HandshakeManager = require('./HandshakeManager');

// Audio module
const audio = require('./audio');

// Text module
const text = require('./text');

module.exports = {
  MeshService,
  SessionManager,
  HandshakeManager,

  // Audio exports
  AudioManager: audio.AudioManager,
  LC3Codec: audio.LC3Codec,
  VoiceMessage: audio.VoiceMessage,
  AudioSession: audio.AudioSession,

  // Text exports
  TextManager: text.TextManager,
  TextMessage: text.TextMessage,
  Channel: text.Channel,
  ChannelManager: text.ChannelManager,
  BroadcastManager: text.BroadcastManager,

  // Submodules
  audio,
  text
};
