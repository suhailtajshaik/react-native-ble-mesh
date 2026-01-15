/**
 * @fileoverview BLE Mesh Network Library - ESM Entry Point
 * @module rn-ble-mesh
 * @description Production-ready BLE Mesh Network with Noise Protocol security
 */

// Import CJS module and re-export as ESM
import cjs from './index.js';

// Named exports
export const {
  // Factory functions
  createMeshService,
  createNodeMesh,
  createTestMesh,

  // Main service class
  MeshService,

  // Transport classes
  BLETransport,
  MockTransport,
  Transport,

  // Storage classes
  MemoryStorage,
  AsyncStorageAdapter,
  Storage,
  MessageStore,

  // Constants
  PROTOCOL_VERSION,
  MESSAGE_TYPE,
  MESSAGE_FLAGS,
  CONNECTION_STATE,
  SERVICE_STATE,
  POWER_MODE,
  BLE_SERVICE_UUID,
  BLE_CHARACTERISTIC_TX,
  BLE_CHARACTERISTIC_RX,
  MESH_CONFIG,
  CRYPTO_CONFIG,

  // Error classes
  MeshError,
  CryptoError,
  ConnectionError,
  HandshakeError,
  MessageError,
  ValidationError,

  // Module namespaces
  crypto,
  protocol,
  mesh,
  transport,
  storage,
  utils
} = cjs;

// Default export for convenience
export default cjs;
