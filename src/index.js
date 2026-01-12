/**
 * @fileoverview BLE Mesh Network Library
 * @module rn-ble-mesh
 * @description Production-ready BLE Mesh Network with Noise Protocol security
 */

'use strict';

// Core service
const { MeshService } = require('./service');

// Constants
const constants = require('./constants');

// Errors
const errors = require('./errors');

// Crypto
const crypto = require('./crypto');

// Protocol
const protocol = require('./protocol');

// Mesh
const mesh = require('./mesh');

// Transport
const transport = require('./transport');

// Storage
const storage = require('./storage');

// Utils
const utils = require('./utils');

/**
 * Create a new MeshService instance
 * @param {Object} [config] - Configuration options
 * @returns {MeshService}
 */
function createMeshService(config) {
  return new MeshService(config);
}

module.exports = {
  // Main factory
  createMeshService,

  // Main service class
  MeshService,

  // Constants
  ...constants,

  // Errors
  ...errors,

  // Crypto primitives and Noise Protocol
  crypto,

  // Protocol serialization
  protocol,

  // Mesh networking
  mesh,

  // Transport layer
  transport,

  // Storage layer
  storage,

  // Utilities
  utils
};
