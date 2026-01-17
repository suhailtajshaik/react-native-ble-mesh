'use strict';

/**
 * @fileoverview Abstract BLE adapter interface
 * @module transport/BLEAdapter
 */

const { BLUETOOTH_STATE } = require('../constants');

/**
 * Abstract BLE adapter interface.
 * Provides a unified API for different BLE implementations.
 *
 * @abstract
 * @class BLEAdapter
 */
class BLEAdapter {
  /**
   * Creates a new BLEAdapter instance
   * @param {Object} [options={}] - Adapter options
   */
  constructor(options = {}) {
    /**
     * Adapter options
     * @type {Object}
     * @protected
     */
    this._options = options;

    /**
     * State change callback
     * @type {Function|null}
     * @protected
     */
    this._stateChangeCallback = null;

    /**
     * Whether adapter is initialized
     * @type {boolean}
     * @protected
     */
    this._initialized = false;
  }

  /**
   * Gets whether the adapter is initialized
   * @returns {boolean} True if initialized
   */
  get isInitialized() {
    return this._initialized;
  }

  /**
   * Initializes the BLE adapter
   * @abstract
   * @returns {Promise<void>}
   * @throws {Error} If not implemented by subclass
   */
  async initialize() {
    throw new Error('BLEAdapter.initialize() must be implemented by subclass');
  }

  /**
   * Destroys the BLE adapter and releases resources
   * @abstract
   * @returns {Promise<void>}
   * @throws {Error} If not implemented by subclass
   */
  async destroy() {
    throw new Error('BLEAdapter.destroy() must be implemented by subclass');
  }

  /**
   * Starts scanning for BLE devices
   * @abstract
   * @param {string[]} serviceUUIDs - Service UUIDs to filter by
   * @param {Function} callback - Callback for discovered devices
   * @returns {Promise<void>}
   * @throws {Error} If not implemented by subclass
   */
  async startScan(_serviceUUIDs, _callback) {
    throw new Error('BLEAdapter.startScan() must be implemented by subclass');
  }

  /**
   * Stops scanning for BLE devices
   * @abstract
   * @throws {Error} If not implemented by subclass
   */
  stopScan() {
    throw new Error('BLEAdapter.stopScan() must be implemented by subclass');
  }

  /**
   * Connects to a BLE device
   * @abstract
   * @param {string} deviceId - Device ID to connect to
   * @returns {Promise<Object>} Connected device info
   * @throws {Error} If not implemented by subclass
   */
  async connect(_deviceId) {
    throw new Error('BLEAdapter.connect() must be implemented by subclass');
  }

  /**
   * Disconnects from a BLE device
   * @abstract
   * @param {string} deviceId - Device ID to disconnect from
   * @returns {Promise<void>}
   * @throws {Error} If not implemented by subclass
   */
  async disconnect(_deviceId) {
    throw new Error('BLEAdapter.disconnect() must be implemented by subclass');
  }

  /**
   * Writes data to a characteristic
   * @abstract
   * @param {string} deviceId - Target device ID
   * @param {string} serviceUUID - Service UUID
   * @param {string} charUUID - Characteristic UUID
   * @param {Uint8Array} data - Data to write
   * @returns {Promise<void>}
   * @throws {Error} If not implemented by subclass
   */
  async write(_deviceId, _serviceUUID, _charUUID, _data) {
    throw new Error('BLEAdapter.write() must be implemented by subclass');
  }

  /**
   * Subscribes to characteristic notifications
   * @abstract
   * @param {string} deviceId - Target device ID
   * @param {string} serviceUUID - Service UUID
   * @param {string} charUUID - Characteristic UUID
   * @param {Function} callback - Notification callback
   * @returns {Promise<void>}
   * @throws {Error} If not implemented by subclass
   */
  async subscribe(_deviceId, _serviceUUID, _charUUID, _callback) {
    throw new Error('BLEAdapter.subscribe() must be implemented by subclass');
  }

  /**
   * Gets the current Bluetooth state
   * @abstract
   * @returns {Promise<string>} Bluetooth state
   * @throws {Error} If not implemented by subclass
   */
  async getState() {
    throw new Error('BLEAdapter.getState() must be implemented by subclass');
  }

  /**
   * Registers a callback for Bluetooth state changes
   * @param {Function} callback - State change callback
   */
  onStateChange(callback) {
    this._stateChangeCallback = callback;
  }

  /**
   * Notifies listeners of state change
   * @param {string} state - New Bluetooth state
   * @protected
   */
  _notifyStateChange(state) {
    if (this._stateChangeCallback) {
      this._stateChangeCallback(state);
    }
  }
}

// Export state constants with the class
BLEAdapter.STATE = BLUETOOTH_STATE;

module.exports = BLEAdapter;
