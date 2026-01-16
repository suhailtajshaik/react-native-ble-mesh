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

// Audio (from service module)
const audio = require('./service/audio');

// Text (from service module)
const text = require('./service/text');

// React Native hooks
const hooks = require('./hooks');

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
  const meshInstance = new MeshService({
    displayName: options.displayName || 'MeshNode'
  });
  await meshInstance.initialize({
    storage: options.storage || new MemoryStorage()
  });
  return meshInstance;
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

  const meshInstance = new MeshService({
    displayName: options.displayName || 'TestNode'
  });

  const mockTransport = new MockTransport({ localPeerId: generateUUID() });

  await meshInstance.initialize({
    storage: new MemoryStorage()
  });

  await meshInstance.start(mockTransport);

  return { mesh: meshInstance, transport: mockTransport };
}

// Re-export commonly used classes at top level for convenience
const { BLETransport, MockTransport, Transport } = transport;
const { MemoryStorage, AsyncStorageAdapter, Storage, MessageStore } = storage;
const { AudioManager, LC3Codec, VoiceMessage, AudioSession } = audio;
const { TextManager, TextMessage, Channel, ChannelManager, BroadcastManager } = text;
const { useMesh, usePeers, useMessages, AppStateManager } = hooks;

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
  utils,

  // Audio classes (top-level for convenience)
  AudioManager,
  LC3Codec,
  VoiceMessage,
  AudioSession,

  // Audio layer
  audio,

  // Text classes (top-level for convenience)
  TextManager,
  TextMessage,
  Channel,
  ChannelManager,
  BroadcastManager,

  // Text layer
  text,

  // React Native hooks (top-level for convenience)
  useMesh,
  usePeers,
  useMessages,
  AppStateManager,

  // Hooks module
  hooks
};
