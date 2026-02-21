'use strict';

/**
 * @fileoverview Mock transport for testing BLE Mesh Network
 * @module transport/MockTransport
 */

const Transport = require('./Transport');

/**
 * Mock transport for testing purposes.
 * Simulates peer connections and message passing without real BLE hardware.
 *
 * @class MockTransport
 * @extends Transport
 */
class MockTransport extends Transport {
  /**
   * Creates a new MockTransport instance
   * @param {Object} [options={}] - Transport options
   * @param {number} [options.latencyMs=10] - Simulated latency in ms
   * @param {number} [options.maxPeers=8] - Maximum peers
   */
  constructor(options = {}) {
    super(options);

    /**
     * Simulated latency in milliseconds
     * @type {number}
     * @private
     */
    this._latencyMs = options.latencyMs || 10;

    /**
     * Message log for debugging
     * @type {Array<Object>}
     * @private
     */
    this._messageLog = [];

    /**
     * Linked mock transports for peer simulation
     * @type {Map<string, MockTransport>}
     * @private
     */
    this._linkedTransports = new Map();

    /**
     * Local peer ID for this transport
     * @type {string|null}
     * @private
     */
    this._localPeerId = options.localPeerId || `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Gets the local peer ID
   * @returns {string|null} Local peer ID
   */
  get localPeerId() {
    return this._localPeerId;
  }

  /**
   * Sets the local peer ID
   * @param {string} peerId - New local peer ID
   */
  set localPeerId(peerId) {
    this._localPeerId = peerId;
  }

  /**
   * Starts the mock transport
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isRunning) {
      return;
    }
    this._setState(Transport.STATE.STARTING);
    await this._delay(this._latencyMs);
    this._setState(Transport.STATE.RUNNING);
  }

  /**
   * Stops the mock transport
   * @returns {Promise<void>}
   */
  async stop() {
    if (this._state === Transport.STATE.STOPPED) {
      return;
    }
    this._setState(Transport.STATE.STOPPING);

    // Disconnect all peers
    for (const peerId of this._peers.keys()) {
      this._disconnectPeer(peerId, 'transport_stopped');
    }

    await this._delay(this._latencyMs);
    this._setState(Transport.STATE.STOPPED);
  }

  /**
   * Sends data to a specific peer
   * @param {string} peerId - Target peer ID
   * @param {Uint8Array} data - Data to send
   * @returns {Promise<void>}
   * @throws {Error} If peer is not connected
   */
  async send(peerId, data) {
    if (!this.isRunning) {
      throw new Error('Transport is not running');
    }

    if (!this._peers.has(peerId)) {
      throw new Error(`Peer ${peerId} is not connected`);
    }

    this._logMessage('send', peerId, data);
    await this._delay(this._latencyMs);

    // Deliver to linked transport if available
    const linkedTransport = this._linkedTransports.get(peerId);
    if (linkedTransport && linkedTransport.isRunning) {
      linkedTransport._receiveMessage(this._localPeerId, data);
    }
  }

  /**
   * Broadcasts data to all connected peers
   * @param {Uint8Array} data - Data to broadcast
   * @returns {Promise<string[]>} Array of peer IDs that received the broadcast
   */
  async broadcast(data) {
    if (!this.isRunning) {
      throw new Error('Transport is not running');
    }

    const peerIds = this.getConnectedPeers();
    await Promise.all(peerIds.map(peerId => this.send(peerId, data)));
    return peerIds;
  }

  /**
   * Simulates receiving a message from a peer
   * @param {string} peerId - Source peer ID
   * @param {Uint8Array} data - Received data
   */
  simulateMessage(peerId, data) {
    if (!this.isRunning) {
      return;
    }
    this._receiveMessage(peerId, data);
  }

  /**
   * Simulates a peer connection
   * @param {string} peerId - Connecting peer ID
   * @param {Object} [info={}] - Connection info (rssi, etc.)
   */
  simulatePeerConnect(peerId, info = {}) {
    if (!this.isRunning || this._peers.has(peerId)) {
      return;
    }

    if (!this.canAcceptPeer()) {
      return;
    }

    const connectionInfo = {
      peerId,
      rssi: info.rssi || -50,
      connectedAt: Date.now(),
      ...info
    };

    this._peers.set(peerId, connectionInfo);
    this.emit('peerConnected', { peerId, rssi: connectionInfo.rssi });
  }

  /**
   * Simulates a peer disconnection
   * @param {string} peerId - Disconnecting peer ID
   * @param {string} [reason='user_request'] - Disconnection reason
   */
  simulatePeerDisconnect(peerId, reason = 'user_request') {
    this._disconnectPeer(peerId, reason);
  }

  /**
   * Links this transport to another for bidirectional communication
   * @param {MockTransport} otherTransport - Transport to link
   */
  linkTo(otherTransport) {
    if (!(otherTransport instanceof MockTransport)) {
      throw new Error('Can only link to MockTransport instances');
    }

    const otherPeerId = otherTransport.localPeerId;
    if (!otherPeerId) {
      throw new Error('Other transport must have a localPeerId set');
    }

    this._linkedTransports.set(otherPeerId, otherTransport);
    otherTransport._linkedTransports.set(this._localPeerId, this);
  }

  /**
   * Unlinks this transport from another
   * @param {MockTransport} otherTransport - Transport to unlink
   */
  unlinkFrom(otherTransport) {
    const otherPeerId = otherTransport.localPeerId;
    this._linkedTransports.delete(otherPeerId);
    otherTransport._linkedTransports.delete(this._localPeerId);
  }

  /**
   * Gets the message log
   * @returns {Array<Object>} Message log entries
   */
  getMessageLog() {
    return [...this._messageLog];
  }

  /**
   * Clears the message log
   */
  clearMessageLog() {
    this._messageLog = [];
  }

  /**
   * Internal method to receive a message
   * @param {string} peerId - Source peer ID
   * @param {Uint8Array} data - Received data
   * @private
   */
  _receiveMessage(peerId, data) {
    this._logMessage('receive', peerId, data);
    this.emit('message', { peerId, data: new Uint8Array(data) });
  }

  /**
   * Internal method to disconnect a peer
   * @param {string} peerId - Peer to disconnect
   * @param {string} reason - Disconnect reason
   * @private
   */
  _disconnectPeer(peerId, reason) {
    if (this._peers.has(peerId)) {
      this._peers.delete(peerId);
      this.emit('peerDisconnected', { peerId, reason });
    }
  }

  /**
   * Logs a message for debugging
   * @param {string} type - Message type (send/receive)
   * @param {string} peerId - Peer ID
   * @param {Uint8Array} data - Message data
   * @private
   */
  _logMessage(type, peerId, data) {
    this._messageLog.push({
      type,
      peerId,
      data: new Uint8Array(data),
      timestamp: Date.now()
    });
  }

  /**
   * Utility to delay execution
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = MockTransport;
