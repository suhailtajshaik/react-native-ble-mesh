'use strict';

/**
 * @fileoverview Transport module exports
 * @module transport
 */

const Transport = require('./Transport');
const MockTransport = require('./MockTransport');
const BLETransport = require('./BLETransport');

// Adapters (now flat in transport folder)
const BLEAdapter = require('./BLEAdapter');
const RNBLEAdapter = require('./RNBLEAdapter');
const NodeBLEAdapter = require('./NodeBLEAdapter');

// Legacy: keep adapters object for backward compatibility
const adapters = require('./adapters');

module.exports = {
  // Core transports
  Transport,
  MockTransport,
  BLETransport,

  // Adapters (flat exports for easy imports)
  BLEAdapter,
  RNBLEAdapter,
  NodeBLEAdapter,

  // Legacy adapters namespace
  adapters
};
