/**
 * @fileoverview Protocol constants for the BLE Mesh Network
 * @module constants/protocol
 */

'use strict';

/**
 * Protocol version for compatibility checking
 * @constant {number}
 */
const PROTOCOL_VERSION = 1;

/**
 * Message type identifiers
 * @constant {Object.<string, number>}
 */
const MESSAGE_TYPE = Object.freeze({
  // Data messages (0x01-0x0F)
  TEXT: 0x01,
  TEXT_ACK: 0x02,

  // Handshake (0x10-0x1F)
  HANDSHAKE_INIT: 0x10,
  HANDSHAKE_RESPONSE: 0x11,
  HANDSHAKE_FINAL: 0x12,

  // Discovery (0x20-0x2F)
  PEER_ANNOUNCE: 0x20,
  PEER_REQUEST: 0x21,
  PEER_RESPONSE: 0x22,

  // Channels (0x30-0x3F)
  CHANNEL_JOIN: 0x30,
  CHANNEL_LEAVE: 0x31,
  CHANNEL_MESSAGE: 0x32,

  // Private (0x40-0x4F)
  PRIVATE_MESSAGE: 0x40,
  PRIVATE_ACK: 0x41,

  // Control (0x60-0x6F)
  HEARTBEAT: 0x60,
  PING: 0x61,
  PONG: 0x62,

  // Fragments (0x70-0x7F)
  FRAGMENT: 0x70,

  // Audio messages (0x80-0x8F)
  VOICE_MESSAGE_START: 0x80,
  VOICE_MESSAGE_DATA: 0x81,
  VOICE_MESSAGE_END: 0x82,
  VOICE_MESSAGE_ACK: 0x83,
  AUDIO_STREAM_REQUEST: 0x84,
  AUDIO_STREAM_ACCEPT: 0x85,
  AUDIO_STREAM_REJECT: 0x86,
  AUDIO_STREAM_DATA: 0x87,
  AUDIO_STREAM_END: 0x88,

  // Error (0xFF)
  ERROR: 0xFF
});

/**
 * Message flags
 * @constant {Object.<string, number>}
 */
const MESSAGE_FLAGS = Object.freeze({
  NONE: 0x00,
  ENCRYPTED: 0x01,
  COMPRESSED: 0x02,
  REQUIRES_ACK: 0x04,
  IS_FRAGMENT: 0x08,
  IS_BROADCAST: 0x10,
  HIGH_PRIORITY: 0x20
});

/**
 * Mesh network configuration
 * @constant {Object.<string, number>}
 */
const MESH_CONFIG = Object.freeze({
  /** Maximum number of hops a message can travel */
  MAX_HOPS: 7,
  /** Maximum message payload size in bytes */
  MAX_MESSAGE_SIZE: 500,
  /** Fragment payload size in bytes */
  FRAGMENT_SIZE: 180,
  /** Message header size in bytes */
  HEADER_SIZE: 48,
  /** Message time-to-live in milliseconds (30 minutes) */
  MESSAGE_TTL_MS: 30 * 60 * 1000,
  /** Peer timeout in milliseconds (5 minutes) */
  PEER_TIMEOUT_MS: 5 * 60 * 1000,
  /** Heartbeat interval in milliseconds (30 seconds) */
  HEARTBEAT_INTERVAL_MS: 30 * 1000,
  /** Handshake timeout in milliseconds (30 seconds) */
  HANDSHAKE_TIMEOUT_MS: 30 * 1000,
  /** Maximum retry attempts */
  MAX_RETRIES: 3,
  /** Bloom filter size in bits */
  BLOOM_FILTER_SIZE: 2048,
  /** Number of hash functions for bloom filter */
  BLOOM_HASH_COUNT: 7,
  /** Maximum pending fragments per message */
  MAX_PENDING_FRAGMENTS: 256,
  /** Fragment assembly timeout in milliseconds (60 seconds) */
  FRAGMENT_TIMEOUT_MS: 60 * 1000,
  /** Maximum connected peers */
  MAX_PEERS: 8,
  /** Route entry timeout in milliseconds (10 minutes) */
  ROUTE_TIMEOUT_MS: 10 * 60 * 1000
});

/**
 * Connection states
 * @type {Record<string, string>}
 */
const CONNECTION_STATE = Object.freeze({
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  SECURING: 'securing',
  SECURED: 'secured',
  DISCONNECTING: 'disconnecting',
  FAILED: 'failed'
});

/**
 * Service states
 * @type {Record<string, string>}
 */
const SERVICE_STATE = Object.freeze({
  UNINITIALIZED: 'uninitialized',
  INITIALIZING: 'initializing',
  READY: 'ready',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DESTROYED: 'destroyed',
  ERROR: 'error'
});

module.exports = {
  PROTOCOL_VERSION,
  MESSAGE_TYPE,
  MESSAGE_FLAGS,
  MESH_CONFIG,
  CONNECTION_STATE,
  SERVICE_STATE
};
