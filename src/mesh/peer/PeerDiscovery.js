'use strict';

/**
 * @fileoverview Peer discovery protocol handler
 * @module mesh/peer/PeerDiscovery
 */

const EventEmitter = require('../../utils/EventEmitter');
const { MESSAGE_TYPE, EVENTS } = require('../../constants');
const { ValidationError } = require('../../errors');

/**
 * Discovery message payload structure
 * @typedef {Object} DiscoveryPayload
 * @property {string} peerId - Announcing peer's ID
 * @property {string} [name] - Display name
 * @property {number[]} [publicKey] - Public key bytes
 * @property {number} [hopCount] - Hop count
 * @property {Object} [capabilities] - Peer capabilities
 */

/**
 * Handles peer discovery protocol messages
 * @class PeerDiscovery
 * @extends EventEmitter
 */
class PeerDiscovery extends EventEmitter {
  /**
   * Creates a new PeerDiscovery handler
   * @param {Object} options - Configuration options
   * @param {string} options.localPeerId - Local peer's ID
   * @param {Uint8Array} [options.publicKey] - Local peer's public key
   * @param {string} [options.displayName] - Local display name
   */
  constructor(options = {}) {
    super();

    if (!options.localPeerId || typeof options.localPeerId !== 'string') {
      throw ValidationError.invalidArgument('localPeerId', options.localPeerId);
    }

    /**
     * Local peer ID
     * @type {string}
     */
    this.localPeerId = options.localPeerId;

    /**
     * Local public key
     * @type {Uint8Array|null}
     */
    this.publicKey = options.publicKey || null;

    /**
     * Display name
     * @type {string}
     */
    this.displayName = options.displayName || '';

    /**
     * Capabilities advertised to peers
     * @type {Object}
     */
    this.capabilities = options.capabilities || {};

    /**
     * Discovery statistics
     * @type {Object}
     * @private
     */
    this._stats = {
      announcesSent: 0,
      announcesReceived: 0,
      requestsSent: 0,
      requestsReceived: 0,
      responsesSent: 0,
      responsesReceived: 0
    };
  }

  /**
   * Creates an announce message payload
   * @returns {Object} Announce payload
   */
  createAnnouncePayload() {
    const payload = {
      peerId: this.localPeerId,
      name: this.displayName,
      timestamp: Date.now(),
      capabilities: this.capabilities
    };

    if (this.publicKey) {
      payload.publicKey = Array.from(this.publicKey);
    }

    return payload;
  }

  /**
   * Creates a peer request payload
   * @param {string} [targetPeerId] - Specific peer to request (null for broadcast)
   * @returns {Object} Request payload
   */
  createRequestPayload(targetPeerId = null) {
    return {
      requesterId: this.localPeerId,
      targetPeerId: targetPeerId,
      timestamp: Date.now()
    };
  }

  /**
   * Creates a peer response payload
   * @param {string} requesterId - ID of requesting peer
   * @returns {Object} Response payload
   */
  createResponsePayload(requesterId) {
    return {
      responderId: this.localPeerId,
      requesterId: requesterId,
      name: this.displayName,
      publicKey: this.publicKey ? Array.from(this.publicKey) : null,
      timestamp: Date.now(),
      capabilities: this.capabilities
    };
  }

  /**
   * Processes an incoming discovery message
   * @param {number} type - Message type
   * @param {Object} payload - Message payload
   * @param {string} sourcePeerId - Source peer ID
   * @returns {Object|null} Response to send, or null
   */
  processMessage(type, payload, sourcePeerId) {
    // Ignore our own messages
    if (payload.peerId === this.localPeerId ||
        payload.requesterId === this.localPeerId ||
        payload.responderId === this.localPeerId) {
      return null;
    }

    switch (type) {
      case MESSAGE_TYPE.PEER_ANNOUNCE:
        return this._handleAnnounce(payload, sourcePeerId);

      case MESSAGE_TYPE.PEER_REQUEST:
        return this._handleRequest(payload, sourcePeerId);

      case MESSAGE_TYPE.PEER_RESPONSE:
        return this._handleResponse(payload, sourcePeerId);

      default:
        return null;
    }
  }

  /**
   * Handles a peer announce message
   * @param {Object} payload - Announce payload
   * @param {string} sourcePeerId - Source peer ID
   * @returns {null} No response needed
   * @private
   */
  _handleAnnounce(payload, sourcePeerId) {
    this._stats.announcesReceived++;

    const peerInfo = {
      id: payload.peerId,
      name: payload.name || '',
      publicKey: payload.publicKey ? new Uint8Array(payload.publicKey) : null,
      capabilities: payload.capabilities || {},
      hopCount: payload.hopCount || 0,
      discoveredVia: sourcePeerId
    };

    this.emit(EVENTS.PEER_DISCOVERED, peerInfo);
    return null;
  }

  /**
   * Handles a peer request message
   * @param {Object} payload - Request payload
   * @param {string} sourcePeerId - Source peer ID
   * @returns {Object|null} Response payload or null
   * @private
   */
  _handleRequest(payload, _sourcePeerId) {
    this._stats.requestsReceived++;

    // Check if request is for us or broadcast
    if (payload.targetPeerId && payload.targetPeerId !== this.localPeerId) {
      return null;
    }

    this._stats.responsesSent++;
    return {
      type: MESSAGE_TYPE.PEER_RESPONSE,
      payload: this.createResponsePayload(payload.requesterId)
    };
  }

  /**
   * Handles a peer response message
   * @param {Object} payload - Response payload
   * @param {string} sourcePeerId - Source peer ID
   * @returns {null} No response needed
   * @private
   */
  _handleResponse(payload, sourcePeerId) {
    // Only process responses to our requests
    if (payload.requesterId !== this.localPeerId) {
      return null;
    }

    this._stats.responsesReceived++;

    const peerInfo = {
      id: payload.responderId,
      name: payload.name || '',
      publicKey: payload.publicKey ? new Uint8Array(payload.publicKey) : null,
      capabilities: payload.capabilities || {},
      discoveredVia: sourcePeerId
    };

    this.emit(EVENTS.PEER_DISCOVERED, peerInfo);
    return null;
  }

  /**
   * Updates local peer information
   * @param {Object} info - New info
   */
  updateLocalInfo(info) {
    if (info.displayName !== undefined) { this.displayName = info.displayName; }
    if (info.publicKey !== undefined) { this.publicKey = info.publicKey; }
    if (info.capabilities !== undefined) {
      Object.assign(this.capabilities, info.capabilities);
    }
  }

  /**
   * Gets discovery statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return { ...this._stats };
  }

  /**
   * Resets statistics
   */
  resetStats() {
    this._stats = {
      announcesSent: 0,
      announcesReceived: 0,
      requestsSent: 0,
      requestsReceived: 0,
      responsesSent: 0,
      responsesReceived: 0
    };
  }

  /**
   * Records an announce sent
   */
  recordAnnounceSent() {
    this._stats.announcesSent++;
  }

  /**
   * Records a request sent
   */
  recordRequestSent() {
    this._stats.requestsSent++;
  }
}

module.exports = PeerDiscovery;
