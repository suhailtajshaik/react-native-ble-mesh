/**
 * TypeScript definitions for react-native-ble-mesh
 * BLE Mesh Network Library with Noise Protocol Security
 *
 * This library is designed for React Native applications.
 * Required setup:
 *   npm install react-native-get-random-values
 *   // In your entry file (index.js or App.js), add at the TOP:
 *   import 'react-native-get-random-values';
 */

// ============================================================================
// EventEmitter (React Native compatible)
// ============================================================================

/**
 * React Native compatible EventEmitter interface.
 * This replaces the Node.js 'events' module which is not available in React Native.
 */
export interface EventEmitter {
  on(event: string, listener: (...args: unknown[]) => void): this;
  once(event: string, listener: (...args: unknown[]) => void): this;
  off(event: string, listener: (...args: unknown[]) => void): this;
  emit(event: string, ...args: unknown[]): boolean;
  removeAllListeners(event?: string): this;
  listenerCount(event: string): number;
  eventNames(): string[];
  setMaxListeners(n: number): this;
  getMaxListeners(): number;
}

export class EventEmitter implements EventEmitter {
  constructor(options?: { maxListeners?: number });
}

// ============================================================================
// Constants
// ============================================================================

export const PROTOCOL_VERSION: number;

export const MESSAGE_TYPE: {
  TEXT: number;
  TEXT_ACK: number;
  BINARY: number;
  BINARY_ACK: number;
  HANDSHAKE_INIT: number;
  HANDSHAKE_RESPONSE: number;
  HANDSHAKE_FINAL: number;
  PEER_ANNOUNCE: number;
  PEER_REQUEST: number;
  PEER_RESPONSE: number;
  PEER_LEAVE: number;
  CHANNEL_JOIN: number;
  CHANNEL_LEAVE: number;
  CHANNEL_MESSAGE: number;
  PRIVATE_MESSAGE: number;
  PRIVATE_ACK: number;
  HEARTBEAT: number;
  PING: number;
  PONG: number;
  FRAGMENT: number;
  ERROR: number;
};

export const CONNECTION_STATE: {
  DISCONNECTED: string;
  CONNECTING: string;
  CONNECTED: string;
  SECURING: string;
  SECURED: string;
  FAILED: string;
};

export const SERVICE_STATE: {
  UNINITIALIZED: string;
  INITIALIZING: string;
  READY: string;
  ACTIVE: string;
  SUSPENDED: string;
  ERROR: string;
  DESTROYED: string;
};

export const POWER_MODE: {
  PERFORMANCE: PowerModeConfig;
  BALANCED: PowerModeConfig;
  POWER_SAVER: PowerModeConfig;
  ULTRA_POWER_SAVER: PowerModeConfig;
};

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface PowerModeConfig {
  name: string;
  description: string;
  scan: { interval: number; window: number; allowDuplicates: boolean };
  advertise: { interval: number; txPower: string };
  connection: { timeout: number; latency: number };
}

export interface MeshServiceConfig {
  displayName?: string;
  storage?: Storage | null;
  keyManager?: KeyManager | null;
  compressionEnabled?: boolean;
  compressionThreshold?: number;
}

export interface Identity {
  publicKey: Uint8Array;
  displayName: string;
  signingPublicKey?: Uint8Array;
  fingerprint?: string;
}

export interface MeshStatus {
  state: string;
  identity: Identity;
  peerCount: number;
  securedPeerCount: number;
  channelCount: number;
  sessionCount: number;
}

export interface PeerOptions {
  id: string;
  publicKey?: Uint8Array | null;
  name?: string;
  rssi?: number;
  hopCount?: number;
  metadata?: Record<string, unknown>;
}

export interface PeerJSON {
  id: string;
  publicKey: number[] | null;
  name: string;
  rssi: number;
  hopCount: number;
  lastSeen: number;
  discoveredAt: number;
  connectionState: string;
  hasSecureSession: boolean;
  isConnected: boolean;
  isSecured: boolean;
  metadata: Record<string, unknown>;
}

export interface MessageOptions {
  requiresAck?: boolean;
  compress?: boolean;
  maxHops?: number;
  priority?: 'normal' | 'high';
}

export interface Message {
  id: string;
  type: number;
  senderId: string;
  recipientId?: string;
  content: string | Uint8Array;
  timestamp: number;
  hopCount?: number;
}

export interface Channel {
  id: string;
  name?: string;
  memberCount: number;
}

// ============================================================================
// Error Classes
// ============================================================================

export class MeshError extends Error {
  code: string;
  category: string;
  details: Record<string, unknown>;
  timestamp: number;
  recoverable: boolean;
  constructor(message: string, code?: string, details?: Record<string, unknown>);
  toJSON(): Record<string, unknown>;
  static fromJSON(json: Record<string, unknown>): MeshError;
}

