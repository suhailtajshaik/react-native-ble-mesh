'use strict';

/**
 * @fileoverview Channel subscription management for group messaging
 * @module service/ChannelManager
 */

const EventEmitter = require('events');
const { MeshError } = require('../errors');
const { EVENTS, ERROR_CODE } = require('../constants');

/**
 * Manages channel subscriptions and channel-based messaging.
 * @class ChannelManager
 * @extends EventEmitter
 */
class ChannelManager extends EventEmitter {
  constructor() {
    super();
    this._channels = new Map();
    this._passwords = new Map();
  }

  joinChannel(channelId, password) {
    if (!channelId || typeof channelId !== 'string') {
      throw new MeshError('Invalid channel ID', ERROR_CODE.E801);
    }
    if (this._channels.has(channelId)) {
      throw new MeshError('Already joined this channel', ERROR_CODE.E601);
    }

    const channel = {
      id: channelId, name: channelId, members: new Set(),
      isPasswordProtected: !!password, createdAt: Date.now(), joinedAt: Date.now()
    };

    if (password) this._passwords.set(channelId, this._hashPassword(password));
    this._channels.set(channelId, channel);
    this.emit(EVENTS.CHANNEL_JOINED, { channelId, channel: this._serialize(channel) });
  }

  leaveChannel(channelId) {
    if (!this._channels.has(channelId)) {
      throw new MeshError('Not a member of this channel', ERROR_CODE.E602);
    }
    const channel = this._channels.get(channelId);
    this._channels.delete(channelId);
    this._passwords.delete(channelId);
    this.emit(EVENTS.CHANNEL_LEFT, { channelId, memberCount: channel.members.size });
  }

  getChannels() {
    return Array.from(this._channels.values()).map(c => this._serialize(c));
  }

  getChannel(channelId) {
    const ch = this._channels.get(channelId);
    return ch ? this._serialize(ch) : undefined;
  }

  isInChannel(channelId) { return this._channels.has(channelId); }

  getChannelMembers(channelId) {
    const ch = this._channels.get(channelId);
    return ch ? Array.from(ch.members) : [];
  }

  addMember(channelId, peerId) {
    const ch = this._channels.get(channelId);
    if (ch && !ch.members.has(peerId)) {
      ch.members.add(peerId);
      this.emit(EVENTS.CHANNEL_MEMBER_JOINED, { channelId, peerId });
    }
  }

  removeMember(channelId, peerId) {
    const ch = this._channels.get(channelId);
    if (ch && ch.members.has(peerId)) {
      ch.members.delete(peerId);
      this.emit(EVENTS.CHANNEL_MEMBER_LEFT, { channelId, peerId });
    }
  }

  handleChannelMessage(message) {
    const { channelId, senderId, content, timestamp } = message;
    if (!this._channels.has(channelId)) return;

    const ch = this._channels.get(channelId);
    if (senderId && !ch.members.has(senderId)) {
      ch.members.add(senderId);
      this.emit(EVENTS.CHANNEL_MEMBER_JOINED, { channelId, peerId: senderId });
    }
    this.emit(EVENTS.CHANNEL_MESSAGE, { channelId, senderId, content, timestamp: timestamp || Date.now() });
  }

  verifyPassword(channelId, password) {
    const stored = this._passwords.get(channelId);
    if (!stored) return true;
    return this._constantTimeEqual(stored, this._hashPassword(password));
  }

  clear() {
    this._channels.clear();
    this._passwords.clear();
  }

  getStats() {
    return {
      channelCount: this._channels.size,
      totalMembers: Array.from(this._channels.values()).reduce((s, c) => s + c.members.size, 0)
    };
  }

  _serialize(channel) {
    return {
      id: channel.id, name: channel.name, memberCount: channel.members.size,
      members: Array.from(channel.members), isPasswordProtected: channel.isPasswordProtected,
      createdAt: channel.createdAt, joinedAt: channel.joinedAt
    };
  }

  _hashPassword(password) {
    const data = new TextEncoder().encode(password);
    const hash = new Uint8Array(32);
    for (let i = 0; i < data.length; i++) hash[i % 32] ^= data[i];
    return hash;
  }

  _constantTimeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  }
}

module.exports = ChannelManager;
