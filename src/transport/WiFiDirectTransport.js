'use strict';

/**
 * @fileoverview Wi-Fi Direct transport for high-bandwidth mesh communication
 * @module transport/WiFiDirectTransport
 *
 * Provides ~250Mbps throughput and ~200m range via Wi-Fi Direct (P2P).
 * Requires: react-native-wifi-p2p (optional peer dependency)
 */

const Transport = require('./Transport');
const { ConnectionError } = require('../errors');

/**
 * Wi-Fi Direct transport states
 * @constant {Object}
 */
const WIFI_DIRECT_STATE = Object.freeze({
  AVAILABLE: 'available',
  UNAVAILABLE: 'unavailable',
  DISCOVERING: 'discovering',
  CONNECTED: 'connected'
});

/**
 * Wi-Fi Direct transport implementation.
 * Uses react-native-wifi-p2p for peer discovery and data transfer.
 *
 * @class WiFiDirectTransport
 * @extends Transport
 */
class WiFiDirectTransport extends Transport {
  /**
   * @param {Object} [options={}]
   * @param {Object} [options.wifiP2p] - Injected react-native-wifi-p2p module
   * @param {number} [options.port=8988] - Server port for socket communication
   * @param {number} [options.connectTimeoutMs=15000] - Connection timeout
   * @param {number} [options.maxPeers=4] - Max simultaneous Wi-Fi Direct peers
   */
  constructor(options = {}) {
    super({ maxPeers: options.maxPeers || 4, ...options });

    this._wifiP2p = options.wifiP2p || null;
    this._port = options.port || 8988;
    this._connectTimeoutMs = options.connectTimeoutMs || 15000;
    this._isDiscovering = false;
    this._isGroupOwner = false;
    this._groupInfo = null;
    this._subscriptions = [];
  }

  /**
   * Whether discovery is active
   * @returns {boolean}
   */
  get isDiscovering() {
    return this._isDiscovering;
  }

  /**
   * Whether this device is the Wi-Fi Direct group owner
   * @returns {boolean}
   */
  get isGroupOwner() {
    return this._isGroupOwner;
  }

  /**
   * Starts the Wi-Fi Direct transport
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isRunning) { return; }
    this._setState(Transport.STATE.STARTING);

    try {
      const p2p = this._getWifiP2p();
      await p2p.initialize();

      // Check if Wi-Fi Direct is supported
      const isAvailable = await p2p.isSuccessfulInitialize();
      if (!isAvailable) {
        throw new ConnectionError('Wi-Fi Direct is not available on this device', 'E100');
      }

      this._setState(Transport.STATE.RUNNING);
    } catch (error) {
      this._setState(Transport.STATE.ERROR);
      throw error;
    }
  }

  /**
   * Stops the Wi-Fi Direct transport
   * @returns {Promise<void>}
   */
  async stop() {
    if (this._state === Transport.STATE.STOPPED) { return; }
    this._setState(Transport.STATE.STOPPING);

    try {
      if (this._isDiscovering) {
        await this.stopDiscovery();
      }

      const p2p = this._getWifiP2p();

      // Disconnect from group
      try {
        await p2p.removeGroup();
      } catch (e) {
        // Ignore — may not be in a group
      }

      // Cleanup subscriptions
      this._subscriptions.forEach(sub => {
        if (sub && typeof sub.remove === 'function') { sub.remove(); }
      });
      this._subscriptions = [];

      this._peers.clear();
    } finally {
      this._setState(Transport.STATE.STOPPED);
    }
  }

  /**
   * Starts discovering nearby Wi-Fi Direct devices
   * @returns {Promise<void>}
   */
  async startDiscovery() {
    if (!this.isRunning || this._isDiscovering) { return; }

    const p2p = this._getWifiP2p();
    await p2p.discoverPeers();
    this._isDiscovering = true;
    this.emit('discoveryStarted');
  }

  /**
   * Stops device discovery
   * @returns {Promise<void>}
   */
  async stopDiscovery() {
    if (!this._isDiscovering) { return; }

    const p2p = this._getWifiP2p();
    try {
      await p2p.stopDiscoveringPeers();
    } catch (e) {
      // Ignore
    }
    this._isDiscovering = false;
    this.emit('discoveryStopped');
  }

