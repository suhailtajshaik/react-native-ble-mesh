'use strict';

/**
 * @fileoverview Transport module exports
 * @module transport
 */

const Transport = require('./Transport');
const MockTransport = require('./MockTransport');
const BLETransport = require('./BLETransport');
const { WiFiDirectTransport, WIFI_DIRECT_STATE } = require('./WiFiDirectTransport');
const { MultiTransport, STRATEGY: MULTI_TRANSPORT_STRATEGY } = require('./MultiTransport');

// React Native compatible adapters (from adapters subdirectory)
const BLEAdapter = require('./adapters/BLEAdapter');
const RNBLEAdapter = require('./adapters/RNBLEAdapter');

module.exports = {
  Transport,
  MockTransport,
  BLETransport,
  WiFiDirectTransport,
  WIFI_DIRECT_STATE,
  MultiTransport,
  MULTI_TRANSPORT_STRATEGY,
  BLEAdapter,
  RNBLEAdapter,

  /** Lazy-load NodeBLEAdapter for Node.js environments */
  getNodeBLEAdapter() {
    return require('./adapters/NodeBLEAdapter');
  }
};
