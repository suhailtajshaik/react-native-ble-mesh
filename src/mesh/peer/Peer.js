'use strict';

/**
 * @fileoverview Peer class representing a network participant
 * @module mesh/peer/Peer
 */

const { CONNECTION_STATE } = require('../../constants');
const { ValidationError } = require('../../errors');

/** Pre-computed Set of valid connection states for O(1) lookup */
const CONNECTION_STATE_SET = new Set(Object.values(CONNECTION_STATE));

/**
 * Represents a peer in the mesh network
 * @class Peer
 */
class Peer {
  /**
   * Creates a new Peer
   * @param {Object} options - Peer options
   * @param {string} options.id - Unique peer identifier
   * @param {Uint8Array} [options.publicKey] - Peer's public key
   * @param {string} [options.name] - Display name
   * @param {number} [options.rssi] - Signal strength
   * @param {number} [options.hopCount] - Distance in hops
   */
  constructor(options) {
    if (!options || typeof options.id !== 'string' || options.id.length === 0) {
      throw ValidationError.invalidArgument('id', options?.id, {
        reason: 'Peer ID must be a non-empty string'
      });
    }

    /**
     * Unique peer identifier
     * @type {string}
     */
    this.id = options.id;

    /**
     * Peer's public key
     * @type {Uint8Array|null}
     */
    this.publicKey = options.publicKey || null;

    /**
     * Display name
     * @type {string}
     */
    this.name = options.name || '';

    /**
     * Received signal strength indicator
     * @type {number}
     */
    this.rssi = typeof options.rssi === 'number' ? options.rssi : 0;

    /**
     * Distance in hops (0 = direct connection)
     * @type {number}
     */
    this.hopCount = typeof options.hopCount === 'number' ? options.hopCount : 0;

    /**
     * Timestamp of last interaction
     * @type {number}
     */
    this.lastSeen = Date.now();

    /**
     * Timestamp when peer was first discovered
     * @type {number}
     */
    this.discoveredAt = Date.now();

    /**
     * Current connection state
     * @type {string}
     */
    this.connectionState = CONNECTION_STATE.DISCONNECTED;

    /**
     * Whether a secure session has been established
     * @type {boolean}
     */
    this.hasSecureSession = false;

    /**
     * Additional metadata
     * @type {Object}
     */
    this.metadata = options.metadata || {};
  }

  /**
   * Checks if peer is currently connected
   * @returns {boolean} True if connected
   */
  isConnected() {
    return this.connectionState === CONNECTION_STATE.CONNECTED ||
           this.connectionState === CONNECTION_STATE.SECURING ||
           this.connectionState === CONNECTION_STATE.SECURED;
  }

  /**
   * Checks if peer has a secure session
   * @returns {boolean} True if secured
   */
  isSecured() {
    return this.hasSecureSession &&
           this.connectionState === CONNECTION_STATE.SECURED;
  }

  /**
   * Checks if peer is directly connected (not via relay)
   * @returns {boolean} True if directly connected
   */
  isDirect() {
    return this.hopCount === 0 && this.isConnected();
  }

  /**
   * Updates the last seen timestamp
   * @param {number} [timestamp] - Custom timestamp, defaults to now
   */
  updateLastSeen(timestamp = Date.now()) {
    this.lastSeen = timestamp;
  }

  /**
   * Updates the connection state
   * @param {string} state - New connection state
   */
  setConnectionState(state) {
    if (!CONNECTION_STATE_SET.has(state)) {
      throw ValidationError.invalidArgument('state', state, {
        validValues: Array.from(CONNECTION_STATE_SET)
      });
    }
    this.connectionState = state;
    this.updateLastSeen();
  }

  /**
   * Marks the peer as having a secure session
   */
  markSecured() {
    this.hasSecureSession = true;
    this.connectionState = CONNECTION_STATE.SECURED;
    this.updateLastSeen();
  }

  /**
   * Updates the public key
   * @param {Uint8Array} publicKey - New public key
   */
  setPublicKey(publicKey) {
    if (!(publicKey instanceof Uint8Array)) {
      throw ValidationError.invalidType('publicKey', publicKey, 'Uint8Array');
    }
    this.publicKey = publicKey;
  }

  /**
   * Gets the age of the peer since last seen
   * @returns {number} Milliseconds since last seen
   */
  getAge() {
    return Date.now() - this.lastSeen;
  }

  /**
   * Checks if the peer has gone stale
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {boolean} True if stale
   */
  isStale(maxAge) {
    return this.getAge() > maxAge;
  }

  /**
   * Creates a copy of the peer
   * @returns {Peer} New Peer instance
   */
  clone() {
    const peer = new Peer({
      id: this.id,
      publicKey: this.publicKey ? new Uint8Array(this.publicKey) : null,
      name: this.name,
      rssi: this.rssi,
      hopCount: this.hopCount,
      metadata: { ...this.metadata }
    });
    peer.lastSeen = this.lastSeen;
    peer.discoveredAt = this.discoveredAt;
    peer.connectionState = this.connectionState;
    peer.hasSecureSession = this.hasSecureSession;
    return peer;
  }

  /**
   * Converts peer to a JSON-serializable object
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      publicKey: this.publicKey ? Array.from(this.publicKey) : null,
      name: this.name,
      rssi: this.rssi,
      hopCount: this.hopCount,
      lastSeen: this.lastSeen,
      discoveredAt: this.discoveredAt,
      connectionState: this.connectionState,
      hasSecureSession: this.hasSecureSession,
      isConnected: this.isConnected(),
      isSecured: this.isSecured(),
      metadata: this.metadata
    };
  }

  /**
   * Creates a Peer from JSON data
   * @param {Object} data - JSON data
   * @returns {Peer} New Peer instance
   */
  static fromJSON(data) {
    const peer = new Peer({
      id: data.id,
      publicKey: data.publicKey ? new Uint8Array(data.publicKey) : null,
      name: data.name,
      rssi: data.rssi,
      hopCount: data.hopCount,
      metadata: data.metadata || {}
    });
    if (data.lastSeen) { peer.lastSeen = data.lastSeen; }
    if (data.discoveredAt) { peer.discoveredAt = data.discoveredAt; }
    if (data.connectionState) { peer.connectionState = data.connectionState; }
    if (data.hasSecureSession) { peer.hasSecureSession = data.hasSecureSession; }
    return peer;
  }
}

module.exports = Peer;
