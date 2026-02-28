'use strict';

/**
 * @fileoverview Multi-transport aggregator
 * @module transport/MultiTransport
 *
 * Combines BLE + Wi-Fi Direct (and future transports) into a single interface.
 * Auto-selects the best transport for each message based on size and availability.
 *
 * - BLE: discovery + small messages (<threshold)
 * - Wi-Fi Direct: large payloads (files, images)
 * - Automatic fallback if preferred transport fails
 */

const Transport = require('./Transport');

/**
 * Transport selection strategies
 * @constant {Object}
 */
const STRATEGY = Object.freeze({
  /** Always use BLE */
  BLE_ONLY: 'ble-only',
  /** Always use Wi-Fi Direct */
  WIFI_ONLY: 'wifi-only',
  /** Auto-select based on payload size */
  AUTO: 'auto',
  /** Use both simultaneously for redundancy */
  REDUNDANT: 'redundant'
});

/**
 * Multi-transport aggregator.
 * Wraps multiple transports behind a single Transport interface.
 *
 * @class MultiTransport
 * @extends Transport
 */
class MultiTransport extends Transport {
  /**
   * @param {Object} [options={}]
   * @param {Transport} [options.bleTransport] - BLE transport instance
   * @param {Transport} [options.wifiTransport] - Wi-Fi Direct transport instance
   * @param {string} [options.strategy='auto'] - Selection strategy
   * @param {number} [options.wifiThresholdBytes=1024] - Use Wi-Fi Direct for payloads above this size
   */
  constructor(options = {}) {
    super(options);

    this._bleTransport = options.bleTransport || null;
    this._wifiTransport = options.wifiTransport || null;
    this._strategy = options.strategy || STRATEGY.AUTO;
    this._wifiThreshold = options.wifiThresholdBytes || 1024;

    /** @type {Map<string, string>} peerId → preferred transport name */
    this._peerTransportMap = new Map();
  }

  /**
   * Gets available transport names
   * @returns {string[]}
   */
  getAvailableTransports() {
    const transports = [];
    if (this._bleTransport) { transports.push('ble'); }
    if (this._wifiTransport) { transports.push('wifi-direct'); }
    return transports;
  }

  /**
   * Starts all configured transports
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isRunning) { return; }
    this._setState(Transport.STATE.STARTING);

    const startPromises = [];

    if (this._bleTransport) {
      startPromises.push(
        this._bleTransport.start()
          .then(() => this._wireTransport(this._bleTransport, 'ble'))
          .catch(err => {
            this.emit('transportError', { transport: 'ble', error: err });
          })
      );
    }

    if (this._wifiTransport) {
      startPromises.push(
        this._wifiTransport.start()
          .then(() => this._wireTransport(this._wifiTransport, 'wifi-direct'))
          .catch(err => {
            this.emit('transportError', { transport: 'wifi-direct', error: err });
          })
      );
    }

    await Promise.allSettled(startPromises);

    // At least one transport must be running
    const anyRunning = (this._bleTransport?.isRunning) || (this._wifiTransport?.isRunning);
    if (!anyRunning) {
      this._setState(Transport.STATE.ERROR);
      throw new Error('No transports could be started');
    }

    this._setState(Transport.STATE.RUNNING);
  }

  /**
   * Stops all transports
   * @returns {Promise<void>}
   */
  async stop() {
    if (this._state === Transport.STATE.STOPPED) { return; }
    this._setState(Transport.STATE.STOPPING);

    const stopPromises = [];
    if (this._bleTransport) { stopPromises.push(this._bleTransport.stop().catch(() => {})); }
    if (this._wifiTransport) { stopPromises.push(this._wifiTransport.stop().catch(() => {})); }

    await Promise.allSettled(stopPromises);
    this._peers.clear();
    this._peerTransportMap.clear();
    this._setState(Transport.STATE.STOPPED);
  }

  /**
   * Sends data to a peer, auto-selecting the best transport
   * @param {string} peerId
   * @param {Uint8Array} data
   * @returns {Promise<void>}
   */
  async send(peerId, data) {
    if (!this.isRunning) { throw new Error('Transport is not running'); }

    const transport = this._selectTransport(peerId, data.length);

    try {
      await transport.send(peerId, data);
    } catch (error) {
      // Try fallback transport
      const fallback = this._getFallbackTransport(transport);
      if (fallback && fallback.isConnected(peerId)) {
        await fallback.send(peerId, data);
      } else {
        throw error;
      }
    }
  }