export class CryptoError extends MeshError {}
export class ConnectionError extends MeshError {}
export class HandshakeError extends MeshError {}
export class MessageError extends MeshError {}
export class ValidationError extends MeshError {
  static invalidArgument(name: string, value: unknown, details?: Record<string, unknown>): ValidationError;
  static invalidType(name: string, value: unknown, expectedType: string): ValidationError;
}

// ============================================================================
// Core Classes
// ============================================================================

/**
 * Represents a peer in the mesh network
 */
export class Peer {
  id: string;
  publicKey: Uint8Array | null;
  name: string;
  rssi: number;
  hopCount: number;
  lastSeen: number;
  discoveredAt: number;
  connectionState: string;
  hasSecureSession: boolean;
  metadata: Record<string, unknown>;

  constructor(options: PeerOptions);
  isConnected(): boolean;
  isSecured(): boolean;
  isDirect(): boolean;
  updateLastSeen(timestamp?: number): void;
  setConnectionState(state: string): void;
  markSecured(): void;
  setPublicKey(publicKey: Uint8Array): void;
  getAge(): number;
  isStale(maxAge: number): boolean;
  clone(): Peer;
  toJSON(): PeerJSON;
  static fromJSON(data: PeerJSON): Peer;
}

/**
 * Main orchestrator for the BLE Mesh Network
 */
export class MeshService extends EventEmitter {
  static STATE: typeof SERVICE_STATE;

  constructor(config?: MeshServiceConfig);

  // Lifecycle
  initialize(options?: MeshServiceConfig): Promise<void>;
  start(transport: Transport): Promise<void>;
  stop(): Promise<void>;
  destroy(): Promise<void>;

  // Identity
  getIdentity(): Identity;
  setDisplayName(name: string): void;
  exportIdentity(): Record<string, unknown> | null;
  importIdentity(identity: Record<string, unknown>): void;

  // Peers
  getPeers(): Peer[];
  getPeer(id: string): Peer | undefined;
  getConnectedPeers(): Peer[];
  getSecuredPeers(): string[];
  initiateHandshake(peerId: string): Promise<void>;
  blockPeer(id: string): void;
  unblockPeer(id: string): void;

  // Messaging
  sendBroadcast(content: string): string;
  sendPrivateMessage(peerId: string, content: string, options?: MessageOptions): Promise<string>;
  sendChannelMessage(channelId: string, content: string): string;

  // Channels
  joinChannel(channelId: string, password?: string): void;
  leaveChannel(channelId: string): void;
  getChannels(): Channel[];

  // Status
  getStatus(): MeshStatus;
  getState(): string;

  // Events
  on(event: 'peer-discovered', listener: (data: { peer: Peer }) => void): this;
  on(event: 'peer-connected', listener: (data: { peer: Peer }) => void): this;
  on(event: 'peer-disconnected', listener: (data: { peer: Peer }) => void): this;
  on(event: 'peer-secured', listener: (data: { peer: Peer }) => void): this;
  on(event: 'message', listener: (message: Message) => void): this;
  on(event: 'private-message', listener: (message: Message) => void): this;
  on(event: 'channel-message', listener: (message: Message & { channelId: string }) => void): this;
  on(event: 'handshake-complete', listener: (data: { peerId: string }) => void): this;
  on(event: 'handshake-failed', listener: (data: { peerId: string; error: Error }) => void): this;
  on(event: 'state-changed', listener: (data: { oldState: string; newState: string }) => void): this;
  on(event: 'error', listener: (error: MeshError) => void): this;
  on(event: string, listener: (...args: unknown[]) => void): this;
}

// ============================================================================
// Transport Layer
// ============================================================================

export interface TransportEvents {
  message: { peerId: string; data: Uint8Array };
  peerConnected: { peerId: string };
  peerDisconnected: { peerId: string };
  error: Error;
}

/**
 * Abstract transport interface
 */
export abstract class Transport extends EventEmitter {
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract send(peerId: string, data: Uint8Array): Promise<void>;
  abstract broadcast(data: Uint8Array): Promise<void>;
  abstract isConnected(peerId: string): boolean;
  abstract getConnectedPeers(): string[];
}

export interface BLETransportOptions {
  adapter?: BLEAdapter;
  powerMode?: keyof typeof POWER_MODE;
  autoConnect?: boolean;
}

/**
 * BLE Transport implementation
 */
export class BLETransport extends Transport {
  constructor(options?: BLETransportOptions);
  start(): Promise<void>;
  stop(): Promise<void>;
  send(peerId: string, data: Uint8Array): Promise<void>;
  broadcast(data: Uint8Array): Promise<void>;
  isConnected(peerId: string): boolean;
  getConnectedPeers(): string[];
  setPowerMode(mode: keyof typeof POWER_MODE): void;
  getPowerMode(): string;
}

/**
 * Mock transport for testing
 */
