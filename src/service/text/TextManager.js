'use strict';

/**
 * @fileoverview Main text messaging orchestrator
 * @module service/text/TextManager
 */

const EventEmitter = require('events');
const { MeshError } = require('../../errors');
const { MESSAGE_TYPE, EVENTS, ERROR_CODE } = require('../../constants');
const TextMessage = require('./message/TextMessage');
const { ChannelManager } = require('./channel');
const { BroadcastManager } = require('./broadcast');

/**
 * Text manager states
 * @constant {Object}
 */
const MANAGER_STATE = Object.freeze({
  UNINITIALIZED: 'uninitialized',
  INITIALIZING: 'initializing',
  READY: 'ready',
  ACTIVE: 'active',
  ERROR: 'error',
  DESTROYED: 'destroyed'
});

/**
 * Main text messaging orchestrator
 * @class TextManager
 * @extends EventEmitter
 */
class TextManager extends EventEmitter {
  /**
   * Creates a new TextManager
   * @param {Object} [options] - Manager options
   */
  constructor(options = {}) {
    super();

    /** @private */
    this._state = MANAGER_STATE.UNINITIALIZED;
    /** @private */
    this._meshService = null;
    /** @private */
    this._channelManager = new ChannelManager();
    /** @private */
    this._broadcastManager = new BroadcastManager(options.broadcast);
    /** @private */
    this._senderId = null;
    /** @private */
    this._messageCounter = 0;
    /** @private */
    this._pendingReadReceipts = new Set();
    /** @private */
    this._readReceiptBatchTimeout = null;
    /** @private */
    this._readReceiptBatchDelayMs = options.readReceiptBatchDelayMs || 1000;
  }

  /**
   * Initializes the text manager
   * @param {MeshService} meshService - Mesh service instance
   * @returns {Promise<void>}
   */
  async initialize(meshService) {
    if (this._state !== MANAGER_STATE.UNINITIALIZED) {
      return;
    }

    this._setState(MANAGER_STATE.INITIALIZING);

    try {
      this._meshService = meshService;

      // Get sender ID from mesh service
      const identity = meshService.getIdentity?.() || {};
      this._senderId = identity.publicKey
        ? this._publicKeyToId(identity.publicKey)
        : 'unknown';

      // Initialize broadcast manager
      this._broadcastManager.initialize({
        senderId: this._senderId,
        sendCallback: (message) => this._sendBroadcastMessage(message)
      });

      // Setup event forwarding
      this._setupEventForwarding();

      this._setState(MANAGER_STATE.READY);
      this.emit('initialized');
    } catch (error) {
      this._setState(MANAGER_STATE.ERROR);
      throw new MeshError(`Text manager initialization failed: ${error.message}`, ERROR_CODE.E001);
    }
  }

  /**
   * Destroys the text manager
   * @returns {Promise<void>}
   */
  async destroy() {
    if (this._readReceiptBatchTimeout) {
      clearTimeout(this._readReceiptBatchTimeout);
      this._readReceiptBatchTimeout = null;
    }

    this._channelManager.clear();
    this._broadcastManager.clear();
    this._pendingReadReceipts.clear();

    this._setState(MANAGER_STATE.DESTROYED);
    this.emit('destroyed');
    this.removeAllListeners();
  }

  // ==================== Private Messages ====================

  /**
   * Sends a private message to a peer
   * @param {string} peerId - Recipient peer ID
   * @param {string} content - Message content
   * @returns {Promise<string>} Message ID
   */
  async sendPrivateMessage(peerId, content) {
    this._validateReady();

    const message = TextMessage.fromString(content, {
      senderId: this._senderId,
      recipientId: peerId
    });

    const messageId = message.getId();
    const serialized = message.serialize();

    // Send via mesh service
    await this._sendMessage(peerId, MESSAGE_TYPE.PRIVATE_MESSAGE, serialized);

    this.emit(EVENTS.PRIVATE_MESSAGE_SENT, {
      messageId,
      peerId,
      content,
      timestamp: message.getTimestamp()
    });

    return messageId;
  }

  /**
   * Handles an incoming private message
   * @param {string} peerId - Sender peer ID
   * @param {Uint8Array} payload - Message payload
   */
  handlePrivateMessage(peerId, payload) {
    let message;

    try {
      message = TextMessage.fromSerialized(payload);
    } catch {
      // Treat as plain text
      const content = new TextDecoder().decode(payload);
      message = TextMessage.fromString(content, { senderId: peerId });
    }

    this.emit(EVENTS.PRIVATE_MESSAGE_RECEIVED, {
      messageId: message.getId(),
      peerId,
      content: message.getContent(),
      timestamp: message.getTimestamp(),
      message
    });
  }

