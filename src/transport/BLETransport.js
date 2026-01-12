'use strict';

/**
 * @fileoverview BLE transport implementation for mesh network
 * @module transport/BLETransport
 */

const Transport = require('./Transport');
const {
  BLE_SERVICE_UUID,
  BLE_CHARACTERISTIC_TX,
  BLE_CHARACTERISTIC_RX,
  POWER_MODE,
  BLUETOOTH_STATE
} = require('../constants');
const { ConnectionError } = require('../errors');

/**
 * BLE transport implementation.
 * Handles Bluetooth Low Energy communication with peers.
 *
 * @class BLETransport
 * @extends Transport
 */
class BLETransport extends Transport {
  /**
   * Creates a new BLETransport instance
   * @param {Object} adapter - BLE adapter instance (RNBLEAdapter or NodeBLEAdapter)
   * @param {Object} [options={}] - Transport options
   * @param {string} [options.powerMode='BALANCED'] - Power mode
   * @param {number} [options.maxPeers=8] - Maximum peers
   * @param {number} [options.connectTimeoutMs=10000] - Connection timeout
   */
  constructor(adapter, options = {}) {
    super(options);

    if (!adapter) {
      throw new Error('BLE adapter is required');
    }

    /**
     * BLE adapter instance
     * @type {Object}
     * @private
     */
    this._adapter = adapter;

    /**
     * Current power mode
     * @type {Object}
     * @private
     */
    this._powerMode = POWER_MODE[options.powerMode] || POWER_MODE.BALANCED;

    /**
     * Connection timeout in milliseconds
     * @type {number}
     * @private
     */
    this._connectTimeoutMs = options.connectTimeoutMs || 10000;

    /**
     * Whether scanning is active
     * @type {boolean}
     * @private
     */
    this._isScanning = false;

    /**
     * Bound event handlers for cleanup
     * @type {Object}
     * @private
     */
    this._handlers = {
      onStateChange: this._handleStateChange.bind(this),
      onDeviceDiscovered: this._handleDeviceDiscovered.bind(this),
      onDeviceDisconnected: this._handleDeviceDisconnected.bind(this)
    };
  }

  /**
   * Gets whether scanning is active
   * @returns {boolean} True if scanning
   */
  get isScanning() {
    return this._isScanning;
  }

  /**
   * Starts the BLE transport
   * @returns {Promise<void>}
   * @throws {ConnectionError} If Bluetooth is unavailable
   */
  async start() {
    if (this.isRunning) {
      return;
    }

    this._setState(Transport.STATE.STARTING);

    try {
      await this._adapter.initialize();
      const state = await this._adapter.getState();

      if (state !== BLUETOOTH_STATE.POWERED_ON) {
        throw ConnectionError.fromCode('E100', null, { state });
      }

      this._adapter.onStateChange(this._handlers.onStateChange);
      this._setState(Transport.STATE.RUNNING);
    } catch (error) {
      this._setState(Transport.STATE.ERROR);
      throw error;
    }
  }

  /**
   * Stops the BLE transport
   * @returns {Promise<void>}
   */
  async stop() {
    if (this._state === Transport.STATE.STOPPED) {
      return;
    }

    this._setState(Transport.STATE.STOPPING);

    try {
      if (this._isScanning) {
        await this.stopScanning();
      }

      // Disconnect all peers
      const disconnectPromises = [];
      for (const peerId of this._peers.keys()) {
        disconnectPromises.push(this.disconnectFromPeer(peerId));
      }
      await Promise.all(disconnectPromises);

      await this._adapter.destroy();
    } finally {
      this._setState(Transport.STATE.STOPPED);
    }
  }

  /**
   * Starts scanning for BLE devices
   * @returns {Promise<void>}
   */
  async startScanning() {
    if (!this.isRunning || this._isScanning) {
      return;
    }

    await this._adapter.startScan(
      [BLE_SERVICE_UUID],
      this._handlers.onDeviceDiscovered
    );
    this._isScanning = true;
    this.emit('scanStarted');
  }

  /**
   * Stops scanning for BLE devices
   */
  stopScanning() {
    if (this._isScanning) {
      this._adapter.stopScan();
      this._isScanning = false;
      this.emit('scanStopped');
    }
  }