  /**
   * Connects to a Wi-Fi Direct peer
   * @param {string} peerId - Device address
   * @returns {Promise<void>}
   */
  async connectToPeer(peerId) {
    if (!this.isRunning) {
      throw new Error('Transport is not running');
    }
    if (this._peers.has(peerId)) {
      throw ConnectionError.fromCode('E206', peerId);
    }
    if (!this.canAcceptPeer()) {
      throw ConnectionError.fromCode('E203', peerId);
    }

    const p2p = this._getWifiP2p();

    try {
      await p2p.connect(peerId);

      const connectionInfo = await p2p.getConnectionInfo();
      this._isGroupOwner = connectionInfo.isGroupOwner || false;
      this._groupInfo = connectionInfo;

      this._peers.set(peerId, {
        peerId,
        connectedAt: Date.now(),
        isGroupOwner: this._isGroupOwner,
        groupOwnerAddress: connectionInfo.groupOwnerAddress
      });

      this.emit('peerConnected', { peerId, transport: 'wifi-direct' });
    } catch (error) {
      throw ConnectionError.connectionFailed(peerId, { cause: error.message });
    }
  }

  /**
   * Disconnects from a peer
   * @param {string} peerId
   * @returns {Promise<void>}
   */
  async disconnectFromPeer(peerId) {
    if (!this._peers.has(peerId)) { return; }

    const p2p = this._getWifiP2p();
    try {
      await p2p.removeGroup();
    } catch (e) {
      // Ignore
    }

    this._peers.delete(peerId);
    this.emit('peerDisconnected', { peerId, reason: 'user_request' });
  }

  /**
   * Sends data to a peer via Wi-Fi Direct socket
   * @param {string} peerId - Target peer
   * @param {Uint8Array} data - Data to send
   * @returns {Promise<void>}
   */
  async send(peerId, data) {
    if (!this.isRunning) { throw new Error('Transport is not running'); }
    if (!this._peers.has(peerId)) {
      throw ConnectionError.fromCode('E207', peerId);
    }

    const p2p = this._getWifiP2p();
    const peerInfo = this._peers.get(peerId);

    // Convert Uint8Array to base64 for transfer
    const base64 = this._uint8ArrayToBase64(data);

    if (this._isGroupOwner) {
      // Group owner sends via server socket
      await p2p.sendMessage(base64);
    } else {
      // Client sends to group owner address
      await p2p.sendMessageTo(peerInfo.groupOwnerAddress, this._port, base64);
    }
  }

  /**
   * Broadcasts to all connected peers
   * @param {Uint8Array} data
   * @returns {Promise<string[]>}
   */
  async broadcast(data) {
    if (!this.isRunning) { throw new Error('Transport is not running'); }

    const peerIds = this.getConnectedPeers();
    const results = await Promise.allSettled(
      peerIds.map(id => this.send(id, data))
    );
    return peerIds.filter((_, i) => results[i].status === 'fulfilled');
  }

  /**
   * Gets available Wi-Fi Direct peers (discovered but not connected)
   * @returns {Promise<Object[]>}
   */
  async getAvailablePeers() {
    if (!this.isRunning) { return []; }
    const p2p = this._getWifiP2p();
    try {
      return await p2p.getAvailablePeers();
    } catch (e) {
      return [];
    }
  }

  /** @private */
  _getWifiP2p() {
    if (!this._wifiP2p) {
      try {
        this._wifiP2p = require('react-native-wifi-p2p');
      } catch (e) {
        throw new Error(
          'react-native-wifi-p2p is required for WiFiDirectTransport. ' +
          'Install: npm install react-native-wifi-p2p'
        );
      }
    }
    return this._wifiP2p;
  }

  /** @private */
  _uint8ArrayToBase64(bytes) {
    const chunks = [];
    for (let i = 0; i < bytes.length; i += 8192) {
      chunks.push(String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + 8192, bytes.length))));
    }
    const binary = chunks.join('');
    return typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  }
}

module.exports = { WiFiDirectTransport, WIFI_DIRECT_STATE };
