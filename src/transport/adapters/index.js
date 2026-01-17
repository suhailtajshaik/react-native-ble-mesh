'use strict';

/**
 * @fileoverview BLE adapter exports
 * @module transport/adapters
 *
 * Note: NodeBLEAdapter uses Node.js-specific APIs (Buffer) and is NOT
 * auto-loaded to maintain React Native compatibility. Use getNodeBLEAdapter()
 * for lazy loading in Node.js environments.
 */

const BLEAdapter = require('./BLEAdapter');
const RNBLEAdapter = require('./RNBLEAdapter');

module.exports = {
  // React Native compatible adapters
  BLEAdapter,
  RNBLEAdapter,

  /**
   * Get the NodeBLEAdapter for Node.js environments.
   * This is lazy-loaded to prevent issues in React Native.
   * @returns {typeof import('./NodeBLEAdapter')}
   */
  getNodeBLEAdapter() {
    return require('./NodeBLEAdapter');
  }
};