  // ==================== Broadcasts ====================

  /**
   * Sends a broadcast message
   * @param {string} content - Message content
   * @returns {string} Message ID
   */
  sendBroadcast(content) {
    this._validateReady();
    return this._broadcastManager.broadcast(content);
  }

  /**
   * Handles an incoming broadcast
   * @param {string} peerId - Sender peer ID
   * @param {Uint8Array} payload - Message payload
   */
  handleBroadcast(peerId, payload) {
    this._broadcastManager.handleIncomingBroadcast(peerId, payload);
  }

  /**
   * Gets recent broadcasts
   * @param {number} [limit] - Maximum number to return
   * @returns {TextMessage[]}
   */
  getRecentBroadcasts(limit) {
    return this._broadcastManager.getRecentBroadcasts(limit);
  }

  // ==================== Channels ====================

  /**
   * Joins a channel
   * @param {string} channelId - Channel ID
   * @param {string} [password] - Optional password
   */
  joinChannel(channelId, password) {
    this._validateReady();
    return this._channelManager.joinChannel(channelId, password);
  }

  /**
   * Leaves a channel
   * @param {string} channelId - Channel ID
   */
  leaveChannel(channelId) {
    this._validateReady();
    this._channelManager.leaveChannel(channelId);
  }

  /**
   * Sends a message to a channel
   * @param {string} channelId - Channel ID
   * @param {string} content - Message content
   * @returns {string} Message ID
   */
  sendChannelMessage(channelId, content) {
    this._validateReady();

    if (!this._channelManager.isInChannel(channelId)) {
      throw new MeshError('Not in channel', ERROR_CODE.E602);
    }

    const message = TextMessage.fromString(content, {
      senderId: this._senderId,
      channelId
    });

    const messageId = message.getId();

    // Emit channel message (MeshService will handle actual routing)
    this.emit(EVENTS.CHANNEL_MESSAGE, {
      messageId,
      channelId,
      content,
      timestamp: message.getTimestamp()
    });

    return messageId;
  }

  /**
   * Handles an incoming channel message
   * @param {string} peerId - Sender peer ID
   * @param {string} channelId - Channel ID
   * @param {Uint8Array} payload - Message payload
   */
  handleChannelMessage(peerId, channelId, payload) {
    let content;

    try {
      const message = TextMessage.fromSerialized(payload);
      content = message.getContent();
    } catch {
      content = new TextDecoder().decode(payload);
    }

    this._channelManager.handleChannelMessage({
      channelId,
      senderId: peerId,
      content,
      timestamp: Date.now()
    });
  }

  /**
   * Gets all joined channels
   * @returns {Object[]}
   */
  getChannels() {
    return this._channelManager.getChannels();
  }

  /**
   * Gets a specific channel
   * @param {string} channelId - Channel ID
   * @returns {Channel|undefined}
   */
  getChannel(channelId) {
    return this._channelManager.getChannel(channelId);
  }

  /**
   * Checks if in a channel
   * @param {string} channelId - Channel ID
   * @returns {boolean}
   */
  isInChannel(channelId) {
    return this._channelManager.isInChannel(channelId);
  }

  // ==================== Read Receipts ====================

  /**
   * Sends read receipts for messages
   * @param {string[]} messageIds - Message IDs to acknowledge
   */
  sendReadReceipt(messageIds) {
    this._validateReady();

    for (const messageId of messageIds) {
      this._pendingReadReceipts.add(messageId);
    }

    // Batch read receipts
    if (!this._readReceiptBatchTimeout) {
      this._readReceiptBatchTimeout = setTimeout(() => {
        this._flushReadReceipts();
      }, this._readReceiptBatchDelayMs);
    }
  }

  /**
   * Marks a message as read
   * @param {string} messageId - Message ID
   */
  markAsRead(messageId) {
    this.sendReadReceipt([messageId]);
  }

  // ==================== Message Routing ====================

  /**
   * Handles incoming text messages
   * @param {string} peerId - Sender peer ID
   * @param {number} type - Message type
   * @param {Uint8Array} payload - Message payload
   */
  handleIncomingMessage(peerId, type, payload) {
    switch (type) {
      case MESSAGE_TYPE.TEXT:
      case MESSAGE_TYPE.PRIVATE_MESSAGE:
        this.handlePrivateMessage(peerId, payload);
        break;
      case MESSAGE_TYPE.CHANNEL_MESSAGE:
        // Extract channel ID from payload
        this._handleChannelMessagePayload(peerId, payload);
        break;
      case MESSAGE_TYPE.READ_RECEIPT:
        this._handleReadReceipt(peerId, payload);
        break;
      default:
        // Treat as broadcast
        this.handleBroadcast(peerId, payload);
    }
  }

