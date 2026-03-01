'use strict';

/**
 * @fileoverview React Native BLE adapter using react-native-ble-plx
 * @module transport/adapters/RNBLEAdapter
 */

const BLEAdapter = require('./BLEAdapter');

/**
 * React Native BLE adapter implementation.
 * Wraps react-native-ble-plx for BLE communication in React Native apps.
 *
 * NOTE: react-native-ble-plx is an optional peer dependency.
 * Install it separately: npm install react-native-ble-plx
 *
 * @class RNBLEAdapter
 * @extends BLEAdapter
 */
class RNBLEAdapter extends BLEAdapter {
  /**
   * Creates a new RNBLEAdapter instance
   * @param {Object} [options={}] - Adapter options
   * @param {any} [options.BleManager] - BleManager class from react-native-ble-plx
   */
  constructor(options = {}) {
    super(options);

    /**
     * BleManager instance
     * @type {any}
     * @private
     */
    this._manager = null;

    /**
     * BleManager class reference
     * @type {Function|null}
     * @private
     */
    this._BleManager = options.BleManager || null;

    /**
     * iOS state restoration identifier
     * @type {string|null}
     * @private
     */
    // @ts-ignore
    this._restoreIdentifier = options.restoreIdentifier || null;

    /**
     * Connected devices map
     * @type {Map<string, any>}
     * @private
     */
    this._devices = new Map();

    /**
     * Subscription handlers map
     * @type {Map<string, any>}
     * @private
     */
    this._subscriptions = new Map();

    /**
     * Scan subscription reference
     * @type {any}
     * @private
     */
    this._scanSubscription = null;

    /**
     * State subscription reference
     * @type {any}
     * @private
     */
    this._stateSubscription = null;

    /**
     * Disconnect callback
     * @type {Function|null}
     * @private
     */
    this._disconnectCallback = null;
  }

  /**
   * Initializes the BLE manager
   * @returns {Promise<void>}
   * @throws {Error} If react-native-ble-plx is not available
   */
  async initialize() {
    if (this._initialized) {
      return;
    }

    // Try to load BleManager if not provided
    if (!this._BleManager) {
      try {
        // @ts-ignore
        const blePlx = require('react-native-ble-plx');
        this._BleManager = blePlx.BleManager;
      } catch (error) {
        throw new Error(
          'react-native-ble-plx is required. Install with: npm install react-native-ble-plx'
        );
      }
    }

    const managerOptions = {};
    if (this._restoreIdentifier) {
      managerOptions.restoreStateIdentifier = this._restoreIdentifier;
      managerOptions.restoreStateFunction = (/** @type {any} */ restoredState) => {
        // Re-populate devices from restored state
        if (restoredState && restoredState.connectedPeripherals) {
          for (const peripheral of restoredState.connectedPeripherals) {
            this._devices.set(peripheral.id, peripheral);
          }
        }
      };
    }
    // @ts-ignore
    this._manager = new this._BleManager(managerOptions);

    // Subscribe to state changes
    this._stateSubscription = this._manager.onStateChange((/** @type {any} */ state) => {
      this._notifyStateChange(this._mapState(state));
    }, true);

    this._initialized = true;
  }

  /**
   * Destroys the BLE manager and releases resources
   * @returns {Promise<void>}
   */
  async destroy() {
    if (!this._initialized) {
      return;
    }

    // Cancel all subscriptions
    for (const subscription of this._subscriptions.values()) {
      subscription.remove();
    }
    this._subscriptions.clear();

    // Stop scanning
    this.stopScan();

    // Remove state subscription
    if (this._stateSubscription) {
      this._stateSubscription.remove();
      this._stateSubscription = null;
    }

    // Disconnect all devices
    for (const deviceId of this._devices.keys()) {
      await this.disconnect(deviceId);
    }

    // Destroy manager
    if (this._manager) {
      this._manager.destroy();
      this._manager = null;
    }

    this._initialized = false;
  }

  /**
   * Starts scanning for BLE devices
   * @param {string[]} serviceUUIDs - Service UUIDs to filter by
   * @param {Function} callback - Callback for discovered devices
   * @returns {Promise<void>}
   */
  async startScan(serviceUUIDs, callback) {
    this._ensureInitialized();

    this._manager.startDeviceScan(serviceUUIDs, null, (/** @type {any} */ error, /** @type {any} */ device) => {
      if (error) {
        return;
      }
      if (device) {
        callback({
          id: device.id,
          name: device.name || device.localName,
          rssi: device.rssi
        });
      }
    });
  }

  /**
   * Stops scanning for BLE devices
   */
  stopScan() {
    if (this._manager) {
      this._manager.stopDeviceScan();
    }
  }

