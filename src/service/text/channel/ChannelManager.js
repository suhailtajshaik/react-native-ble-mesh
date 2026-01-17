'use strict';

/**
 * @fileoverview Channel subscription management for group messaging
 * @module service/text/channel/ChannelManager
 */

const EventEmitter = require('events');
const { MeshError } = require('../../../errors');
const { EVENTS, ERROR_CODE } = require('../../../constants');
const Channel = require('./Channel');

/**
 * Manages channel subscriptions and channel-based messaging.
 * @class ChannelManager
 * @extends EventEmitter
 */
class ChannelManager extends EventEmitter {
  constructor() {
    super();
    /** @private */
    this._channels = new Map();
  }

  /**
   * Joins a channel
   * @param {string} channelId - Channel ID
   * @param {string} [password] - Optional password
   * @returns {Channel}
   */
  joinChannel(channelId, password) {
    if (!channelId || typeof channelId !== 'string') {
      throw new MeshError('Invalid channel ID', ERROR_CODE.E801);
    }
    if (this._channels.has(channelId)) {
      throw new MeshError('Already joined this channel', ERROR_CODE.E601);
    }

    const channel = new Channel({
      id: channelId,
      name: channelId,
      password: password || null
    });

    this._channels.set(channelId, channel);
    this.emit(EVENTS.CHANNEL_JOINED, { channelId, channel: channel.toJSON() });
    return channel;
  }

  /**
   * Leaves a channel
   * @param {string} channelId - Channel ID
   */
  leaveChannel(channelId) {
    if (!this._channels.has(channelId)) {
      throw new MeshError('Not a member of this channel', ERROR_CODE.E602);
    }
    const channel = this._channels.get(channelId);
    this._channels.delete(channelId);
    this.emit(EVENTS.CHANNEL_LEFT, { channelId, memberCount: channel.getMemberCount() });
  }

  /**
   * Gets all joined channels
   * @returns {Object[]}
   */
  getChannels() {
    return Array.from(this._channels.values()).map(c => c.toJSON());
  }

  /**
   * Gets a specific channel
   * @param {string} channelId - Channel ID
   * @returns {Channel|undefined}
   */
  getChannel(channelId) {
    return this._channels.get(channelId);
  }

  /**
   * Checks if in a channel
   * @param {string} channelId - Channel ID
   * @returns {boolean}
   */
  isInChannel(channelId) {
    return this._channels.has(channelId);
  }

  /**
   * Gets members of a channel
   * @param {string} channelId - Channel ID
   * @returns {string[]}
   */
  getChannelMembers(channelId) {
    const channel = this._channels.get(channelId);
    return channel ? channel.getMembers() : [];
  }

  /**
   * Adds a member to a channel
   * @param {string} channelId - Channel ID
   * @param {string} peerId - Peer ID
   */
  addMember(channelId, peerId) {
    const channel = this._channels.get(channelId);
    if (channel && channel.addMember(peerId)) {
      this.emit(EVENTS.CHANNEL_MEMBER_JOINED, { channelId, peerId });
    }
  }

  /**
   * Removes a member from a channel
   * @param {string} channelId - Channel ID
   * @param {string} peerId - Peer ID
   */
  removeMember(channelId, peerId) {
    const channel = this._channels.get(channelId);
    if (channel && channel.removeMember(peerId)) {
      this.emit(EVENTS.CHANNEL_MEMBER_LEFT, { channelId, peerId });
    }
  }

  /**
   * Handles an incoming channel message
   * @param {Object} message - Message data
   */
  handleChannelMessage(message) {
    const { channelId, senderId, content, timestamp } = message;
    if (!this._channels.has(channelId)) { return; }

    const channel = this._channels.get(channelId);
    if (senderId && !channel.hasMember(senderId)) {
      channel.addMember(senderId);
      this.emit(EVENTS.CHANNEL_MEMBER_JOINED, { channelId, peerId: senderId });
    }
    const ts = timestamp || Date.now();
    this.emit(EVENTS.CHANNEL_MESSAGE, { channelId, senderId, content, timestamp: ts });
  }

  /**
   * Verifies a channel password
   * @param {string} channelId - Channel ID
   * @param {string} password - Password to verify
   * @returns {boolean}
   */
  verifyPassword(channelId, password) {
    const channel = this._channels.get(channelId);
    if (!channel) { return false; }
    return channel.validatePassword(password);
  }

  /**
   * Clears all channels
   */
  clear() {
    this._channels.clear();
  }

  /**
   * Gets channel statistics
   * @returns {Object}
   */
  getStats() {
    return {
      channelCount: this._channels.size,
      totalMembers: Array.from(this._channels.values()).reduce((s, c) => s + c.getMemberCount(), 0)
    };
  }
}

module.exports = ChannelManager;