  /**
   * Broadcasts to all peers across all transports
   * @param {Uint8Array} data
   * @returns {Promise<string[]>}
   */
  async broadcast(data) {
    if (!this.isRunning) { throw new Error('Transport is not running'); }

    const allPeerIds = new Set();
    const successPeerIds = [];

    // Collect all peers from all transports
    if (this._bleTransport?.isRunning) {
      this._bleTransport.getConnectedPeers().forEach(id => allPeerIds.add(id));
    }
    if (this._wifiTransport?.isRunning) {
      this._wifiTransport.getConnectedPeers().forEach(id => allPeerIds.add(id));
    }

    const results = await Promise.allSettled(
      Array.from(allPeerIds).map(async peerId => {
        await this.send(peerId, data);
        return peerId;
      })
    );

    results.forEach(r => {
      if (r.status === 'fulfilled') { successPeerIds.push(r.value); }
    });

    return successPeerIds;
  }

  /**
   * Gets all connected peers across all transports
   * @returns {string[]}
   */
  getConnectedPeers() {
    const peers = new Set();
    if (this._bleTransport?.isRunning) {
      this._bleTransport.getConnectedPeers().forEach(id => peers.add(id));
    }
    if (this._wifiTransport?.isRunning) {
      this._wifiTransport.getConnectedPeers().forEach(id => peers.add(id));
    }
    return Array.from(peers);
  }

  /**
   * Gets which transport is being used for a peer
   * @param {string} peerId
   * @returns {string|null}
   */
  getTransportForPeer(peerId) {
    return this._peerTransportMap.get(peerId) || null;
  }

  /**
   * Selects the best transport for a given message
   * @param {string} peerId
   * @param {number} dataSize
   * @returns {Transport}
   * @private
   */
  _selectTransport(peerId, dataSize) {
    switch (this._strategy) {
      case STRATEGY.BLE_ONLY:
        return this._bleTransport;

      case STRATEGY.WIFI_ONLY:
        return this._wifiTransport;

      case STRATEGY.AUTO:
      default: {
        // Prefer Wi-Fi Direct for large payloads
        if (dataSize > this._wifiThreshold &&
            this._wifiTransport?.isRunning &&
            this._wifiTransport.isConnected(peerId)) {
          this._peerTransportMap.set(peerId, 'wifi-direct');
          return this._wifiTransport;
        }

        // Default to BLE
        if (this._bleTransport?.isRunning && this._bleTransport.isConnected(peerId)) {
          this._peerTransportMap.set(peerId, 'ble');
          return this._bleTransport;
        }

        // Fallback to whatever is connected
        if (this._wifiTransport?.isRunning && this._wifiTransport.isConnected(peerId)) {
          return this._wifiTransport;
        }

        throw new Error(`No transport available for peer ${peerId}`);
      }
    }
  }

  /**
   * Gets fallback transport
   * @param {Transport} primary
   * @returns {Transport|null}
   * @private
   */
  _getFallbackTransport(primary) {
    if (primary === this._bleTransport && this._wifiTransport?.isRunning) {
      return this._wifiTransport;
    }
    if (primary === this._wifiTransport && this._bleTransport?.isRunning) {
      return this._bleTransport;
    }
    return null;
  }

  /**
   * Wires events from a child transport
   * @param {Transport} transport
   * @param {string} name
   * @private
   */
  _wireTransport(transport, name) {
    transport.on('peerConnected', (info) => {
      this._peerTransportMap.set(info.peerId, name);
      this._peers.set(info.peerId, { ...info, transport: name });
      this.emit('peerConnected', { ...info, transport: name });
    });

    transport.on('peerDisconnected', (info) => {
      // Only remove if no other transport has this peer
      const otherTransport = this._getFallbackTransport(transport);
      if (!otherTransport || !otherTransport.isConnected(info.peerId)) {
        this._peers.delete(info.peerId);
        this._peerTransportMap.delete(info.peerId);
        this.emit('peerDisconnected', { ...info, transport: name });
      }
    });

    transport.on('message', (msg) => {
      this.emit('message', { ...msg, transport: name });
    });

    transport.on('deviceDiscovered', (info) => {
      this.emit('deviceDiscovered', { ...info, transport: name });
    });

    transport.on('error', (err) => {
      this.emit('transportError', { transport: name, error: err });
    });
  }
}

module.exports = { MultiTransport, STRATEGY };