  /**
   * Connects to a BLE device
   * @param {string} deviceId - Device ID to connect to
   * @returns {Promise<Object>} Connected device info
   */
  async connect(deviceId) {
    this._ensureInitialized();

    const device = await this._manager.connectToDevice(deviceId);
    await device.discoverAllServicesAndCharacteristics();

    this._devices.set(deviceId, device);

    // Monitor disconnection
    device.onDisconnected(() => {
      this._devices.delete(deviceId);

      // Clean up subscriptions for this device
      for (const [key, subscription] of this._subscriptions.entries()) {
        if (key.startsWith(`${deviceId}:`)) {
          subscription.remove();
          this._subscriptions.delete(key);
        }
      }

      // Notify transport
      if (this._disconnectCallback) {
        this._disconnectCallback(deviceId);
      }
    });

    return {
      id: device.id,
      name: device.name,
      rssi: device.rssi
    };
  }

  /**
   * Disconnects from a BLE device
   * @param {string} deviceId - Device ID to disconnect from
   * @returns {Promise<void>}
   */
  async disconnect(deviceId) {
    // Clean up subscriptions first
    for (const [key, subscription] of this._subscriptions.entries()) {
      if (key.startsWith(`${deviceId}:`)) {
        subscription.remove();
        this._subscriptions.delete(key);
      }
    }

    const device = this._devices.get(deviceId);
    if (device) {
      await this._manager.cancelDeviceConnection(deviceId);
      this._devices.delete(deviceId);
    }
  }

  /**
   * Writes data to a characteristic
   * @param {string} deviceId - Target device ID
   * @param {string} serviceUUID - Service UUID
   * @param {string} charUUID - Characteristic UUID
   * @param {Uint8Array} data - Data to write
   * @returns {Promise<void>}
   */
  async write(deviceId, serviceUUID, charUUID, data) {
    this._ensureInitialized();

    const base64Data = this._uint8ArrayToBase64(data);
    await this._manager.writeCharacteristicWithResponseForDevice(
      deviceId,
      serviceUUID,
      charUUID,
      base64Data
    );
  }

  /**
   * Subscribes to characteristic notifications
   * @param {string} deviceId - Target device ID
   * @param {string} serviceUUID - Service UUID
   * @param {string} charUUID - Characteristic UUID
   * @param {Function} callback - Notification callback
   * @returns {Promise<void>}
   */
  async subscribe(deviceId, serviceUUID, charUUID, callback) {
    this._ensureInitialized();

    const key = `${deviceId}:${serviceUUID}:${charUUID}`;
    const subscription = this._manager.monitorCharacteristicForDevice(
      deviceId,
      serviceUUID,
      charUUID,
      (/** @type {any} */ error, /** @type {any} */ characteristic) => {
        if (!error && characteristic) {
          const data = this._base64ToUint8Array(characteristic.value);
          callback(data);
        }
      }
    );

    this._subscriptions.set(key, subscription);
  }

  /**
   * Gets the current Bluetooth state
   * @returns {Promise<string>} Bluetooth state
   */
  async getState() {
    this._ensureInitialized();
    const state = await this._manager.state();
    return this._mapState(state);
  }

  /**
   * Maps react-native-ble-plx state to BLEAdapter state
   * @param {string} state - RN BLE state
   * @returns {string} Mapped state
   * @private
   */
  _mapState(state) {
    const stateMap = {
      Unknown: BLEAdapter.STATE.UNKNOWN,
      Resetting: BLEAdapter.STATE.RESETTING,
      Unsupported: BLEAdapter.STATE.UNSUPPORTED,
      Unauthorized: BLEAdapter.STATE.UNAUTHORIZED,
      PoweredOff: BLEAdapter.STATE.POWERED_OFF,
      PoweredOn: BLEAdapter.STATE.POWERED_ON
    };
    return /** @type {any} */ (stateMap)[state] || BLEAdapter.STATE.UNKNOWN;
  }

  /**
   * Registers a callback for device disconnection events
   * @param {Function} callback - Callback function receiving peerId
   */
  onDeviceDisconnected(callback) {
    this._disconnectCallback = callback;
  }

  /**
   * Ensures the adapter is initialized
   * @throws {Error} If not initialized
   * @private
   */
  _ensureInitialized() {
    if (!this._initialized) {
      throw new Error('RNBLEAdapter is not initialized');
    }
  }

  /**
   * Converts Uint8Array to Base64 string
   * @param {Uint8Array} bytes - Bytes to convert
   * @returns {string} Base64 string
   * @private
   */
  _uint8ArrayToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Converts Base64 string to Uint8Array
   * @param {string} base64 - Base64 string
   * @returns {Uint8Array} Byte array
   * @private
   */
  _base64ToUint8Array(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

module.exports = RNBLEAdapter;
