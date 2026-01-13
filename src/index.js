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

/**
 * Create and initialize a MeshService for Node.js usage
 * @param {Object} [options] - Configuration options
 * @param {string} [options.displayName='MeshNode'] - Display name for this node
 * @param {Object} [options.storage=null] - Storage adapter (null for MemoryStorage)
 * @returns {Promise<MeshService>} Initialized MeshService
 * @example
 * const mesh = await createNodeMesh({ displayName: 'Alice' });
 * await mesh.start(transport);
 */
async function createNodeMesh(options = {}) {
  const { MemoryStorage } = storage;
  const mesh = new MeshService({
    displayName: options.displayName || 'MeshNode'
  });
  await mesh.initialize({
    storage: options.storage || new MemoryStorage()
  });
  return mesh;
}

/**
 * Create a test mesh with MockTransport for unit testing
 * @param {Object} [options] - Configuration options
 * @param {string} [options.displayName='TestNode'] - Display name for this node
 * @returns {Promise<{mesh: MeshService, transport: MockTransport}>}
 * @example
 * const { mesh, transport } = await createTestMesh({ displayName: 'TestNode' });
 * // mesh is ready to use, transport is linked
 */
async function createTestMesh(options = {}) {
  const { MemoryStorage } = storage;
  const { MockTransport } = transport;
  const { generateUUID } = utils;

  const mesh = new MeshService({
    displayName: options.displayName || 'TestNode'
  });

  const mockTransport = new MockTransport({ localPeerId: generateUUID() });

  await mesh.initialize({
    storage: new MemoryStorage()
  });

  await mesh.start(mockTransport);

  return { mesh, transport: mockTransport };
}

// Re-export commonly used classes at top level for convenience
const { BLETransport, MockTransport, Transport } = transport;
const { MemoryStorage, AsyncStorageAdapter, Storage, MessageStore } = storage;

module.exports = {
  // Main factory functions
  createMeshService,
  createNodeMesh,
  createTestMesh,

  // Main service class
  MeshService,

  // Transport classes (top-level for convenience)
  BLETransport,
  MockTransport,
  Transport,

  // Storage classes (top-level for convenience)
  MemoryStorage,
  AsyncStorageAdapter,
  Storage,
  MessageStore,

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
