/**
 * @fileoverview Bluetooth Low Energy constants
 * @module constants/ble
 */

'use strict';

/**
 * Nordic UART Service UUID
 * Standard UUID for BLE serial communication
 * @constant {string}
 */
const BLE_SERVICE_UUID = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';

/**
 * Nordic UART TX Characteristic UUID
 * Used for writing data to peripheral
 * @constant {string}
 */
const BLE_CHARACTERISTIC_TX = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E';

/**
 * Nordic UART RX Characteristic UUID
 * Used for receiving data from peripheral
 * @constant {string}
 */
const BLE_CHARACTERISTIC_RX = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E';

/**
 * Default MTU (Maximum Transmission Unit) size
 * @constant {number}
 */
const DEFAULT_MTU = 23;

/**
 * Maximum MTU size for BLE 4.2+
 * @constant {number}
 */
const MAX_MTU = 512;

/**
 * Power mode configurations
 * @constant {Object.<string, Object>}
 */
const POWER_MODE = Object.freeze({
  /**
   * High performance mode
   * Best responsiveness, highest power consumption
   */
  PERFORMANCE: Object.freeze({
    scanInterval: 1000,
    scanWindow: 500,
    advInterval: 100,
    connectionInterval: 7.5
  }),
  /**
   * Balanced mode
   * Good balance between responsiveness and power
   */
  BALANCED: Object.freeze({
    scanInterval: 5000,
    scanWindow: 1000,
    advInterval: 500,
    connectionInterval: 30
  }),
  /**
   * Power saver mode
   * Minimum power consumption, slower responsiveness
   */
  POWER_SAVER: Object.freeze({
    scanInterval: 30000,
    scanWindow: 2000,
    advInterval: 1000,
    connectionInterval: 100
  })
});

/**
 * Bluetooth adapter states
 * @constant {Object.<string, string>}
 */
const BLUETOOTH_STATE = Object.freeze({
  UNKNOWN: 'unknown',
  RESETTING: 'resetting',
  UNSUPPORTED: 'unsupported',
  UNAUTHORIZED: 'unauthorized',
  POWERED_OFF: 'poweredOff',
  POWERED_ON: 'poweredOn'
});

/**
 * Scan modes
 * @constant {Object.<string, number>}
 */
const SCAN_MODE = Object.freeze({
  LOW_POWER: 0,
  BALANCED: 1,
  LOW_LATENCY: 2,
  OPPORTUNISTIC: -1
});

module.exports = {
  BLE_SERVICE_UUID,
  BLE_CHARACTERISTIC_TX,
  BLE_CHARACTERISTIC_RX,
  DEFAULT_MTU,
  MAX_MTU,
  POWER_MODE,
  BLUETOOTH_STATE,
  SCAN_MODE
};
