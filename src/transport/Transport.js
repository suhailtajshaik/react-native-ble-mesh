'use strict';

/**
 * @fileoverview Abstract transport interface for BLE Mesh Network
 * @module transport/Transport
 */

const EventEmitter = require('../utils/EventEmitter');

/**
 * Transport states
 * @constant {Object.<string, string>}
 */
const TRANSPORT_STATE = Object.freeze({
  STOPPED: 'stopped',
  STARTING: 'starting',
  RUNNING: 'running',
  STOPPING: 'stopping',
  ERROR: 'error'
});

/**
 * Abstract transport interface for mesh network communication.
 * Extend this class to implement specific transport mechanisms (BLE, WiFi, etc.)
 *
 * @abstract
 * @class Transport
 * @extends EventEmitter
 *
 * @fires Transport#message - When a message is received from a peer
 * @fires Transport#peerConnected - When a peer connects
 * @fires Transport#peerDisconnected - When a peer disconnects
 * @fires Transport#error - When an error occurs
 * @fires Transport#stateChanged - When transport state changes
 */
class Transport extends EventEmitter {
  /**
   * Creates a new Transport instance
   * @param {Object} [options={}] - Transport options
   * @param {number} [options.maxPeers=8] - Maximum number of simultaneous peers
   */
  constructor(options = {}) {
    super();

    /**
     * Transport options
     * @type {Object}
     * @protected
     */
    this._options = {
      maxPeers: 8,
      ...options
    };

    /**
     * Current transport state
     * @type {string}
     * @protected
     */
    this._state = TRANSPORT_STATE.STOPPED;

    /**
     * Connected peers map (peerId -> connection info)
     * @type {Map<string, Object>}
     * @protected
     */
    this._peers = new Map();
  }

  /**
   * Gets the current transport state
   * @returns {string} Current state
   */
  get state() {
    return this._state;
  }

  /**
   * Checks if transport is running
   * @returns {boolean} True if running
   */
  get isRunning() {
    return this._state === TRANSPORT_STATE.RUNNING;
  }

  /**
   * Sets the transport state and emits state change event
   * @param {string} newState - New state
   * @protected
   */
  _setState(newState) {
    const oldState = this._state;
    if (oldState !== newState) {
      this._state = newState;
      this.emit('stateChanged', { oldState, newState });
    }
  }

  /**
   * Starts the transport layer
   * @abstract
   * @returns {Promise<void>}
   * @throws {Error} If not implemented by subclass
   */
  async start() {
    throw new Error('Transport.start() must be implemented by subclass');
  }

  /**
   * Stops the transport layer
   * @abstract
   * @returns {Promise<void>}
   * @throws {Error} If not implemented by subclass
   */
  async stop() {
    throw new Error('Transport.stop() must be implemented by subclass');
  }

  /**
   * Sends data to a specific peer
   * @abstract
   * @param {string} peerId - Target peer ID
   * @param {Uint8Array} data - Data to send
   * @returns {Promise<void>}
   * @throws {Error} If not implemented by subclass
   */
  async send(_peerId, _data) {
    throw new Error('Transport.send() must be implemented by subclass');
  }

  /**
   * Broadcasts data to all connected peers
   * @abstract
   * @param {Uint8Array} data - Data to broadcast
   * @returns {Promise<string[]>} Array of peer IDs that received the broadcast
   * @throws {Error} If not implemented by subclass
   */
  async broadcast(_data) {
    throw new Error('Transport.broadcast() must be implemented by subclass');
  }

  /**
   * Gets list of connected peer IDs
   * @returns {string[]} Array of connected peer IDs
   */
  getConnectedPeers() {
    return Array.from(this._peers.keys());
  }

  /**
   * Checks if a peer is connected
   * @param {string} peerId - Peer ID to check
   * @returns {boolean} True if peer is connected
   */
  isConnected(peerId) {
    return this._peers.has(peerId);
  }

  /**
   * Gets connection info for a peer
   * @param {string} peerId - Peer ID
   * @returns {Object|undefined} Connection info or undefined
   */
  getPeerInfo(peerId) {
    return this._peers.get(peerId);
  }

  /**
   * Gets the number of connected peers
   * @returns {number} Number of connected peers
   */
  getConnectionCount() {
    return this._peers.size;
  }

  /**
   * Checks if more peers can connect
   * @returns {boolean} True if under max peer limit
   */
  canAcceptPeer() {
    return this._peers.size < this._options.maxPeers;
  }
}

// Export state constants with the class
Transport.STATE = TRANSPORT_STATE;

module.exports = Transport;
