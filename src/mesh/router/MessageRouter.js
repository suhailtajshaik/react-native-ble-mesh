'use strict';

/**
 * @fileoverview Main message router for mesh network
 * @module mesh/router/MessageRouter
 */

const EventEmitter = require('../../utils/EventEmitter');
const { MESH_CONFIG, MESSAGE_TYPE, MESSAGE_FLAGS, EVENTS } = require('../../constants');
const { ValidationError } = require('../../errors');
const { DedupManager } = require('../dedup');
const RouteTable = require('./RouteTable');
const { randomBytes } = require('../../utils/bytes');

/**
 * Generates a UUID v4 string
 * @returns {string} UUID string
 * @private
 */
function generateUUID() {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Main message router for the mesh network
 * @class MessageRouter
 * @extends EventEmitter
 */
class MessageRouter extends EventEmitter {
  /**
   * Creates a new MessageRouter
   * @param {Object} options - Configuration options
   * @param {string} options.localPeerId - Local peer ID
   */
  constructor(options = {}) {
    super();

    /**
     * Local peer ID
     * @type {string}
     */
    this.localPeerId = options.localPeerId || '';

    /**
     * Route table
     * @type {RouteTable}
     * @private
     */
    this._routeTable = new RouteTable(options);

    /**
     * Deduplication manager
     * @type {DedupManager}
     * @private
     */
    this._dedupManager = new DedupManager(options);

    /**
     * Registered peers with their send functions
     * @type {Map<string, Function>}
     * @private
     */
    this._peers = new Map();

    /**
     * Statistics
     * @type {Object}
     * @private
     */
    this._stats = {
      messagesSent: 0,
      messagesReceived: 0,
      messagesRelayed: 0,
      messagesDropped: 0,
      duplicatesDetected: 0,
      expiredDropped: 0,
      maxHopsDropped: 0
    };
  }

  /**
   * Sets the local peer ID
   * @param {string} peerId - Local peer ID
   */
  setLocalPeerId(peerId) {
    if (typeof peerId !== 'string' || peerId.length === 0) {
      throw ValidationError.invalidArgument('peerId', peerId);
    }
    this.localPeerId = peerId;
  }

  /**
   * Registers a peer with a send function
   * @param {string} peerId - Peer ID
   * @param {Function} sendFn - Function to send data to peer
   */
  registerPeer(peerId, sendFn) {
    if (typeof peerId !== 'string' || peerId.length === 0) {
      throw ValidationError.invalidArgument('peerId', peerId);
    }
    if (typeof sendFn !== 'function') {
      throw ValidationError.invalidType('sendFn', sendFn, 'function');
    }

    this._peers.set(peerId, sendFn);
    this._routeTable.addRoute(peerId, peerId, 0);
  }

  /**
   * Unregisters a peer
   * @param {string} peerId - Peer ID
   * @returns {boolean} True if removed
   */
  unregisterPeer(peerId) {
    const removed = this._peers.delete(peerId);
    if (removed) {
      this._routeTable.removeRoutesVia(peerId);
    }
    return removed;
  }

  /**
   * Processes an incoming message
   * @param {Object} message - Message object
   * @param {string} sourcePeerId - Peer ID that sent the message
   * @returns {Object|null} Processed message or null if dropped
   */
  processIncoming(message, sourcePeerId) {
    this._stats.messagesReceived++;

    const { messageId, hopCount, maxHops, expiresAt, senderId } = message;

    // Check for duplicates
    if (this._dedupManager.isDuplicate(messageId)) {
      this._stats.duplicatesDetected++;
      this.emit(EVENTS.MESSAGE_DROPPED, { messageId, reason: 'duplicate' });
      return null;
    }

    // Check expiration
    if (expiresAt && Date.now() > expiresAt) {
      this._stats.expiredDropped++;
      this.emit(EVENTS.MESSAGE_DROPPED, { messageId, reason: 'expired' });
      return null;
    }

    // Check hop count
    if (hopCount >= (maxHops || MESH_CONFIG.MAX_HOPS)) {
      this._stats.maxHopsDropped++;
      this.emit(EVENTS.MESSAGE_DROPPED, { messageId, reason: 'max_hops' });
      return null;
    }

    // Mark as seen
    this._dedupManager.markSeen(messageId);

    // Update routing table
    if (senderId && senderId !== this.localPeerId) {
      this._routeTable.addRoute(senderId, sourcePeerId, hopCount);
    }
    this._routeTable.addRoute(sourcePeerId, sourcePeerId, 0);

    // Check if message is for us
    const isForUs = !message.recipientId ||
                    message.recipientId === this.localPeerId ||
                    (message.flags & MESSAGE_FLAGS.IS_BROADCAST);

    if (isForUs) {
      this.emit(EVENTS.MESSAGE_RECEIVED, message);
    }

    // Relay if broadcast or not for us
    const shouldRelay = (message.flags & MESSAGE_FLAGS.IS_BROADCAST) ||
                        (message.recipientId && message.recipientId !== this.localPeerId);

    if (shouldRelay) {
      this._relayMessage(message, sourcePeerId);
    }

    return message;
  }

  /**
   * Relays a message to other peers
   * @param {Object} message - Message to relay
   * @param {string} excludePeerId - Peer to exclude from relay
   * @private
   */
  _relayMessage(message, excludePeerId) {
    const relayedMessage = {
      ...message,
      hopCount: message.hopCount + 1
    };

    const targetPeers = this._getRelayTargets(message, excludePeerId);

    for (const peerId of targetPeers) {
      const sendFn = this._peers.get(peerId);
      if (sendFn) {
        try {
          sendFn(relayedMessage);
          this._stats.messagesRelayed++;
        } catch (err) {
          this.emit(EVENTS.ERROR, err);
        }
      }
    }

    if (targetPeers.length > 0) {
      this.emit(EVENTS.MESSAGE_RELAYED, {
        messageId: message.messageId,
        relayedTo: targetPeers
      });
    }
  }

  /**
   * Gets relay targets for a message
   * @param {Object} message - Message
   * @param {string} excludePeerId - Peer to exclude
   * @returns {string[]} Array of peer IDs
   * @private
   */
  _getRelayTargets(message, excludePeerId) {
    if (message.flags & MESSAGE_FLAGS.IS_BROADCAST) {
      // Broadcast: send to all except source
      return Array.from(this._peers.keys()).filter(id => id !== excludePeerId);
    }

    // Unicast: find route to recipient
    const nextHop = this._routeTable.getNextHop(message.recipientId);
    if (nextHop && nextHop !== excludePeerId) {
      return [nextHop];
    }

    // No known route, flood to all
    return Array.from(this._peers.keys()).filter(id => id !== excludePeerId);
  }

  /**
   * Sends a message
   * @param {Object} options - Send options
   * @returns {string} Message ID
   */
  send(options) {
    const {
      type = MESSAGE_TYPE.TEXT,
      recipientId = null,
      payload,
      flags = MESSAGE_FLAGS.NONE
    } = options;

    const messageId = generateUUID();
    const now = Date.now();

    const message = {
      messageId,
      type,
      senderId: this.localPeerId,
      recipientId,
      payload,
      flags,
      hopCount: 0,
      maxHops: MESH_CONFIG.MAX_HOPS,
      timestamp: now,
      expiresAt: now + MESH_CONFIG.MESSAGE_TTL_MS
    };

    this._dedupManager.markSeen(messageId);
    this._stats.messagesSent++;

    // Determine targets
    const targets = recipientId
      ? [this._routeTable.getNextHop(recipientId) || recipientId]
      : Array.from(this._peers.keys());

    for (const peerId of targets) {
      const sendFn = this._peers.get(peerId);
      if (sendFn) {
        try {
          sendFn(message);
        } catch (err) {
          this.emit(EVENTS.ERROR, err);
        }
      }
    }

    this.emit(EVENTS.MESSAGE_SENT, message);
    return messageId;
  }

  /**
   * Broadcasts a message to all peers
   * @param {Object} options - Broadcast options
   * @returns {string} Message ID
   */
  broadcast(options) {
    return this.send({
      ...options,
      recipientId: null,
      flags: (options.flags || MESSAGE_FLAGS.NONE) | MESSAGE_FLAGS.IS_BROADCAST
    });
  }

  /**
   * Gets router statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this._stats,
      registeredPeers: this._peers.size,
      routeCount: this._routeTable.size,
      dedup: this._dedupManager.getStats()
    };
  }

  /**
   * Resets statistics
   */
  resetStats() {
    this._stats = {
      messagesSent: 0,
      messagesReceived: 0,
      messagesRelayed: 0,
      messagesDropped: 0,
      duplicatesDetected: 0,
      expiredDropped: 0,
      maxHopsDropped: 0
    };
    this._dedupManager.resetStats();
  }

  /**
   * Gets the route table
   * @returns {RouteTable} Route table
   */
  getRouteTable() {
    return this._routeTable;
  }

  /**
   * Destroys the router
   */
  destroy() {
    this._peers.clear();
    this._routeTable.clear();
    this._dedupManager.reset();
    this.removeAllListeners();
  }
}

module.exports = MessageRouter;
