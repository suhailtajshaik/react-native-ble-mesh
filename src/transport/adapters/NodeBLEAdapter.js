'use strict';

/**
 * @fileoverview Node.js BLE adapter using @abandonware/noble
 * @module transport/adapters/NodeBLEAdapter
 */

const BLEAdapter = require('./BLEAdapter');

/**
 * Node.js BLE adapter implementation.
 * Wraps @abandonware/noble for BLE communication in Node.js.
 *
 * NOTE: @abandonware/noble is an optional peer dependency.
 * Install it separately: npm install @abandonware/noble
 *
 * @class NodeBLEAdapter
 * @extends BLEAdapter
 */
class NodeBLEAdapter extends BLEAdapter {
  /**
   * Creates a new NodeBLEAdapter instance
   * @param {Object} [options={}] - Adapter options
   * @param {Object} [options.noble] - Noble instance
   */
  constructor(options = {}) {
    super(options);

    /**
     * Noble instance
     * @type {Object|null}
     * @private
     */
    this._noble = options.noble || null;

    /**
     * Connected peripherals map
     * @type {Map<string, Object>}
     * @private
     */
    this._peripherals = new Map();

    /**
     * Discovered peripherals cache
     * @type {Map<string, Object>}
     * @private
     */
    this._discoveredPeripherals = new Map();

    /**
     * Subscription handlers map
     * @type {Map<string, Object>}
     * @private
     */
    this._subscriptions = new Map();

    /**
     * Scan callback reference
     * @type {Function|null}
     * @private
     */
    this._scanCallback = null;
  }

  /**
   * Initializes the Noble BLE manager
   * @returns {Promise<void>}
   * @throws {Error} If noble is not available
   */
  async initialize() {
    if (this._initialized) {
      return;
    }

    // Try to load noble if not provided
    if (!this._noble) {
      try {
        this._noble = require('@abandonware/noble');
      } catch (error) {
        throw new Error(
          '@abandonware/noble is required. Install with: npm install @abandonware/noble'
        );
      }
    }

    // Set up state change listener
    this._noble.on('stateChange', (state) => {
      this._notifyStateChange(this._mapState(state));
    });

    // Wait for noble to be ready
    await this._waitForPoweredOn();
    this._initialized = true;
  }

  /**
   * Destroys the Noble BLE manager and releases resources
   * @returns {Promise<void>}
   */
  async destroy() {
    if (!this._initialized) {
      return;
    }

    // Stop scanning
    this.stopScan();

    // Disconnect all peripherals
    for (const peripheralId of this._peripherals.keys()) {
      await this.disconnect(peripheralId);
    }

    // Remove all listeners
    this._noble.removeAllListeners();
    this._subscriptions.clear();
    this._discoveredPeripherals.clear();

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

    this._scanCallback = callback;

    // Format UUIDs for noble (lowercase, no dashes)
    const formattedUUIDs = serviceUUIDs.map(uuid =>
      uuid.toLowerCase().replace(/-/g, '')
    );

    this._noble.on('discover', (peripheral) => {
      this._discoveredPeripherals.set(peripheral.id, peripheral);

      if (this._scanCallback) {
        this._scanCallback({
          id: peripheral.id,
          name: peripheral.advertisement.localName,
          rssi: peripheral.rssi
        });
      }
    });

    this._noble.startScanning(formattedUUIDs, true);
  }

  /**
   * Stops scanning for BLE devices
   */
  stopScan() {
    if (this._noble) {
      this._noble.stopScanning();
      this._noble.removeAllListeners('discover');
      this._scanCallback = null;
    }
  }

  /**
   * Connects to a BLE device
   * @param {string} deviceId - Device ID to connect to
   * @returns {Promise<Object>} Connected device info
   */
  async connect(deviceId) {
    this._ensureInitialized();

    const peripheral = this._discoveredPeripherals.get(deviceId);
    if (!peripheral) {
      throw new Error(`Device ${deviceId} not found`);
    }

    await this._connectPeripheral(peripheral);
    await this._discoverServices(peripheral);

    this._peripherals.set(deviceId, peripheral);

    // Monitor disconnection
    peripheral.once('disconnect', () => {
      this._peripherals.delete(deviceId);
    });

    return {
      id: peripheral.id,
      name: peripheral.advertisement.localName,
      rssi: peripheral.rssi
    };
  }