  // ==================== Private Methods ====================

  /** @private */
  _setupEventForwarding() {
    // Forward channel events
    const channelEvents = [
      EVENTS.CHANNEL_JOINED,
      EVENTS.CHANNEL_LEFT,
      EVENTS.CHANNEL_MESSAGE,
      EVENTS.CHANNEL_MEMBER_JOINED,
      EVENTS.CHANNEL_MEMBER_LEFT
    ];
    channelEvents.forEach(event => {
      this._channelManager.on(event, data => this.emit(event, data));
    });

    // Forward broadcast events
    this._broadcastManager.on('broadcast-sent', data => {
      this.emit(EVENTS.BROADCAST_SENT, data);
    });
    this._broadcastManager.on('broadcast-received', data => {
      this.emit(EVENTS.BROADCAST_RECEIVED, data);
    });
  }

  /** @private */
  async _sendMessage(peerId, type, payload) {
    const data = new Uint8Array(1 + payload.length);
    data[0] = type;
    data.set(payload, 1);

    if (this._meshService && typeof this._meshService._sendRaw === 'function') {
      await this._meshService._sendRaw(peerId, data);
    }
  }

  /** @private */
  async _sendBroadcastMessage(message) {
    const serialized = message.serialize();
    const data = new Uint8Array(1 + serialized.length);
    data[0] = MESSAGE_TYPE.TEXT;
    data.set(serialized, 1);

    // Broadcast to all connected peers
    if (this._meshService) {
      const peers = this._meshService.getConnectedPeers?.() || [];
      for (const peer of peers) {
        try {
          await this._meshService._sendRaw(peer.id || peer, data);
        } catch {
          // Continue with other peers
        }
      }
    }
  }

  /** @private */
  _handleChannelMessagePayload(peerId, payload) {
    // First byte is channel ID length
    const channelIdLength = payload[0];
    const channelId = new TextDecoder().decode(payload.slice(1, 1 + channelIdLength));
    const messagePayload = payload.slice(1 + channelIdLength);

    this.handleChannelMessage(peerId, channelId, messagePayload);
  }

  /** @private */
  _handleReadReceipt(peerId, payload) {
    // Parse read receipt payload
    const messageIds = [];
    let offset = 0;

    while (offset < payload.length) {
      const length = payload[offset];
      offset += 1;
      const messageId = new TextDecoder().decode(payload.slice(offset, offset + length));
      messageIds.push(messageId);
      offset += length;
    }

    this.emit('read-receipt', {
      peerId,
      messageIds,
      timestamp: Date.now()
    });
  }

  /** @private */
  _flushReadReceipts() {
    this._readReceiptBatchTimeout = null;

    if (this._pendingReadReceipts.size === 0) return;

    const messageIds = Array.from(this._pendingReadReceipts);
    this._pendingReadReceipts.clear();

    // Build read receipt payload
    const parts = messageIds.map(id => {
      const bytes = new TextEncoder().encode(id);
      const part = new Uint8Array(1 + bytes.length);
      part[0] = bytes.length;
      part.set(bytes, 1);
      return part;
    });

    const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
    const payload = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      payload.set(part, offset);
      offset += part.length;
    }

    this.emit('read-receipts-sent', { messageIds, count: messageIds.length });
  }

  /** @private */
  _validateReady() {
    if (this._state !== MANAGER_STATE.READY && this._state !== MANAGER_STATE.ACTIVE) {
      throw new MeshError('Text manager not ready', ERROR_CODE.E003);
    }
  }

  /** @private */
  _setState(newState) {
    this._state = newState;
  }

  /** @private */
  _publicKeyToId(publicKey) {
    if (publicKey instanceof Uint8Array) {
      return Array.from(publicKey.slice(0, 8))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
    return String(publicKey).slice(0, 16);
  }

  /**
   * Returns manager state
   * @returns {string}
   */
  getState() {
    return this._state;
  }

  /**
   * Returns statistics
   * @returns {Object}
   */
  getStats() {
    return {
      state: this._state,
      channels: this._channelManager.getStats(),
      broadcasts: this._broadcastManager.getStats()
    };
  }
}

TextManager.STATE = MANAGER_STATE;

module.exports = TextManager;
