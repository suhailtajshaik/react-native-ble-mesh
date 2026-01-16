'use strict';

/**
 * @fileoverview Text messaging module exports
 * @module service/text
 */

const TextManager = require('./TextManager');
const message = require('./message');
const channel = require('./channel');
const broadcast = require('./broadcast');

module.exports = {
  // Main service
  TextManager,

  // Message
  TextMessage: message.TextMessage,

  // Channel
  Channel: channel.Channel,
  ChannelManager: channel.ChannelManager,

  // Broadcast
  BroadcastManager: broadcast.BroadcastManager,

  // Submodules for advanced usage
  message,
  channel,
  broadcast
};