  /**
   * Disconnects from a BLE device
   * @param {string} deviceId - Device ID to disconnect from
   * @returns {Promise<void>}
   */
  async disconnect(deviceId) {
    const peripheral = this._peripherals.get(deviceId);
    if (peripheral) {
      await this._disconnectPeripheral(peripheral);
      this._peripherals.delete(deviceId);
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

    const peripheral = this._peripherals.get(deviceId);
    if (!peripheral) {
      throw new Error(`Device ${deviceId} not connected`);
    }

    const characteristic = this._findCharacteristic(
      peripheral,
      serviceUUID,
      charUUID
    );

    if (!characteristic) {
      throw new Error(`Characteristic ${charUUID} not found`);
    }

    await this._writeCharacteristic(characteristic, Buffer.from(data));
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

    const peripheral = this._peripherals.get(deviceId);
    if (!peripheral) {
      throw new Error(`Device ${deviceId} not connected`);
    }

    const characteristic = this._findCharacteristic(
      peripheral,
      serviceUUID,
      charUUID
    );

    if (!characteristic) {
      throw new Error(`Characteristic ${charUUID} not found`);
    }

    characteristic.on('data', (data) => {
      callback(new Uint8Array(data));
    });

    await this._subscribeCharacteristic(characteristic);

    const key = `${deviceId}:${serviceUUID}:${charUUID}`;
    this._subscriptions.set(key, characteristic);
  }

  /**
   * Gets the current Bluetooth state
   * @returns {Promise<string>} Bluetooth state
   */
  async getState() {
    this._ensureInitialized();
    return this._mapState(this._noble.state);
  }

  /**
   * Maps noble state to BLEAdapter state
   * @param {string} state - Noble state
   * @returns {string} Mapped state
   * @private
   */
  _mapState(state) {
    const stateMap = {
      unknown: BLEAdapter.STATE.UNKNOWN,
      resetting: BLEAdapter.STATE.RESETTING,
      unsupported: BLEAdapter.STATE.UNSUPPORTED,
      unauthorized: BLEAdapter.STATE.UNAUTHORIZED,
      poweredOff: BLEAdapter.STATE.POWERED_OFF,
      poweredOn: BLEAdapter.STATE.POWERED_ON
    };
    return stateMap[state] || BLEAdapter.STATE.UNKNOWN;
  }

  /**
   * Waits for noble to be powered on
   * @returns {Promise<void>}
   * @private
   */
  _waitForPoweredOn() {
    return new Promise((resolve, reject) => {
      if (this._noble.state === 'poweredOn') {
        return resolve();
      }

      const timeout = setTimeout(() => {
        reject(new Error('Bluetooth initialization timeout'));
      }, 10000);

      this._noble.once('stateChange', (state) => {
        clearTimeout(timeout);
        if (state === 'poweredOn') {
          resolve();
        } else {
          reject(new Error(`Bluetooth state: ${state}`));
        }
      });
    });
  }

  /**
   * Connects to a peripheral
   * @param {Object} peripheral - Noble peripheral
   * @returns {Promise<void>}
   * @private
   */
  _connectPeripheral(peripheral) {
    return new Promise((resolve, reject) => {
      peripheral.connect((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  /**
   * Disconnects from a peripheral
   * @param {Object} peripheral - Noble peripheral
   * @returns {Promise<void>}
   * @private
   */
  _disconnectPeripheral(peripheral) {
    return new Promise((resolve) => {
      peripheral.disconnect(() => resolve());
    });
  }

  /**
   * Discovers services and characteristics
   * @param {Object} peripheral - Noble peripheral
   * @returns {Promise<void>}
   * @private
   */
  _discoverServices(peripheral) {
    return new Promise((resolve, reject) => {
      peripheral.discoverAllServicesAndCharacteristics((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  /**
   * Finds a characteristic on a peripheral
   * @param {Object} peripheral - Noble peripheral
   * @param {string} serviceUUID - Service UUID
   * @param {string} charUUID - Characteristic UUID
   * @returns {Object|null} Characteristic or null
   * @private
   */
  _findCharacteristic(peripheral, serviceUUID, charUUID) {
    const formattedServiceUUID = serviceUUID.toLowerCase().replace(/-/g, '');
    const formattedCharUUID = charUUID.toLowerCase().replace(/-/g, '');

    const service = peripheral.services?.find(
      s => s.uuid === formattedServiceUUID
    );
    return service?.characteristics?.find(
      c => c.uuid === formattedCharUUID
    ) || null;
  }

  /**
   * Writes to a characteristic
   * @param {Object} characteristic - Noble characteristic
   * @param {Buffer} data - Data to write
   * @returns {Promise<void>}
   * @private
   */
  _writeCharacteristic(characteristic, data) {
    return new Promise((resolve, reject) => {
      characteristic.write(data, false, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  /**
   * Subscribes to a characteristic
   * @param {Object} characteristic - Noble characteristic
   * @returns {Promise<void>}
   * @private
   */
  _subscribeCharacteristic(characteristic) {
    return new Promise((resolve, reject) => {
      characteristic.subscribe((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  /**
   * Ensures the adapter is initialized
   * @throws {Error} If not initialized
   * @private
   */
  _ensureInitialized() {
    if (!this._initialized) {
      throw new Error('NodeBLEAdapter is not initialized');
    }
  }
}

module.exports = NodeBLEAdapter;