  /**
   * Connects to a specific peer device
   * @param {string} peerId - Device ID to connect to
   * @returns {Promise<void>}
   * @throws {ConnectionError} If connection fails
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

    try {
      const device = await Promise.race([
        this._adapter.connect(peerId),
        this._createTimeout(this._connectTimeoutMs, 'Connection timeout')
      ]);

      // Subscribe to notifications
      await this._adapter.subscribe(
        peerId,
        BLE_SERVICE_UUID,
        BLE_CHARACTERISTIC_RX,
        (data) => this._handleData(peerId, data)
      );

      const connectionInfo = {
        peerId,
        device,
        connectedAt: Date.now()
      };

      this._peers.set(peerId, connectionInfo);
      this.emit('peerConnected', { peerId, rssi: device.rssi || -50 });
    } catch (error) {
      if (error.message === 'Connection timeout') {
        throw ConnectionError.connectionTimeout(peerId);
      }
      throw ConnectionError.connectionFailed(peerId, { cause: error.message });
    }
  }

  /**
   * Disconnects from a specific peer
   * @param {string} peerId - Peer ID to disconnect from
   * @returns {Promise<void>}
   */
  async disconnectFromPeer(peerId) {
    if (!this._peers.has(peerId)) {
      return;
    }

    try {
      await this._adapter.disconnect(peerId);
    } finally {
      this._peers.delete(peerId);
      this.emit('peerDisconnected', { peerId, reason: 'user_request' });
    }
  }

  /**
   * Sends data to a specific peer
   * @param {string} peerId - Target peer ID
   * @param {Uint8Array} data - Data to send
   * @returns {Promise<void>}
   * @throws {ConnectionError} If peer is not connected
   */
  async send(peerId, data) {
    if (!this.isRunning) {
      throw new Error('Transport is not running');
    }

    if (!this._peers.has(peerId)) {
      throw ConnectionError.fromCode('E207', peerId);
    }

    await this._adapter.write(
      peerId,
      BLE_SERVICE_UUID,
      BLE_CHARACTERISTIC_TX,
      data
    );
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
    const results = await Promise.allSettled(
      peerIds.map(peerId => this.send(peerId, data))
    );

    return peerIds.filter((_, i) => results[i].status === 'fulfilled');
  }

  /**
   * Sets the power mode for BLE operations
   * @param {string} modeName - Power mode name (PERFORMANCE, BALANCED, POWER_SAVER)
   */
  setPowerMode(modeName) {
    const mode = POWER_MODE[modeName];
    if (mode) {
      this._powerMode = mode;
    }
  }

  /**
   * Handles Bluetooth state changes
   * @param {string} state - New Bluetooth state
   * @private
   */
  _handleStateChange(state) {
    this.emit('bluetoothState', { state });

    if (state !== BLUETOOTH_STATE.POWERED_ON && this.isRunning) {
      this._setState(Transport.STATE.ERROR);
      this.emit('error', { error: ConnectionError.fromCode('E102') });
    }
  }

  /**
   * Handles discovered BLE devices
   * @param {Object} device - Discovered device info
   * @private
   */
  _handleDeviceDiscovered(device) {
    this.emit('deviceDiscovered', {
      peerId: device.id,
      name: device.name,
      rssi: device.rssi
    });
  }

  /**
   * Handles device disconnection events
   * @param {string} peerId - Disconnected peer ID
   * @private
   */
  _handleDeviceDisconnected(peerId) {
    if (this._peers.has(peerId)) {
      this._peers.delete(peerId);
      this.emit('peerDisconnected', { peerId, reason: 'connection_lost' });
    }
  }

  /**
   * Handles incoming data from a peer
   * @param {string} peerId - Source peer ID
   * @param {Uint8Array} data - Received data
   * @private
   */
  _handleData(peerId, data) {
    this.emit('message', { peerId, data: new Uint8Array(data) });
  }

  /**
   * Creates a timeout promise
   * @param {number} ms - Timeout in milliseconds
   * @param {string} message - Error message
   * @returns {Promise<never>}
   * @private
   */
  _createTimeout(ms, message) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }
}

module.exports = BLETransport;
