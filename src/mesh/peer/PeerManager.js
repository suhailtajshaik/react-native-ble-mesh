'use strict';

/**
 * @fileoverview Peer manager for tracking network participants
 * @module mesh/peer/PeerManager
 */

const EventEmitter = require('events');
const Peer = require('./Peer');
const { CONNECTION_STATE, MESH_CONFIG, EVENTS } = require('../../constants');
const { ValidationError, ConnectionError } = require('../../errors');

/**
 * Manages peers in the mesh network
 * @class PeerManager
 * @extends EventEmitter
 */
class PeerManager extends EventEmitter {
  /**
   * Creates a new PeerManager
   * @param {Object} [options] - Configuration options
   * @param {number} [options.maxPeers] - Maximum number of peers
   * @param {number} [options.peerTimeout] - Timeout for stale peers
   */
  constructor(options = {}) {
    super();

    /**
     * Maximum number of peers
     * @type {number}
     */
    this.maxPeers = options.maxPeers || MESH_CONFIG.MAX_PEERS;

    /**
     * Timeout for stale peers
     * @type {number}
     */
    this.peerTimeout = options.peerTimeout || MESH_CONFIG.PEER_TIMEOUT_MS;

    /**
     * Peers by ID
     * @type {Map<string, Peer>}
     * @private
     */
    this._peers = new Map();

    /**
     * Blocked peer IDs
     * @type {Set<string>}
     * @private
     */
    this._blocked = new Set();
  }

  /**
   * Adds or updates a peer
   * @param {Object} info - Peer information
   * @returns {Peer} The added or updated peer
   */
  addPeer(info) {
    if (!info || typeof info.id !== 'string') {
      throw ValidationError.invalidArgument('info.id', info?.id);
    }

    if (this._blocked.has(info.id)) {
      throw ConnectionError.fromCode('E205', null, { peerId: info.id });
    }

    let peer = this._peers.get(info.id);
    const isNew = !peer;

    if (isNew) {
      peer = new Peer(info);
      this._peers.set(info.id, peer);
      this.emit(EVENTS.PEER_DISCOVERED, peer);
    } else {
      // Update existing peer
      if (info.name) { peer.name = info.name; }
      if (typeof info.rssi === 'number') { peer.rssi = info.rssi; }
      if (typeof info.hopCount === 'number') { peer.hopCount = info.hopCount; }
      if (info.publicKey) { peer.publicKey = info.publicKey; }
      if (info.metadata) { Object.assign(peer.metadata, info.metadata); }
      peer.updateLastSeen();
      this.emit(EVENTS.PEER_UPDATED, peer);
    }

    return peer;
  }

  /**
   * Gets a peer by ID
   * @param {string} id - Peer ID
   * @returns {Peer|undefined} The peer or undefined
   */
  getPeer(id) {
    return this._peers.get(id);
  }

  /**
   * Gets all peers
   * @returns {Peer[]} Array of all peers
   */
  getAllPeers() {
    return Array.from(this._peers.values());
  }

  /**
   * Gets connected peers
   * @returns {Peer[]} Array of connected peers
   */
  getConnectedPeers() {
    return this.getAllPeers().filter(peer => peer.isConnected());
  }

  /**
   * Gets peers with secure sessions
   * @returns {Peer[]} Array of secured peers
   */
  getSecuredPeers() {
    return this.getAllPeers().filter(peer => peer.isSecured());
  }

  /**
   * Gets directly connected peers
   * @returns {Peer[]} Array of direct peers
   */
  getDirectPeers() {
    return this.getAllPeers().filter(peer => peer.isDirect());
  }

  /**
   * Updates a peer's connection state
   * @param {string} id - Peer ID
   * @param {string} state - New connection state
   * @returns {Peer|undefined} Updated peer or undefined
   */
  updateConnectionState(id, state) {
    const peer = this._peers.get(id);
    if (!peer) { return undefined; }

    const previousState = peer.connectionState;
    peer.setConnectionState(state);

    // Emit appropriate events
    if (state === CONNECTION_STATE.CONNECTED && previousState !== state) {
      this.emit(EVENTS.PEER_CONNECTED, peer);
    } else if (state === CONNECTION_STATE.DISCONNECTED && previousState !== state) {
      this.emit(EVENTS.PEER_DISCONNECTED, peer);
    }

    return peer;
  }

  /**
   * Marks a peer as secured
   * @param {string} id - Peer ID
   * @returns {Peer|undefined} Updated peer or undefined
   */
  markSecured(id) {
    const peer = this._peers.get(id);
    if (!peer) { return undefined; }

    peer.markSecured();
    this.emit(EVENTS.PEER_SECURED, peer);
    return peer;
  }

  /**
   * Removes a peer
   * @param {string} id - Peer ID
   * @returns {boolean} True if removed
   */
  removePeer(id) {
    const peer = this._peers.get(id);
    if (!peer) { return false; }

    this._peers.delete(id);
    this.emit(EVENTS.PEER_LOST, peer);
    return true;
  }

  /**
   * Blocks a peer
   * @param {string} id - Peer ID to block
   */
  blockPeer(id) {
    this._blocked.add(id);
    const peer = this._peers.get(id);
    if (peer) {
      this._peers.delete(id);
      this.emit(EVENTS.PEER_BLOCKED, { id, peer });
    } else {
      this.emit(EVENTS.PEER_BLOCKED, { id, peer: null });
    }
  }

  /**
   * Unblocks a peer
   * @param {string} id - Peer ID to unblock
   */
  unblockPeer(id) {
    const wasBlocked = this._blocked.delete(id);
    if (wasBlocked) {
      this.emit(EVENTS.PEER_UNBLOCKED, { id });
    }
  }

  /**
   * Checks if a peer is blocked
   * @param {string} id - Peer ID
   * @returns {boolean} True if blocked
   */
  isBlocked(id) {
    return this._blocked.has(id);
  }

  /**
   * Gets blocked peer IDs
   * @returns {string[]} Array of blocked IDs
   */
  getBlockedPeers() {
    return Array.from(this._blocked);
  }

  /**
   * Cleans up stale peers
   * @param {number} [maxAge] - Maximum age in ms, defaults to peerTimeout
   * @returns {Peer[]} Array of removed peers
   */
  cleanup(maxAge = this.peerTimeout) {
    const removed = [];
    for (const [id, peer] of this._peers) {
      if (peer.isStale(maxAge) && !peer.isConnected()) {
        this._peers.delete(id);
        removed.push(peer);
        this.emit(EVENTS.PEER_LOST, peer);
      }
    }
    return removed;
  }

  /**
   * Clears all peers
   */
  clear() {
    this._peers.clear();
  }

  /**
   * Gets the number of peers
   * @returns {number} Peer count
   */
  get size() {
    return this._peers.size;
  }

  /**
   * Checks if at capacity
   * @returns {boolean} True if at max peers
   */
  isFull() {
    return this._peers.size >= this.maxPeers;
  }
}

module.exports = PeerManager;