export class MockTransport extends Transport {
  constructor();
  start(): Promise<void>;
  stop(): Promise<void>;
  send(peerId: string, data: Uint8Array): Promise<void>;
  broadcast(data: Uint8Array): Promise<void>;
  isConnected(peerId: string): boolean;
  getConnectedPeers(): string[];
  simulateIncoming(peerId: string, data: Uint8Array): void;
  simulatePeerConnect(peerId: string): void;
  simulatePeerDisconnect(peerId: string): void;
  linkTo(other: MockTransport): void;
}

// ============================================================================
// Storage Layer
// ============================================================================

/**
 * Abstract storage interface
 */
export abstract class Storage {
  abstract get(key: string): Promise<string | null>;
  abstract set(key: string, value: string): Promise<void>;
  abstract remove(key: string): Promise<void>;
  abstract clear(): Promise<void>;
  abstract keys(): Promise<string[]>;
}

/**
 * In-memory storage implementation
 */
export class MemoryStorage extends Storage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

/**
 * React Native AsyncStorage adapter
 */
export class AsyncStorageAdapter extends Storage {
  constructor(asyncStorage: unknown);
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

// ============================================================================
// Crypto Module
// ============================================================================

export interface KeyPairData {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface KeyManager {
  getStaticKeyPair(): KeyPairData;
  getPublicKey(): Uint8Array;
  exportIdentity(): Record<string, unknown>;
  importIdentity(identity: Record<string, unknown>): void;
}

export interface BLEAdapter {
  start(): Promise<void>;
  stop(): Promise<void>;
  scan(options: unknown): Promise<void>;
  stopScan(): Promise<void>;
  connect(deviceId: string): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
  write(deviceId: string, data: Uint8Array): Promise<void>;
}

export namespace crypto {
  function sha256(data: Uint8Array): Uint8Array;
  function hmac(key: Uint8Array, data: Uint8Array): Uint8Array;
  function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Uint8Array;

  namespace x25519 {
    function generateKeyPair(): KeyPairData;
    function scalarMult(scalar: Uint8Array, point: Uint8Array): Uint8Array;
    function scalarMultBase(scalar: Uint8Array): Uint8Array;
  }

  namespace aead {
    function encrypt(key: Uint8Array, nonce: Uint8Array, plaintext: Uint8Array, aad?: Uint8Array): Uint8Array;
    function decrypt(key: Uint8Array, nonce: Uint8Array, ciphertext: Uint8Array, aad?: Uint8Array): Uint8Array | null;
  }

  class KeyPair {
    publicKey: Uint8Array;
    static generate(): KeyPair;
    static fromSecretKey(secretKey: Uint8Array): KeyPair;
    computeSharedSecret(otherPublicKey: Uint8Array): Uint8Array;
    destroy(): void;
  }

  namespace noise {
    class NoiseHandshake {
      constructor();
      initializeInitiator(staticKeyPair: KeyPairData): void;
      initializeResponder(staticKeyPair: KeyPairData): void;
      writeMessage1(): Uint8Array;
      readMessage1(data: Uint8Array): void;
      writeMessage2(): Uint8Array;
      readMessage2(data: Uint8Array): void;
      writeMessage3(): Uint8Array;
      readMessage3(data: Uint8Array): void;
      isComplete(): boolean;
      getSession(): NoiseSession;
      getRemotePublicKey(): Uint8Array;
    }

    class NoiseSession {
      encrypt(plaintext: Uint8Array, aad?: Uint8Array): Uint8Array;
      decrypt(ciphertext: Uint8Array, aad?: Uint8Array): Uint8Array;
      isActive(): boolean;
      destroy(): void;
    }
  }
}

// ============================================================================
// Utilities
// ============================================================================

export namespace utils {
  function randomBytes(length: number): Uint8Array;
  function bytesToHex(bytes: Uint8Array): string;
  function hexToBytes(hex: string): Uint8Array;
  function bytesToBase64(bytes: Uint8Array): string;
  function base64ToBytes(base64: string): Uint8Array;
  function bytesToUtf8(bytes: Uint8Array): string;
  function utf8ToBytes(str: string): Uint8Array;
  function concat(...arrays: Uint8Array[]): Uint8Array;
  function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean;
  function generateUUID(): string;

  class LRUCache<K, V> {
    constructor(maxSize: number);
    get(key: K): V | undefined;
    set(key: K, value: V): void;
    has(key: K): boolean;
    delete(key: K): boolean;
    clear(): void;
    readonly size: number;
  }

  class RateLimiter {
    constructor(options: { tokensPerInterval: number; interval: number; maxBurst?: number });
    tryConsume(tokens?: number): boolean;
    consume(tokens?: number): Promise<void>;
    getTokens(): number;
    reset(): void;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new MeshService instance
 */
export function createMeshService(config?: MeshServiceConfig): MeshService;

/**
 * Create a MeshService configured for Node.js
 */
export function createNodeMesh(options?: {
  displayName?: string;
  storage?: Storage;
}): Promise<MeshService>;

/**
 * Create a MeshService configured for testing
 */
export function createTestMesh(options?: {
  displayName?: string;
}): Promise<{ mesh: MeshService; transport: MockTransport }>;
