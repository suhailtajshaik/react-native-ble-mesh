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

// PRD-specified battery modes
export const BATTERY_MODE: {
  HIGH_PERFORMANCE: 'high';
  BALANCED: 'balanced';
  LOW_POWER: 'low';
  AUTO: 'auto';
};

export const PANIC_TRIGGER: {
  TRIPLE_TAP: 'triple_tap';
  SHAKE: 'shake';
  MANUAL: 'manual';
  VOLUME_COMBO: 'volume_combo';
};

export const HEALTH_STATUS: {
  GOOD: 'good';
  FAIR: 'fair';
  POOR: 'poor';
  UNKNOWN: 'unknown';
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

export interface MeshNetworkConfig {
  nickname?: string;
  batteryMode?: 'high' | 'balanced' | 'low' | 'auto';
  encryption?: {
    level?: string;
    rotateKeysAfter?: number;
  };
  routing?: {
    maxHops?: number;
    bloomFilterSize?: number;
  };
  compression?: {
    enabled?: boolean;
    threshold?: number;
  };
  storeAndForward?: {
    enabled?: boolean;
    retentionHours?: number;
    maxCachedMessages?: number;
  };
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

export interface NetworkHealth {
  activeNodes: number;
  totalKnownNodes: number;
  averageLatencyMs: number;
  packetLossRate: number;
  overallHealth: 'good' | 'fair' | 'poor';
  lastUpdated: number;
}

export interface MeshNetworkStatus {
  state: 'stopped' | 'running';
  identity: Identity;
  peers: number;
  connectedPeers: number;
  channels: number;
  health: NetworkHealth;
  batteryMode: string;
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

export class CryptoError extends MeshError { }
export class ConnectionError extends MeshError { }
export class HandshakeError extends MeshError { }
export class MessageError extends MeshError { }
export class ValidationError extends MeshError {
  static invalidArgument(name: string, value: unknown, details?: Record<string, unknown>): ValidationError;
  static invalidType(name: string, value: unknown, expectedType: string): ValidationError;
}

// ============================================================================
// PRD-Specified High-Level API
// ============================================================================

/**
 * MeshNetwork - High-level API for BitChat-compatible mesh networking.
 * PRD-specified primary entry point.
 */
export class MeshNetwork extends EventEmitter {
  static BatteryMode: typeof BATTERY_MODE;
  static PanicTrigger: typeof PANIC_TRIGGER;
  static HealthStatus: typeof HEALTH_STATUS;

  constructor(config?: MeshNetworkConfig);

  // Lifecycle
  start(transport?: Transport): Promise<void>;
  stop(): Promise<void>;
  destroy(): Promise<void>;

  // Messaging
  broadcast(text: string): Promise<string>;
  sendDirect(peerId: string, text: string): Promise<string>;

  // Channels
  joinChannel(channelName: string, password?: string): Promise<void>;
  leaveChannel(channelName: string): Promise<void>;
  sendToChannel(channelName: string, text: string): Promise<string>;
  getChannels(): Channel[];

  // Peers
  getPeers(): Peer[];
  getConnectedPeers(): Peer[];
  getSecuredPeers(): Peer[];
  blockPeer(peerId: string): void;
  unblockPeer(peerId: string): void;

  // Network Health
  getNetworkHealth(): NetworkHealth;
  getPeerHealth(peerId: string): NodeHealth | null;

  // Battery Management
  setBatteryMode(mode: 'high' | 'balanced' | 'low' | 'auto'): Promise<void>;
  getBatteryMode(): string;
  updateBatteryLevel(level: number, charging?: boolean): void;

  // Security
  enablePanicMode(options?: { trigger?: string; onWipe?: (result: WipeResult) => void }): void;
  disablePanicMode(): void;
  registerPanicTap(): void;
  wipeAllData(): Promise<WipeResult>;

  // Status
  getStatus(): MeshNetworkStatus;
  getIdentity(): Identity;
  setNickname(nickname: string): void;

  // Events
  on(event: 'started', listener: () => void): this;
  on(event: 'stopped', listener: () => void): this;
  on(event: 'peerDiscovered', listener: (peer: Peer) => void): this;
  on(event: 'peerConnected', listener: (peer: Peer) => void): this;
  on(event: 'peerDisconnected', listener: (peer: Peer) => void): this;
  on(event: 'messageReceived', listener: (message: { from: string; text: string; timestamp: number }) => void): this;
  on(event: 'directMessage', listener: (message: { from: string; text: string; timestamp: number }) => void): this;
  on(event: 'channelMessage', listener: (message: { channel: string; from: string; text: string; timestamp: number }) => void): this;
  on(event: 'networkHealthChanged', listener: (info: { previous: string; current: string }) => void): this;
  on(event: 'dataWiped', listener: (result: WipeResult) => void): this;
  on(event: 'error', listener: (error: MeshError) => void): this;
  on(event: string, listener: (...args: unknown[]) => void): this;
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
// PRD-Specified Features - Stats Interfaces
// ============================================================================

/**
 * Store and Forward statistics
 */
export interface StoreAndForwardStats {
  messagesCached: number;
  messagesDelivered: number;
  messagesExpired: number;
  messagesDropped: number;
  deliveryAttempts: number;
  deliveryFailures: number;
  totalCached: number;
  totalSizeBytes: number;
  recipientCount: number;
  cacheUtilization: number;
}

/**
 * Network Monitor statistics
 */
export interface NetworkMonitorStats {
  totalMessagesSent: number;
  totalMessagesDelivered: number;
  totalMessagesFailed: number;
  totalMessagesReceived: number;
  knownNodes: number;
  pendingMessages: number;
  averageLatency: number;
}

/**
 * Individual node health information
 */
export interface NodeHealth {
  peerId: string;
  lastSeen: number;
  latency: number;
  messagesReceived: number;
  messagesSent: number;
  messagesDelivered?: number;
  messagesFailed?: number;
  packetLoss: number;
  isActive: boolean;
  discoveredAt?: number;
  disconnectedAt?: number;
}

/**
 * Battery Optimizer statistics
 */
export interface BatteryOptimizerStats {
  modeChanges: number;
  autoAdjustments: number;
  lastModeChange: number | null;
  currentMode: string;
  batteryLevel: number;
  isCharging: boolean;
}

/**
 * Battery power profile configuration
 */
export interface BatteryProfile {
  name: string;
  scanIntervalMs: number;
  scanWindowMs: number;
  advertisingIntervalMs: number;
  connectionIntervalMs: number;
  connectionLatency: number;
  supervisionTimeoutMs: number;
}

/**
 * Emergency Manager statistics
 */
export interface EmergencyManagerStats {
  wipesTriggered: number;
  averageWipeTimeMs: number;
  lastWipeTime: number | null;
}

/**
 * Panic wipe result
 */
export interface WipeResult {
  trigger: string;
  startTime: number;
  endTime: number;
  elapsedMs: number;
  metTarget: boolean;
  clearerResults: Array<{ index: number; success: boolean; error?: string }>;
  errors: Array<{ index: number; error: string }>;
}

/**
 * Compression statistics
 */
export interface CompressionStats {
  compressionAttempts: number;
  successfulCompressions: number;
  decompressions: number;
  bytesIn: number;
  bytesOut: number;
  averageCompressionRatio: number;
  compressionRate: number;
}

// ============================================================================
// PRD-Specified Features
// ============================================================================

/**
 * Store and Forward Manager for offline peer message delivery
 */
export class StoreAndForwardManager extends EventEmitter {
  constructor(options?: {
    maxMessagesPerRecipient?: number;
    maxTotalMessages?: number;
    maxCacheSizeBytes?: number;
    retentionMs?: number;
    cleanupIntervalMs?: number;
  });

  cacheForOfflinePeer(recipientId: string, encryptedPayload: Uint8Array, options?: { messageId?: string; ttlMs?: number }): Promise<string>;
  deliverCachedMessages(recipientId: string, sendFn: (payload: Uint8Array) => Promise<void>): Promise<{ delivered: number; failed: number }>;
  hasCachedMessages(recipientId: string): boolean;
  getCachedCount(recipientId: string): number;
  getRecipientsWithCache(): string[];
  clearRecipientCache(recipientId: string): number;
  pruneExpiredMessages(): Promise<number>;
  getStats(): StoreAndForwardStats;
  clear(): void;
  destroy(): void;
}

/**
 * Network Health Monitor
 */
export class NetworkMonitor extends EventEmitter {
  constructor(options?: {
    latencySampleSize?: number;
    nodeTimeoutMs?: number;
    healthCheckIntervalMs?: number;
  });

  trackMessageSent(peerId: string, messageId: string): void;
  trackMessageDelivered(messageId: string, latencyMs?: number): void;
  trackMessageFailed(messageId: string): void;
  trackMessageReceived(peerId: string): void;
  trackPeerDiscovered(peerId: string): void;
  trackPeerDisconnected(peerId: string): void;
  generateHealthReport(): NetworkHealth;
  getNodeHealth(peerId: string): NodeHealth | null;
  getAllNodeHealth(): NodeHealth[];
  getLastHealthReport(): NetworkHealth | null;
  getStats(): NetworkMonitorStats;
  reset(): void;
  destroy(): void;

  on(event: 'health-changed', listener: (info: { previous: string; current: string; report: NetworkHealth }) => void): this;
  on(event: 'health-report', listener: (report: NetworkHealth) => void): this;
}

/**
 * Battery Optimizer with adaptive power modes
 */
export class BatteryOptimizer extends EventEmitter {
  constructor(options?: {
    initialMode?: 'high' | 'balanced' | 'low' | 'auto';
    autoAdjust?: boolean;
    batteryCheckIntervalMs?: number;
    activityAdjust?: boolean;
  });

  setTransport(transport: Transport): void;
  setMode(mode: 'high' | 'balanced' | 'low' | 'auto'): Promise<void>;
  getMode(): string;
  getCurrentProfile(): BatteryProfile;
  getProfiles(): Record<string, BatteryProfile>;
  updateBatteryLevel(level: number, isCharging?: boolean): Promise<void>;
  setAutoAdjust(enabled: boolean): void;
  isAutoAdjustEnabled(): boolean;
  recordActivity(): void;
  getBatteryLevel(): number;
  isCharging(): boolean;
  getStats(): BatteryOptimizerStats;
  destroy(): void;

  on(event: 'mode-changed', listener: (info: { previous: string; current: string; profile: BatteryProfile }) => void): this;
  on(event: 'auto-adjusted', listener: (info: { batteryLevel: number; profile: BatteryProfile }) => void): this;
  on(event: 'battery-updated', listener: (info: { level: number; isCharging: boolean }) => void): this;
}

/**
 * Emergency Manager for panic mode / data wipe
 */
export class EmergencyManager extends EventEmitter {
  constructor(options?: {
    trigger?: 'triple_tap' | 'shake' | 'manual' | 'volume_combo';
    tapWindowMs?: number;
    tapCount?: number;
    requireConfirmation?: boolean;
  });

  enablePanicMode(options?: { onWipe?: (result: WipeResult) => void; trigger?: string }): void;
  disablePanicMode(): void;
  isEnabled(): boolean;
  registerClearer(clearer: () => Promise<void>): void;
  registerTap(): void;
  registerAccelerometer(data: { x: number; y: number; z: number }): void;
  triggerManualWipe(): Promise<WipeResult>;
  wipeAllData(): Promise<WipeResult>;
  getStats(): EmergencyManagerStats;
  destroy(): void;

  on(event: 'panic-mode-enabled', listener: (info: { trigger: string }) => void): this;
  on(event: 'panic-mode-disabled', listener: () => void): this;
  on(event: 'panic-wipe-started', listener: (info: { trigger: string; timestamp: number }) => void): this;
  on(event: 'panic-wipe-completed', listener: (result: WipeResult) => void): this;
}

/**
 * Message Compressor with LZ4 algorithm.
 * Uses Knuth's multiplicative hash (constant 2654435761) for optimal distribution.
 */
export class MessageCompressor {
  constructor(options?: { threshold?: number });

  compress(payload: Uint8Array): { data: Uint8Array; compressed: boolean };
  decompress(payload: Uint8Array, wasCompressed: boolean): Uint8Array;
  getCompressionRatio(original: Uint8Array, compressed: Uint8Array): number;
  getStats(): CompressionStats;
  resetStats(): void;
}

export function compress(payload: Uint8Array): { data: Uint8Array; compressed: boolean };
export function decompress(payload: Uint8Array, wasCompressed: boolean): Uint8Array;

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
 * Create a new MeshNetwork instance (PRD-specified high-level API)
 */
export function createMeshNetwork(config?: MeshNetworkConfig): MeshNetwork;

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

