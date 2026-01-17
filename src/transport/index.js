'use strict';

/**
 * @fileoverview Transport module exports
 * @module transport
 */

const Transport = require('./Transport');
const MockTransport = require('./MockTransport');
const BLETransport = require('./BLETransport');

// React Native compatible adapters (from adapters subdirectory)
const BLEAdapter = require('./adapters/BLEAdapter');
const RNBLEAdapter = require('./adapters/RNBLEAdapter');

module.exports = {
  Transport,
  MockTransport,
  BLETransport,
  BLEAdapter,
  RNBLEAdapter,

  /** Lazy-load NodeBLEAdapter for Node.js environments */
  getNodeBLEAdapter() {
    return require('./adapters/NodeBLEAdapter');
  }
};
