# CLAUDE.md - BLE Mesh Network Library Generation Guide

## Project Overview

Generate a **production-ready Node.js/React Native BLE Mesh Network library** with Noise Protocol security. This library enables peer-to-peer communication over Bluetooth Low Energy with end-to-end encryption, multi-hop routing, and offline-first capabilities.

**Target Use Cases:**
- Offline messaging apps (like Bridgefy, Briar)
- Disaster communication networks
- Privacy-focused P2P chat
- IoT mesh networks
- Gaming multiplayer over BLE

---

## Architecture Principles

### 1. Modular Design
- Each module should be **single-responsibility**
- Maximum **200 lines per file**
- Clear separation: crypto, transport, mesh, storage, protocol
- Dependency injection for testability
- No circular dependencies

### 2. Code Quality Standards
- **ESLint** with strict rules
- **JSDoc** comments on all public APIs
- **100% test coverage** on crypto modules
- **>80% coverage** on other modules
- Consistent error handling with custom error classes

### 3. Security First
- All crypto operations use constant-time comparisons
- No secrets in logs or error messages
- Secure key storage abstractions
- Forward secrecy through ephemeral keys

---

## Module Structure

```
react-native-ble-mesh/
├── src/
│   ├── index.js                    # Main exports
│   ├── constants/
│   │   ├── index.js                # Re-exports
│   │   ├── protocol.js             # Protocol version, message types
│   │   ├── ble.js                  # BLE UUIDs, MTU sizes, power modes
│   │   ├── crypto.js               # Crypto parameters
│   │   └── errors.js               # Error codes
│   │
│   ├── errors/
│   │   ├── index.js                # Error class exports
│   │   ├── MeshError.js            # Base error class
│   │   ├── CryptoError.js          # Crypto-specific errors
│   │   ├── ConnectionError.js      # Connection errors
│   │   ├── HandshakeError.js       # Handshake errors
│   │   ├── MessageError.js         # Message errors
│   │   ├── PaddingError.js         # Padding errors│   │   ├── FragmentError.js        # Fragment errors│   │   ├── VersionError.js         # Version negotiation errors│   │   ├── TrustError.js           # Trust/verification errors│   │   └── RetryError.js           # Retry errors│   │
│   ├── crypto/
│   │   ├── index.js                # Crypto exports
│   │   ├── sha256.js               # SHA-256 implementation
│   │   ├── hmac.js                 # HMAC-SHA256
│   │   ├── hkdf.js                 # HKDF key derivation
│   │   ├── x25519.js               # X25519 key exchange
│   │   ├── ed25519.js              # Ed25519 signatures│   │   ├── chacha20.js             # ChaCha20 stream cipher
│   │   ├── poly1305.js             # Poly1305 MAC
│   │   ├── aead.js                 # ChaCha20-Poly1305 AEAD
│   │   ├── noise/
│   │   │   ├── index.js            # Noise exports
│   │   │   ├── state.js            # Symmetric state
│   │   │   ├── handshake.js        # Handshake state machine
│   │   │   ├── session.js          # Transport session (with rekey)
│   │   │   └── ReplayProtection.js # Sliding window replay protection│   │   └── keys/
│   │       ├── index.js            # Key management exports
│   │       ├── KeyPair.js          # X25519 KeyPair class
│   │       ├── SigningKeyPair.js   # Ed25519 SigningKeyPair│   │       ├── KeyManager.js       # Identity management (dual keys)
│   │       ├── Fingerprint.js      # Fingerprint generation│   │       └── SecureStorage.js    # Secure key storage abstraction
│   │
│   ├── protocol/
│   │   ├── index.js                # Protocol exports
│   │   ├── header.js               # Optimized message header (24-32 bytes)
│   │   ├── message.js              # Message class
│   │   ├── serializer.js           # Binary serialization (with compression)
│   │   ├── deserializer.js         # Binary deserialization
│   │   ├── validator.js            # Message validation
│   │   ├── padding.js              # PKCS#7 packet padding│   │   ├── VersionNegotiator.js    # Protocol version negotiation│   │   └── IdentityAnnouncement.js # Identity announcement protocol│   │
│   ├── mesh/
│   │   ├── index.js                # Mesh exports
│   │   ├── router/
│   │   │   ├── index.js            # Router exports
│   │   │   ├── MessageRouter.js    # Main routing logic
│   │   │   ├── RouteTable.js       # Routing table
│   │   │   └── PathFinder.js       # Route discovery
│   │   ├── dedup/
│   │   │   ├── index.js            # Dedup exports
│   │   │   ├── BloomFilter.js      # Bloom filter
│   │   │   └── MessageCache.js     # Recent message cache
│   │   ├── fragment/
│   │   │   ├── index.js            # Fragment exports
│   │   │   ├── Fragmenter.js       # Enhanced fragmentation (START/CONTINUE/END)
│   │   │   └── Assembler.js        # Fragment reassembly
│   │   └── peer/
│   │       ├── index.js            # Peer exports
│   │       ├── Peer.js             # Peer class (with trust fields)
│   │       ├── PeerManager.js      # Peer lifecycle
│   │       ├── PeerDiscovery.js    # Discovery protocol
│   │       └── TrustManager.js     # Social trust layer│   │
│   ├── transport/
│   │   ├── index.js                # Transport exports
│   │   ├── Transport.js            # Abstract transport interface
│   │   ├── BLETransport.js         # BLE implementation (with power modes)
│   │   ├── MockTransport.js        # Mock for testing
│   │   └── adapters/
│   │       ├── index.js            # Adapter exports
│   │       ├── RNBLEAdapter.js     # react-native-ble-plx adapter
│   │       └── NodeBLEAdapter.js   # Noble adapter for Node.js
│   │
│   ├── storage/
│   │   ├── index.js                # Storage exports
│   │   ├── Storage.js              # Abstract storage interface
│   │   ├── MemoryStorage.js        # In-memory storage
│   │   ├── AsyncStorageAdapter.js  # React Native AsyncStorage
│   │   └── MessageStore.js         # Message persistence
│   │
│   ├── utils/
│   │   ├── index.js                # Utility exports
│   │   ├── bytes.js                # Byte manipulation
│   │   ├── encoding.js             # Hex, Base64 encoding
│   │   ├── uuid.js                 # UUID generation
│   │   ├── peerId.js               # Optimized 8-byte peer ID│   │   ├── time.js                 # Timestamps, delays
│   │   ├── validation.js           # Input validation
│   │   ├── compression.js          # LZ4 block compression│   │   ├── EventEmitter.js         # Enhanced EventEmitter
│   │   ├── LRUCache.js             # LRU cache
│   │   ├── RateLimiter.js          # Token bucket rate limiter
│   │   ├── MessageBatcher.js       # Message batching│   │   └── retry.js                # Retry with backoff
│   │
│   └── service/
│       ├── index.js                # Service exports
│       ├── MeshService.js          # Main orchestrator
│       ├── HandshakeManager.js     # Handshake orchestration
│       ├── HandshakeRateLimiter.js # DoS protection│       ├── SessionManager.js       # Session lifecycle
│       ├── SessionPool.js          # Connection pooling│       ├── MessageRetryService.js  # Automatic message retry│       └── ChannelManager.js       # Channel management
│
├── __tests__/
│   ├── crypto/
│   │   ├── sha256.test.js
│   │   ├── x25519.test.js
│   │   ├── ed25519.test.js        │   │   ├── aead.test.js
│   │   ├── noise.test.js
│   │   ├── replayProtection.test.js│   │   └── fingerprint.test.js    │   ├── protocol/
│   │   ├── serializer.test.js
│   │   ├── message.test.js
│   │   ├── padding.test.js        │   │   ├── versionNegotiator.test.js│   │   └── identityAnnouncement.test.js│   ├── mesh/
│   │   ├── router.test.js
│   │   ├── bloomfilter.test.js
│   │   ├── fragment.test.js
│   │   └── trustManager.test.js   │   ├── service/
│   │   ├── messageRetry.test.js   │   │   ├── sessionPool.test.js    │   │   └── handshakeRateLimiter.test.js│   ├── utils/
│   │   ├── compression.test.js    │   │   ├── peerId.test.js         │   │   └── messageBatcher.test.js │   ├── integration/
│   │   ├── handshake.test.js
│   │   ├── messaging.test.js
│   │   ├── multihop.test.js
│   │   └── compression.test.js    │   └── helpers/
│       ├── testVectors.js
│       └── mockTransport.js
│
├── examples/
│   ├── basic-chat/
│   ├── react-native-app/
│   └── node-gateway/
│
├── docs/
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── SECURITY.md
│   └── PROTOCOL.md
│
├── package.json
├── jest.config.js
├── .eslintrc.js
├── README.md
├── CHANGELOG.md
└── LICENSE
```

---

## Detailed Module Specifications

### 1. Constants Module (`src/constants/`)

#### `protocol.js`
```javascript
// Protocol version for compatibility checking
PROTOCOL_VERSION = 1
SUPPORTED_VERSIONS = [1]
MIN_SUPPORTED_VERSION = 1

// Message types (single byte)
MESSAGE_TYPE = {
  // Data messages (0x01-0x0F)
  TEXT: 0x01,
  TEXT_ACK: 0x02,
  BINARY: 0x03,
  BINARY_ACK: 0x04,

  // Handshake (0x10-0x1F)
  HANDSHAKE_INIT: 0x10,
  HANDSHAKE_RESPONSE: 0x11,
  HANDSHAKE_FINAL: 0x12,

  // Discovery (0x20-0x2F)
  PEER_ANNOUNCE: 0x20,
  PEER_REQUEST: 0x21,
  PEER_RESPONSE: 0x22,
  IDENTITY_ANNOUNCE: 0x23,     // Identity with signature  PEER_LEAVE: 0x24,

  // Channels (0x30-0x3F)
  CHANNEL_JOIN: 0x30,
  CHANNEL_LEAVE: 0x31,
  CHANNEL_MESSAGE: 0x32,
  CHANNEL_ACK: 0x33,

  // Private (0x40-0x4F)
  PRIVATE_MESSAGE: 0x40,
  PRIVATE_ACK: 0x41,
  READ_RECEIPT: 0x42,          // Read receipt
  // Version Negotiation (0x50-0x5F)  VERSION_HELLO: 0x50,
  VERSION_ACK: 0x51,
  VERSION_REJECT: 0x52,

  // Control (0x60-0x6F)
  HEARTBEAT: 0x60,
  PING: 0x61,
  PONG: 0x62,
  SYNC_REQUEST: 0x63,
  SYNC_RESPONSE: 0x64,

  // Fragments (0x70-0x7F) - Enhanced
  FRAGMENT_START: 0x70,        // First fragment with metadata  FRAGMENT_CONTINUE: 0x71,     // Intermediate fragments  FRAGMENT_END: 0x72,          // Final fragment
  // Error (0xF0-0xFF)
  ERROR: 0xFF,
  ERROR_PROTOCOL: 0xFE,
  ERROR_CRYPTO: 0xFD
}

// Message flags (bit field)
MESSAGE_FLAGS = {
  NONE: 0x00,
  HAS_RECIPIENT: 0x01,    // recipientId field present
  HAS_SIGNATURE: 0x02,    // Ed25519 signature appended
  IS_COMPRESSED: 0x04,    // Payload is LZ4 compressed
  IS_ENCRYPTED: 0x08,     // Payload is AEAD encrypted
  IS_ACK: 0x10,           // Message is an acknowledgment
  REQUIRES_ACK: 0x20,     // Sender expects acknowledgment
}

// Mesh configuration
MESH_CONFIG = {
  // Routing
  MAX_HOPS: 15,                        // Maximum hop count (4 bits in TTL)
  DEFAULT_MAX_HOPS: 7,                 // Default TTL

  // Message sizes
  MAX_MESSAGE_SIZE: 65535,             // Maximum total message size
  MAX_FRAGMENT_PAYLOAD: 180,           // Fragment payload size (BLE MTU safe)
  HEADER_SIZE_BASE: 24,                // Base header without recipient
  HEADER_SIZE_EXTENDED: 32,            // Header with recipient

  // Padding block sizes (for traffic analysis resistance)
  PADDING_BLOCK_SIZES: [256, 512, 1024, 2048],
  MAX_PADDED_SIZE: 2048,

  // Timing
  MESSAGE_TTL_MS: 30 * 60 * 1000,      // 30 minutes
  PEER_TIMEOUT_MS: 5 * 60 * 1000,      // 5 minutes
  HEARTBEAT_INTERVAL_MS: 30 * 1000,    // 30 seconds
  HANDSHAKE_TIMEOUT_MS: 30 * 1000,     // 30 seconds
  VERSION_NEGOTIATION_TIMEOUT_MS: 10 * 1000, // 10 seconds
  FRAGMENT_TIMEOUT_MS: 30 * 1000,      // 30 seconds

  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_BASE_DELAY_MS: 5000,
  RETRY_BACKOFF_MULTIPLIER: 2,
  RETRY_MAX_DELAY_MS: 60000,

  // Deduplication
  BLOOM_FILTER_SIZE: 2048,
  BLOOM_HASH_COUNT: 7,
  MESSAGE_CACHE_SIZE: 1000,

  // Fragmentation
  MAX_PENDING_FRAGMENT_SETS: 100,
  MAX_FRAGMENTS_PER_MESSAGE: 256,

  // Compression
  COMPRESSION_THRESHOLD: 64,           // Minimum bytes before compressing
  MAX_DECOMPRESSED_SIZE: 65536,        // 64KB max decompressed size

  // Identity
  MAX_NICKNAME_LENGTH: 64,
  IDENTITY_ANNOUNCE_INTERVAL_MS: 5 * 60 * 1000,  // 5 minutes

  // Read receipts
  READ_RECEIPT_BATCH_DELAY_MS: 1000
}

// Peer ID configuration
PEER_ID_CONFIG = {
  FULL_SIZE: 32,                       // Full public key size
  TRUNCATED_SIZE: 8                    // Truncated ID for headers
}

// Verification status
VERIFICATION_STATUS = {
  UNVERIFIED: 'unverified',
  VERIFIED: 'verified',
  COMPROMISED: 'compromised'
}

// Trust levels
TRUST_LEVEL = {
  BLOCKED: -1,
  UNKNOWN: 0,
  UNVERIFIED: 1,
  VERIFIED: 2,
  FAVORITE: 3
}
```

#### `ble.js`
```javascript
// Nordic UART Service compatible UUIDs
BLE_SERVICE_UUID = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E'
BLE_CHARACTERISTIC_TX = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E'
BLE_CHARACTERISTIC_RX = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E'

// Power modes (enhanced with full configuration)
POWER_MODE = {
  PERFORMANCE: {
    name: 'PERFORMANCE',
    description: 'Maximum responsiveness, highest power consumption',
    scan: { interval: 1000, window: 800, allowDuplicates: true },
    advertise: { interval: 100, txPower: 'high' },
    connection: { timeout: 5000, latency: 0 }
  },
  BALANCED: {
    name: 'BALANCED',
    description: 'Good balance of responsiveness and battery life',
    scan: { interval: 5000, window: 2000, allowDuplicates: false },
    advertise: { interval: 500, txPower: 'medium' },
    connection: { timeout: 10000, latency: 1 }
  },
  POWER_SAVER: {
    name: 'POWER_SAVER',
    description: 'Reduced responsiveness, lower power consumption',
    scan: { interval: 30000, window: 5000, allowDuplicates: false },
    advertise: { interval: 1000, txPower: 'low' },
    connection: { timeout: 30000, latency: 4 }
  },
  ULTRA_POWER_SAVER: {
    name: 'ULTRA_POWER_SAVER',
    description: 'Minimal power consumption, for background operation',
    scan: { interval: 60000, window: 5000, allowDuplicates: false },
    advertise: { interval: 2000, txPower: 'ultraLow' },
    connection: { timeout: 60000, latency: 10 }
  }
}

// Auto-adjust thresholds
POWER_AUTO_ADJUST = {
  enabled: false,
  batteryThresholds: {
    PERFORMANCE: 80,       // Use above 80%
    BALANCED: 50,          // Use between 50-80%
    POWER_SAVER: 20,       // Use between 20-50%
    ULTRA_POWER_SAVER: 0   // Use below 20%
  }
}
```

#### `crypto.js`
```javascript
CRYPTO_CONFIG = {
  KEY_SIZE: 32,
  NONCE_SIZE: 12,
  TAG_SIZE: 16,
  PUBLIC_KEY_SIZE: 32,
  NOISE_PROTOCOL_NAME: 'Noise_XX_25519_ChaChaPoly_SHA256'
}

// Ed25519 constants
ED25519_CONFIG = {
  SEED_SIZE: 32,
  PUBLIC_KEY_SIZE: 32,
  SECRET_KEY_SIZE: 64,      // seed (32) + public key (32)
  SIGNATURE_SIZE: 64
}

// Replay protection constants
REPLAY_PROTECTION_CONFIG = {
  DEFAULT_WINDOW_SIZE: 64,
  MAX_WINDOW_SIZE: 8192
}

// Session rekey constants
REKEY_CONFIG = {
  DEFAULT_INTERVAL_MS: 3600000,      // 1 hour
  DEFAULT_MESSAGE_COUNT: 10000,
  NONCE_WARNING_THRESHOLD: BigInt(2) ** BigInt(62)
}

// Rate limiter constants
RATE_LIMIT_CONFIG = {
  MAX_HANDSHAKE_ATTEMPTS: 5,
  HANDSHAKE_WINDOW_MS: 60000,        // 1 minute
  BLOCK_DURATION_MS: 300000,         // 5 minutes
  MAX_TRACKED_PEERS: 10000
}

// Compression constants
COMPRESSION_CONFIG = {
  THRESHOLD_BYTES: 64,
  MAX_OFFSET: 65535,
  MIN_MATCH: 4,
  HASH_TABLE_SIZE: 4096
}

// Session pool constants
SESSION_POOL_CONFIG = {
  MAX_SESSIONS: 50,
  IDLE_TIMEOUT_MS: 30 * 60 * 1000,   // 30 minutes
  ABSOLUTE_TIMEOUT_MS: 24 * 60 * 60 * 1000,  // 24 hours
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000,  // 5 minutes
  LAZY_HANDSHAKE: true
}

// Message batching constants
BATCH_CONFIG = {
  MAX_BATCH_SIZE: 512,
  MAX_BATCH_DELAY_MS: 50,
  MAX_MESSAGES: 10,
  MIN_MESSAGES: 2,
  HEADER_SIZE: 4
}
```

---

### 2. Crypto Module (`src/crypto/`)

#### Design Requirements:
- **Pure JavaScript** implementations for portability
- **Test vectors** from RFCs for validation
- **Constant-time operations** where security-critical
- Option to use **native modules** for performance
- **Dual key pairs**: X25519 for encryption, Ed25519 for signing

#### `sha256.js`
```javascript
/**
 * SHA-256 hash function (FIPS 180-4)
 *
 * Requirements:
 * - Implement complete SHA-256 as per FIPS 180-4
 * - Support streaming/incremental hashing
 * - Pass all test vectors from RFC examples
 *
 * Exports:
 * - hash(data: Uint8Array): Uint8Array  // Returns 32-byte hash
 * - createHash(): HashContext            // For streaming
 */
```

#### `x25519.js`
```javascript
/**
 * X25519 Elliptic Curve Diffie-Hellman (RFC 7748)
 *
 * Requirements:
 * - Full Curve25519 field arithmetic
 * - Montgomery ladder for scalar multiplication
 * - Key clamping as per RFC 7748
 * - Pass RFC 7748 test vectors
 *
 * Exports:
 * - generateKeyPair(): { publicKey, secretKey }
 * - scalarMult(scalar, point): Uint8Array
 * - scalarMultBase(scalar): Uint8Array
 */
```

#### `ed25519.js````javascript
/**
 * Ed25519 Digital Signatures (RFC 8032)
 *
 * Ed25519 provides high-speed, high-security digital signatures for
 * message authentication and identity verification in the mesh network.
 *
 * Requirements:
 * - Full RFC 8032 compliant Ed25519 implementation
 * - SHA-512 for internal hashing (as per RFC 8032)
 * - Deterministic signature generation (no random nonce)
 * - Constant-time operations where security-critical
 * - Validate public keys are on curve before use
 * - Reject small-order public keys
 * - Pass all RFC 8032 Section 7.1 test vectors
 *
 * Exports:
 * - generateSigningKeyPair(): { publicKey: Uint8Array, secretKey: Uint8Array }
 *     publicKey: 32 bytes, secretKey: 64 bytes (seed + public key)
 *
 * - generateSigningKeyPairFromSeed(seed: Uint8Array): { publicKey, secretKey }
 *     Deterministically generate from 32-byte seed
 *
 * - sign(secretKey: Uint8Array, message: Uint8Array): Uint8Array
 *     Create a 64-byte signature over the message
 *
 * - verify(publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array): boolean
 *     Verify a signature, returns true if valid, false otherwise
 *
 * - getPublicKeyFromSecretKey(secretKey: Uint8Array): Uint8Array
 *     Extract 32-byte public key from 64-byte secret key
 */
```

#### `aead.js`
```javascript
/**
 * ChaCha20-Poly1305 AEAD (RFC 8439)
 *
 * Requirements:
 * - ChaCha20 quarter-round and block function
 * - Poly1305 one-time MAC
 * - Combined AEAD construction
 * - Pass RFC 8439 test vectors
 *
 * Exports:
 * - encrypt(key, nonce, plaintext, aad?): Uint8Array
 * - decrypt(key, nonce, ciphertext, aad?): Uint8Array | null
 */
```

#### `noise/handshake.js`
```javascript
/**
 * Noise Protocol XX Handshake Pattern
 *
 * Pattern:
 *   -> e
 *   <- e, ee, s, es
 *   -> s, se
 *
 * Requirements:
 * - Full XX pattern implementation
 * - Symmetric state management (h, ck, k, n)
 * - MixHash, MixKey, EncryptAndHash, DecryptAndHash
 * - Proper Split for transport keys
 * - State machine validation (prevent out-of-order calls)
 *
 * Exports:
 * - class NoiseHandshake
 *   - initializeInitiator(staticKeyPair)
 *   - initializeResponder(staticKeyPair)
 *   - writeMessage1(): Uint8Array
 *   - readMessage1(data): void
 *   - writeMessage2(): Uint8Array
 *   - readMessage2(data): void
 *   - writeMessage3(): Uint8Array
 *   - readMessage3(data): void
 *   - isComplete(): boolean
 *   - getSession(): NoiseSession
 *   - getRemotePublicKey(): Uint8Array
 */
```

#### `noise/session.js` (Enhanced with Rekey)
```javascript
/**
 * Noise Transport Session with Automatic Rekeying
 *
 * Manages encrypted transport after handshake completion.
 * Includes automatic rekeying for forward secrecy.
 *
 * Rekey Triggers:
 * - Time-based: 1 hour since last key (configurable)
 * - Count-based: 10,000 messages encrypted (configurable)
 * - Manual: Explicit rekey() call
 *
 * Requirements:
 * - Track message count for each direction
 * - Track session start time and last rekey time
 * - Automatic rekey check before each encrypt/decrypt
 * - Reset replay protection window on rekey
 * - Emit 'rekey' event when rekeying occurs
 *
 * Exports:
 * - class NoiseSession extends EventEmitter
 *   - constructor(options: { sendKey, receiveKey, remotePeerId, isInitiator,
 *       rekeyIntervalMs?, rekeyMessageCount?, enableReplayProtection? })
 *   - encrypt(plaintext: Uint8Array, aad?: Uint8Array): Uint8Array
 *   - decrypt(data: Uint8Array, aad?: Uint8Array): Uint8Array
 *   - needsRekey(): boolean
 *   - rekey(): void
 *   - rekeyReceive(): void
 *   - forceRekey(): void
 *   - getStats(): SessionStats
 *   - isActive(): boolean
 *   - destroy(): void
 *   - Events: 'rekey', 'replay-detected', 'nonce-exhaustion-warning'
 */
```

#### `noise/ReplayProtection.js````javascript
/**
 * Sliding Window Replay Protection for Noise Transport
 *
 * Prevents replay attacks by tracking received message nonces
 * using an efficient sliding window bitmap algorithm.
 *
 * Algorithm:
 * - Maintain a bitmap of size WINDOW_SIZE for recent nonces
 * - Track highest nonce received
 * - Accept nonce if greater than highest seen OR within window and not seen
 * - Reject if too old (before window) or already received (replay)
 *
 * Requirements:
 * - Efficient O(1) check and record operations
 * - Configurable window size (power of 2, default 64)
 * - Memory efficient bitmap storage
 * - Handle BigInt for nonces > Number.MAX_SAFE_INTEGER
 * - Support for serialization/restore of state
 *
 * Exports:
 * - class ReplayProtection
 *   - constructor(options?: { windowSize?: number })
 *   - checkAndRecord(nonce: bigint | number): boolean
 *   - isValid(nonce: bigint | number): boolean
 *   - record(nonce: bigint | number): void
 *   - getHighestNonce(): bigint
 *   - getWindowStart(): bigint
 *   - reset(): void
 *   - export(): { highestNonce: string, bitmap: string }
 *   - static restore(state): ReplayProtection
 *   - getStats(): ReplayStats
 */
```

#### `keys/SigningKeyPair.js````javascript
/**
 * Ed25519 Signing Key Pair Management
 *
 * Manages Ed25519 signing keys separately from X25519 encryption keys,
 * following cryptographic best practice of key separation.
 *
 * Requirements:
 * - Wrap Ed25519 key generation and operations
 * - Immutable public key exposure
 * - Secure secret key handling (never exposed directly)
 * - Clear/destroy method to zero out secret key from memory
 *
 * Exports:
 * - class SigningKeyPair
 *   - static generate(): SigningKeyPair
 *   - static fromSeed(seed: Uint8Array): SigningKeyPair
 *   - static fromSecretKey(secretKey: Uint8Array): SigningKeyPair
 *   - get publicKey(): Uint8Array
 *   - get publicKeyHex(): string
 *   - get isDestroyed(): boolean
 *   - sign(message: Uint8Array): Uint8Array
 *   - verify(message: Uint8Array, signature: Uint8Array): boolean
 *   - export(): { publicKey, secretKey }
 *   - destroy(): void
 *   - equals(other: SigningKeyPair): boolean
 */
```

#### `keys/Fingerprint.js````javascript
/**
 * Cryptographic Fingerprint Generation and Verification
 *
 * Fingerprints provide a human-verifiable representation of public keys
 * for out-of-band identity verification (QR codes, verbal confirmation).
 *
 * Format: Fingerprint = SHA256(StaticPublicKey)
 *
 * Requirements:
 * - Generate fingerprints from X25519 public keys
 * - Support multiple output formats (hex, base32, chunked display)
 * - QR code data encoding/decoding
 * - Constant-time comparison for security
 *
 * Exports:
 * - generate(publicKey: Uint8Array, options?: { truncate?, encoding? }): string
 * - compare(fingerprint1: string, fingerprint2: string): boolean
 * - toQRData(fingerprint: string, metadata?: { peerId?, nickname? }): string
 * - fromQRData(data: string): { fingerprint, peerId?, nickname?, isValid }
 * - formatForDisplay(fingerprint: string, options?: { chunkSize?, separator? }): string
 * - parse(formatted: string): string
 * - validate(fingerprint: string): boolean
 */
```

#### `keys/KeyManager.js` (Enhanced for Dual Keys)
```javascript
/**
 * KeyManager - Extended for Dual Key Pairs
 *
 * Manages both X25519 (encryption) and Ed25519 (signing) key pairs
 * for a mesh node identity.
 *
 * Additional Requirements:
 * - Manage separate key pairs for encryption and signing
 * - Support atomic generation of both key pairs
 * - Unified identity export/import including both key pairs
 *
 * Additional Exports:
 * - getSigningKeyPair(): SigningKeyPair
 * - getFullIdentity(): { encryptionPublicKey, signingPublicKey,
 *     encryptionSecretKey, signingSecretKey }
 * - importFullIdentity(identity): void
 * - signMessage(message: Uint8Array): Uint8Array
 * - verifyMessage(publicKey, message, signature): boolean
 */
```

---

### 3. Protocol Module (`src/protocol/`)

#### Optimized Message Header Format (24-32 bytes)

Reduced from 48 bytes for BLE efficiency. Uses 8-byte truncated peer IDs.

```
Offset  Size  Field           Description
------  ----  -----           -----------
0       1     version         Protocol version (1-255)
1       1     type            Message type (see MESSAGE_TYPE)
2       1     flags           Bit flags (hasRecipient, hasSignature, isCompressed, etc.)
3       1     ttl             High nibble: hopCount, Low nibble: maxHops
4       8     timestamp       Milliseconds since Unix epoch (big-endian)
12      2     payloadLength   Payload size in bytes (big-endian, max 65535)
14      1     fragmentIndex   Fragment index (0-255, 0 if not fragmented)
15      1     fragmentTotal   Total fragments (1-255, 1 if not fragmented)
16      8     senderId        Truncated sender peer ID (8 bytes)
24      8     recipientId     Truncated recipient ID (only if hasRecipient flag)
```

**TTL Encoding:**
```javascript
// Encode: hopCount (0-15), maxHops (1-15)
ttl = (hopCount << 4) | (maxHops & 0x0F)

// Decode:
hopCount = (ttl >> 4) & 0x0F
maxHops = ttl & 0x0F
```

#### `header.js`
```javascript
/**
 * Optimized Message Header
 *
 * Requirements:
 * - 24-byte base header, 32 bytes with recipient
 * - Big-endian encoding for multi-byte integers
 * - Truncated 8-byte peer IDs from public key hash
 * - Combined TTL field (hopCount + maxHops)
 * - Flags byte for optional features
 *
 * Exports:
 * - HEADER_SIZE_BASE: number (24)
 * - HEADER_SIZE_EXTENDED: number (32)
 * - class Header { version, type, flags, hopCount, maxHops, timestamp,
 *     payloadLength, fragmentIndex, fragmentTotal, senderId, recipientId? }
 * - class HeaderFlags { hasRecipient, hasSignature, isCompressed, isEncrypted,
 *     isAck, requiresAck, toByte(), static fromByte() }
 * - serializeHeader(header: Header): Uint8Array
 * - deserializeHeader(data: Uint8Array): Header
 * - truncatePeerId(publicKey: Uint8Array): Uint8Array (8 bytes)
 * - encodeTTL(hopCount, maxHops): number
 * - decodeTTL(ttl): { hopCount, maxHops }
 */
```

#### `serializer.js` (Enhanced with Compression)
```javascript
/**
 * Message Serialization with Compression Support
 *
 * Serialization order:
 * 1. Serialize payload to bytes
 * 2. If compression enabled and payload > threshold: compress and set flag
 * 3. If encryption enabled: encrypt (after compression)
 * 4. Build header with appropriate flags
 * 5. Combine header + payload
 *
 * Requirements:
 * - Efficient binary serialization
 * - Big-endian for multi-byte integers
 * - Optional LZ4 compression
 * - Optional AEAD encryption
 *
 * Exports:
 * - serialize(message: Message, options?: { compress?, encrypt?, encryptionKey? }): Uint8Array
 * - serializeHeader(header: Header): Uint8Array
 */
```

#### `deserializer.js` (Enhanced with Decompression)
```javascript
/**
 * Message Deserialization with Decompression Support
 *
 * Deserialization order:
 * 1. Parse header
 * 2. Extract payload bytes
 * 3. If ENCRYPTED flag: decrypt
 * 4. If COMPRESSED flag: decompress
 * 5. Deserialize payload
 *
 * Exports:
 * - deserialize(data: Uint8Array, options?: { decryptionKey?, maxDecompressedSize? }): Message
 * - deserializeHeader(data: Uint8Array): Header
 */
```

#### `padding.js````javascript
/**
 * Packet Padding for Traffic Analysis Resistance
 *
 * Implements PKCS#7-style padding to fixed block sizes.
 * All messages are padded to one of: 256, 512, 1024, 2048 bytes.
 *
 * Requirements:
 * - Select smallest block size that fits data + minimum 1 byte padding
 * - PKCS#7 padding allows unambiguous unpadding
 * - Constant-time unpad operation
 * - Reject invalid padding during unpad
 *
 * Exports:
 * - BLOCK_SIZES: number[] ([256, 512, 1024, 2048])
 * - MAX_PADDED_SIZE: number (2048)
 * - pad(data: Uint8Array, blockSizes?: number[]): Uint8Array
 * - unpad(data: Uint8Array): Uint8Array
 * - selectBlockSize(dataLength: number, blockSizes?: number[]): number
 * - getPaddingLength(dataLength: number, blockSize: number): number
 */
```

#### `VersionNegotiator.js````javascript
/**
 * Protocol Version Negotiator
 *
 * Handles protocol version negotiation between peers for backward compatibility.
 *
 * Negotiation flow:
 * 1. Initiator sends VERSION_HELLO with supported versions
 * 2. Responder selects highest mutually supported version
 * 3. Responder sends VERSION_ACK with selected version
 * 4. Both peers proceed with handshake using agreed version
 *
 * Requirements:
 * - Support protocol versions 1-255
 * - Maximum 32 versions in hello message
 * - Prefer higher versions
 * - Handle version mismatch gracefully
 *
 * Exports:
 * - CURRENT_VERSION: number
 * - SUPPORTED_VERSIONS: number[]
 * - class VersionNegotiator
 *   - constructor(supportedVersions?: number[])
 *   - getSupportedVersions(): number[]
 *   - isVersionSupported(version: number): boolean
 *   - getPreferredVersion(): number
 *   - negotiate(remoteVersions: number[]): number | null
 *   - createHelloMessage(): Uint8Array
 *   - createAckMessage(selectedVersion: number): Uint8Array
 *   - createRejectMessage(reason?: string): Uint8Array
 *   - parseHelloMessage(data: Uint8Array): number[]
 *   - parseAckMessage(data: Uint8Array): { version, features }
 *   - getNegotiatedVersion(): number | null
 *   - isNegotiationComplete(): boolean
 */
```

#### `IdentityAnnouncement.js````javascript
/**
 * Identity Announcement Protocol
 *
 * Handles creation, serialization, and verification of identity announcements.
 * Allows peers to broadcast identity with cryptographic signatures.
 *
 * Wire format:
 * - peerId: 32 bytes
 * - publicKey: 32 bytes
 * - nicknameLength: 1 byte
 * - nickname: variable (UTF-8, max 64 bytes)
 * - hasPreviousId: 1 byte (0 or 1)
 * - previousPeerId: 32 bytes (optional)
 * - timestamp: 8 bytes
 * - signature: 64 bytes (Ed25519)
 *
 * Exports:
 * - create(options: { peerId, publicKey, nickname?, previousPeerId?, secretKey }): IdentityAnnouncement
 * - sign(announcement: IdentityAnnouncement, secretKey: Uint8Array): Uint8Array
 * - verify(announcement: IdentityAnnouncement): boolean
 * - serialize(announcement: IdentityAnnouncement): Uint8Array
 * - deserialize(data: Uint8Array): IdentityAnnouncement
 * - validate(announcement: IdentityAnnouncement): { isValid, errors }
 */
```

---

### 4. Mesh Module (`src/mesh/`)

#### `router/MessageRouter.js`
```javascript
/**
 * Message Router
 * 
 * Responsibilities:
 * - Process incoming messages
 * - Route to local handlers or relay
 * - Manage routing table
 * - Handle duplicate detection
 * - Emit events for received messages
 * 
 * Requirements:
 * - O(1) duplicate detection with Bloom filter
 * - LRU cache for recent messages (backup check)
 * - Increment hop count on relay
 * - Recalculate checksum after hop count change
 * - Drop expired messages
 * - Drop messages exceeding max hops
 * 
 * Exports:
 * - class MessageRouter extends EventEmitter
 *   - constructor(options: { localPeerId })
 *   - processIncoming(data, sourcePeerId): Message | null
 *   - send(options): string (messageId)
 *   - registerPeer(peerId, connection): void
 *   - unregisterPeer(peerId): void
 *   - getStats(): RouterStats
 */
```

#### `dedup/BloomFilter.js`
```javascript
/**
 * Bloom Filter for Duplicate Detection
 * 
 * Requirements:
 * - Configurable size and hash count
 * - FNV-1a based hash functions
 * - Support for clearing (periodic reset)
 * - Memory-efficient (bit array)
 * 
 * Exports:
 * - class BloomFilter
 *   - constructor(size, hashCount)
 *   - add(item: string | Uint8Array): void
 *   - mightContain(item): boolean
 *   - clear(): void
 */
```

#### `fragment/Fragmenter.js` (Enhanced with Typed Fragments)
```javascript
/**
 * Enhanced Message Fragmenter
 *
 * Splits large messages into typed fragments:
 * - FRAGMENT_START: Contains metadata (totalSize, fragmentCount, checksum), first chunk
 * - FRAGMENT_CONTINUE: Intermediate chunks with index
 * - FRAGMENT_END: Final chunk, triggers reassembly
 *
 * Requirements:
 * - Generate unique messageId for fragment set
 * - Calculate CRC16 of original payload
 * - Split payload into MTU-sized chunks
 * - Add appropriate fragment headers
 *
 * Exports:
 * - fragment(payload: Uint8Array, options: { maxFragmentSize, messageId? }): Fragment[]
 * - needsFragmentation(payloadSize: number, maxSize: number): boolean
 * - calculateFragmentCount(payloadSize: number, maxFragmentSize: number): number
 * - class Fragment { type, messageId, index, payload, totalSize?, fragmentCount?, checksum? }
 */
```

#### `fragment/Assembler.js` (Enhanced)
```javascript
/**
 * Enhanced Fragment Assembler
 *
 * Reassembles typed fragments into complete messages.
 * Uses explicit fragment types for state management.
 *
 * State transitions per messageId:
 *   AWAITING_START -> ASSEMBLING -> COMPLETE
 *                          |
 *                          v
 *                       TIMEOUT
 *
 * Requirements:
 * - Track pending fragment sets by messageId
 * - Validate fragment sequence
 * - Handle out-of-order CONTINUE fragments
 * - Require START before accepting other fragments
 * - Complete assembly on END receipt (if all fragments present)
 * - Verify CRC16 on completion
 * - Timeout incomplete sets
 *
 * Exports:
 * - class Assembler extends EventEmitter
 *   - constructor(options: { timeout?, maxPendingSets? })
 *   - addFragment(fragment: Fragment): { complete: boolean, payload?: Uint8Array, error?: string }
 *   - handleStart(fragment): void
 *   - handleContinue(fragment): void
 *   - handleEnd(fragment): Uint8Array | null
 *   - cleanup(): number
 *   - abort(messageId: Uint8Array): boolean
 *   - getPendingCount(): number
 *   - getPendingInfo(): PendingSetInfo[]
 *   - Events: 'complete', 'timeout', 'error'
 */
```

#### `peer/Peer.js` (Enhanced with Trust Fields)
```javascript
/**
 * Peer Class - Extended with Trust and Identity Fields
 *
 * Represents a remote peer with full identity and trust information.
 *
 * Connection States:
 *   DISCONNECTED -> CONNECTING -> CONNECTED -> SECURED
 *                                    |
 *                                    v
 *                                  FAILED
 *
 * Fields:
 * - id: string
 * - publicKey: Uint8Array | null
 * - connectionState: ConnectionState
 * - rssi: number
 * - lastSeen: number
 * - createdAt: number
 * - fingerprint: string | null * - verificationStatus: VerificationStatus * - isFavorite: boolean * - isBlocked: boolean * - nickname: string | null * - lastIdentityUpdate: number | null *
 * Exports:
 * - class Peer
 *   - constructor(options)
 *   - getFingerprint(): string | null
 *   - setPublicKey(publicKey: Uint8Array): void
 *   - updateFromIdentityAnnouncement(announcement): void
 *   - isSecure(): boolean
 *   - isConnected(): boolean
 *   - getDisplayName(): string
 *   - toJSON(): PeerJSON
 *   - static fromJSON(json): Peer
 * - CONNECTION_STATE: { DISCONNECTED, CONNECTING, CONNECTED, SECURED, FAILED }
 */
```

#### `peer/PeerManager.js`
```javascript
/**
 * Peer Manager
 *
 * Requirements:
 * - Track all known peers
 * - Manage peer lifecycle states
 * - Handle blocked peers
 * - Emit peer events
 * - Periodic cleanup of stale peers
 *
 * Exports:
 * - class PeerManager extends EventEmitter
 *   - addPeer(info): Peer
 *   - getPeer(id): Peer | undefined
 *   - getAllPeers(): Peer[]
 *   - getConnectedPeers(): Peer[]
 *   - updateConnectionState(id, state): void
 *   - markSecured(id): void
 *   - removePeer(id): void
 *   - blockPeer(id): void
 *   - unblockPeer(id): void
 *   - cleanup(maxAge): void
 */
```

#### `peer/TrustManager.js````javascript
/**
 * Social Trust Layer Manager
 *
 * Manages peer verification status, favorites, and blocked peers.
 * Provides foundation for building trust relationships in the mesh network.
 *
 * Verification States:
 * - UNVERIFIED: Default state, peer identity not confirmed
 * - VERIFIED: User has verified peer's fingerprint out-of-band
 * - COMPROMISED: Fingerprint mismatch detected (potential MITM)
 *
 * Requirements:
 * - Track verification status for each peer
 * - Support manual verification via fingerprint comparison
 * - Maintain favorites list for priority routing/display
 * - Block list for spam/abuse prevention
 * - Persist trust data to storage
 * - Emit events for trust state changes
 * - Detect potential key compromise (fingerprint mismatch)
 *
 * Events:
 * - 'verified': { peerId, fingerprint, verifiedAt }
 * - 'unverified': { peerId, reason }
 * - 'compromised': { peerId, expectedFingerprint, actualFingerprint }
 * - 'favoriteAdded': { peerId }
 * - 'favoriteRemoved': { peerId }
 * - 'blocked': { peerId, reason? }
 * - 'unblocked': { peerId }
 *
 * Exports:
 * - VERIFICATION_STATUS: { UNVERIFIED, VERIFIED, COMPROMISED }
 * - TRUST_LEVEL: { BLOCKED, UNKNOWN, UNVERIFIED, VERIFIED, FAVORITE }
 * - class TrustManager extends EventEmitter
 *   - constructor(options?: { storage?, storageKey?, autoSave? })
 *   - initialize(): Promise<void>
 *   - save(): Promise<void>
 *   - destroy(): void
 *   // Verification
 *   - setVerified(peerId: string, fingerprint: string): void
 *   - setUnverified(peerId: string, reason?: string): void
 *   - checkFingerprint(peerId: string, fingerprint: string): VerificationResult
 *   - getVerificationStatus(peerId: string): VerificationStatus
 *   - isVerified(peerId: string): boolean
 *   - getVerifiedPeers(): TrustRecord[]
 *   // Trust queries
 *   - isTrusted(peerId: string): boolean
 *   - getTrustLevel(peerId: string): TrustLevel
 *   - getTrustRecord(peerId: string): TrustRecord | undefined
 *   // Favorites
 *   - addFavorite(peerId: string): void
 *   - removeFavorite(peerId: string): void
 *   - isFavorite(peerId: string): boolean
 *   - getFavorites(): string[]
 *   // Blocking
 *   - block(peerId: string, reason?: string): void
 *   - unblock(peerId: string): void
 *   - isBlocked(peerId: string): boolean
 *   - getBlockedPeers(): BlockRecord[]
 *   // Bulk operations
 *   - exportTrustData(): TrustExport
 *   - importTrustData(data: TrustExport): ImportResult
 *   - clearAllTrustData(): void
 */
```

---

### 5. Service Module (`src/service/`)

#### `MeshService.js` (Enhanced)
```javascript
/**
 * Main Mesh Service - Orchestrator (Enhanced)
 *
 * Responsibilities:
 * - Lifecycle management (init, start, stop, destroy)
 * - Component coordination
 * - Public API surface
 * - Event aggregation and forwarding
 * - Trust management integration
 * - Read receipts and message retry
 * - Compression and power mode management
 *
 * State Machine:
 *   UNINITIALIZED -> INITIALIZING -> READY -> ACTIVE -> SUSPENDED -> DESTROYED
 *                                      \-> ERROR
 *
 * Exports:
 * - class MeshService extends EventEmitter
 *
 *   // Lifecycle
 *   - initialize(options?): Promise<void>
 *   - start(transport): Promise<void>
 *   - stop(): Promise<void>
 *   - destroy(): Promise<void>
 *
 *   // Identity
 *   - getIdentity(): { publicKey, signingPublicKey, displayName, fingerprint }
 *   - setDisplayName(name): void
 *   - exportIdentity(): { encryptionKey, signingKey }
 *   - importIdentity(identity): void
 *   - getFingerprint(): string
 *   - announceIdentity(): void
 *
 *   // Peers
 *   - getPeers(): Peer[]
 *   - getPeer(id): Peer | undefined
 *   - initiateHandshake(peerId): Promise<void>
 *   - blockPeer(id): void
 *   - unblockPeer(id): void
 *
 *   // Trust *   - verifyPeer(peerId: string, fingerprint: string): void
 *   - unverifyPeer(peerId: string): void
 *   - addFavorite(peerId: string): void
 *   - removeFavorite(peerId: string): void
 *   - getVerifiedPeers(): Peer[]
 *   - getFavoritePeers(): Peer[]
 *
 *   // Messaging
 *   - sendBroadcast(content, options?): string
 *   - sendPrivateMessage(peerId, content, options?): Promise<string>
 *   - sendChannelMessage(channelId, content, options?): string
 *
 *   // Read Receipts *   - sendReadReceipt(messageIds: string[]): void
 *   - markMessageRead(messageId: string): void
 *   - getUnreadMessages(): Message[]
 *
 *   // Power Management *   - setPowerMode(mode: PowerMode): void
 *   - getPowerMode(): PowerMode
 *   - setAutoPowerAdjust(enabled: boolean): void
 *
 *   // Status
 *   - getStatus(): MeshStatus
 *   - getState(): MeshState
 *   - getStats(): DetailedStats
 *
 *   // Events *   - 'read-receipt': { messageIds, fromPeerId, timestamp }
 *   - 'message-delivered': { messageId, peerId, timestamp }
 *   - 'message-failed': { messageId, peerId, error }
 *   - 'identity-announced': { peerId, fingerprint, nickname }
 *   - 'peer-verified': { peerId, fingerprint }
 *   - 'peer-compromised': { peerId, expected, actual }
 */
```

#### `HandshakeRateLimiter.js````javascript
/**
 * Handshake Rate Limiter for DoS Protection
 *
 * Protects against handshake flooding attacks by limiting the rate
 * of handshake attempts from individual peers.
 *
 * Algorithm:
 * - Track handshake attempts per peer in sliding time window
 * - Block peers exceeding threshold for configurable duration
 * - Auto-cleanup of stale tracking data
 * - Support for manual unblock
 *
 * Default configuration:
 * - maxAttempts: 5 per minute
 * - blockDuration: 5 minutes
 * - maxTrackedPeers: 10000 (LRU)
 *
 * Requirements:
 * - O(1) check and record operations
 * - Memory-bounded peer tracking
 * - Automatic cleanup of expired blocks
 * - Event emission for blocks/unblocks
 *
 * Exports:
 * - class HandshakeRateLimiter extends EventEmitter
 *   - constructor(options?: { maxAttempts?, windowMs?, blockDurationMs?, maxTrackedPeers? })
 *   - checkAllowed(peerId: string): boolean
 *   - recordAttempt(peerId: string): void
 *   - checkAndRecord(peerId: string): { allowed: boolean, reason?: string }
 *   - block(peerId: string, duration?: number, reason?: string): void
 *   - unblock(peerId: string): void
 *   - isBlocked(peerId: string): boolean
 *   - getBlockExpiry(peerId: string): number | null
 *   - getAttemptCount(peerId: string): number
 *   - getBlockedPeers(): BlockedPeerInfo[]
 *   - cleanup(): number
 *   - reset(): void
 *   - getStats(): RateLimiterStats
 *   - Events: 'blocked', 'unblocked', 'attempt-recorded'
 */
```

#### `SessionPool.js````javascript
/**
 * Session Pool for Connection Management
 *
 * Manages a pool of encrypted sessions with peers for efficient
 * connection reuse and lifecycle management.
 *
 * Features:
 * - Session caching for connection reuse
 * - Idle session cleanup
 * - Lazy handshake initiation
 * - Maximum session limits
 * - LRU eviction when pool full
 *
 * Session lifecycle:
 *   CREATED -> HANDSHAKING -> ACTIVE -> IDLE -> EXPIRED
 *                                         |
 *                                         v
 *                                      EVICTED
 *
 * Requirements:
 * - O(1) session lookup by peer ID
 * - LRU eviction for memory management
 * - Configurable idle/absolute timeouts
 * - Automatic rekey integration
 * - Thread-safe session access
 *
 * Exports:
 * - class SessionPool extends EventEmitter
 *   - constructor(options?: { maxSessions?, idleTimeoutMs?, absoluteTimeoutMs?, lazyHandshake? })
 *   - getSession(peerId: string): NoiseSession | undefined
 *   - getOrCreateSession(peerId: string, createFn: () => Promise<NoiseSession>): Promise<NoiseSession>
 *   - addSession(peerId: string, session: NoiseSession): void
 *   - removeSession(peerId: string): boolean
 *   - hasSession(peerId: string): boolean
 *   - isSessionActive(peerId: string): boolean
 *   - touchSession(peerId: string): void
 *   - getAllSessions(): SessionInfo[]
 *   - getActiveSessions(): SessionInfo[]
 *   - getIdleSessions(): SessionInfo[]
 *   - cleanup(): number
 *   - evictOldest(): string | null
 *   - clear(): void
 *   - getStats(): PoolStats
 *   - Events: 'session-added', 'session-removed', 'session-evicted', 'session-expired'
 */
```

#### `MessageRetryService.js````javascript
/**
 * Automatic Message Retry Service
 *
 * Provides automatic retry functionality for failed message deliveries.
 * Implements exponential backoff with configurable limits.
 *
 * Retry strategy:
 * - Initial delay: 5 seconds
 * - Backoff multiplier: 2x
 * - Max delay: 60 seconds
 * - Max attempts: 3 (configurable)
 *
 * Features:
 * - Per-message retry tracking
 * - Exponential backoff with jitter
 * - Priority queue for retry scheduling
 * - Persistence of retry state (optional)
 * - Cancellation support
 *
 * Message states:
 *   PENDING -> SENDING -> SENT (success)
 *                 |
 *                 v
 *             RETRYING -> FAILED (max retries)
 *
 * Requirements:
 * - Track retry count and next retry time per message
 * - Respect acknowledgment receipts to stop retrying
 * - Support manual retry cancellation
 * - Emit events for retry lifecycle
 * - Memory-bounded queue with LRU eviction
 *
 * Exports:
 * - class MessageRetryService extends EventEmitter
 *   - constructor(options?: { maxRetries?, baseDelayMs?, maxDelayMs?, backoffMultiplier?,
 *       maxQueueSize?, storage?, persistState? })
 *   - schedule(message: RetryableMessage): string (retryId)
 *   - cancel(retryId: string): boolean
 *   - cancelAllForPeer(peerId: string): number
 *   - acknowledge(messageId: string): boolean
 *   - getRetryInfo(retryId: string): RetryInfo | undefined
 *   - getPendingRetries(): RetryInfo[]
 *   - getRetryCount(messageId: string): number
 *   - getNextRetryTime(messageId: string): number | null
 *   - isRetrying(messageId: string): boolean
 *   - pause(): void
 *   - resume(): void
 *   - clear(): void
 *   - getStats(): RetryStats
 *   - Events: 'retry-scheduled', 'retry-attempt', 'retry-success', 'retry-failed', 'retry-cancelled'
 *
 * Types:
 * - RetryableMessage { id, peerId, type, payload, priority?, metadata? }
 * - RetryInfo { id, messageId, peerId, attempts, nextRetryAt, state, error? }
 * - RetryStats { pending, succeeded, failed, cancelled, avgAttempts }
 */
```

#### `HandshakeManager.js` (Enhanced)
```javascript
/**
 * Handshake Manager (Enhanced)
 *
 * Orchestrates Noise Protocol handshakes with rate limiting and
 * version negotiation.
 *
 * Additional Requirements:
 * - Integrate HandshakeRateLimiter
 * - Support protocol version negotiation before handshake
 * - Track handshake timing metrics
 *
 * Additional Exports:
 * - setRateLimiter(limiter: HandshakeRateLimiter): void
 * - setVersionNegotiator(negotiator: VersionNegotiator): void
 * - getHandshakeMetrics(): HandshakeMetrics
 */
```

---

### 6. Utilities (`src/utils/`)

#### `bytes.js`
```javascript
/**
 * Byte Manipulation Utilities
 *
 * Exports:
 * - concat(...arrays): Uint8Array
 * - constantTimeEqual(a, b): boolean
 * - randomBytes(length): Uint8Array
 * - xor(a, b): Uint8Array
 * - fill(array, value): void
 * - copy(src, dst, dstOffset?, srcOffset?, srcEnd?): number
 */
```

#### `encoding.js`
```javascript
/**
 * Encoding Utilities
 *
 * Exports:
 * - bytesToHex(bytes): string
 * - hexToBytes(hex): Uint8Array
 * - bytesToBase64(bytes): string
 * - base64ToBytes(base64): Uint8Array
 * - bytesToBase32(bytes): string
 * - base32ToBytes(base32): Uint8Array
 * - bytesToUtf8(bytes): string
 * - utf8ToBytes(str): Uint8Array
 */
```

#### `peerId.js````javascript
/**
 * Optimized Peer ID Generation and Handling
 *
 * Generates 8-byte truncated peer IDs from full 32-byte public keys.
 * Uses first 8 bytes of SHA256 hash for collision-resistant truncation.
 *
 * Collision probability: ~1 in 2^64 for random keys
 *
 * Requirements:
 * - Deterministic: same public key always produces same peer ID
 * - Collision-resistant: extremely low probability of collisions
 * - Efficient: O(1) generation and comparison
 * - Reversible mapping maintained in lookup table
 *
 * Exports:
 * - PEER_ID_SIZE: number (8)
 * - FULL_KEY_SIZE: number (32)
 * - generate(publicKey: Uint8Array): Uint8Array
 * - generateHex(publicKey: Uint8Array): string
 * - fromHex(hex: string): Uint8Array
 * - toHex(peerId: Uint8Array): string
 * - equals(a: Uint8Array, b: Uint8Array): boolean
 * - isValid(peerId: Uint8Array | string): boolean
 * - class PeerIdRegistry
 *   - constructor(maxSize?: number)
 *   - register(publicKey: Uint8Array): Uint8Array
 *   - lookup(peerId: Uint8Array): Uint8Array | undefined
 *   - has(peerId: Uint8Array): boolean
 *   - remove(peerId: Uint8Array): boolean
 *   - clear(): void
 *   - size: number
 */
```

#### `compression.js````javascript
/**
 * LZ4 Block Compression
 *
 * Implements LZ4 block compression for efficient bandwidth usage.
 * LZ4 provides high compression/decompression speed with reasonable ratios.
 *
 * Algorithm: LZ4 Block Format (simplified)
 * - Hash table for finding matches
 * - Minimum match length: 4 bytes
 * - Maximum offset: 65535 bytes
 * - Token: 4 bits literal length + 4 bits match length
 *
 * Requirements:
 * - Pure JavaScript implementation (no native dependencies)
 * - Compress/decompress speeds optimized for mobile
 * - Safe bounds checking on decompression
 * - Maximum decompressed size limit for DoS protection
 *
 * Compression format:
 * [token][literal_length?][literals][offset][match_length?]...
 *
 * Exports:
 * - COMPRESSION_THRESHOLD: number (64 bytes)
 * - MAX_DECOMPRESSED_SIZE: number (65536 bytes)
 * - compress(data: Uint8Array): Uint8Array
 * - decompress(data: Uint8Array, maxSize?: number): Uint8Array
 * - compressIfBeneficial(data: Uint8Array, threshold?: number): { data: Uint8Array, compressed: boolean }
 * - getCompressionRatio(original: number, compressed: number): number
 * - isCompressed(data: Uint8Array): boolean (heuristic check)
 * - estimateCompressedSize(data: Uint8Array): number
 * - class CompressionStats
 *   - totalCompressed: number
 *   - totalDecompressed: number
 *   - compressionRatioAvg: number
 *   - bytsSaved: number
 */
```

#### `MessageBatcher.js````javascript
/**
 * Message Batching for Efficiency
 *
 * Batches multiple small messages into larger payloads to reduce
 * overhead from headers and BLE packet fragmentation.
 *
 * Batch format:
 * [count: 1 byte][msg1_len: 2 bytes][msg1][msg2_len: 2 bytes][msg2]...
 *
 * Requirements:
 * - Configurable max batch size (default 512 bytes)
 * - Configurable max batch delay (default 50ms)
 * - Configurable min/max messages per batch
 * - Automatic flush on timeout
 * - Priority support (high priority messages flush immediately)
 *
 * Exports:
 * - BATCH_HEADER_SIZE: number (4)
 * - MAX_BATCH_SIZE: number (512)
 * - MAX_BATCH_DELAY_MS: number (50)
 * - class MessageBatcher extends EventEmitter
 *   - constructor(options?: { maxBatchSize?, maxDelayMs?, maxMessages?, minMessages?, onBatch? })
 *   - add(message: Uint8Array, priority?: 'normal' | 'high'): void
 *   - flush(): Uint8Array | null
 *   - clear(): void
 *   - getPendingCount(): number
 *   - getPendingSize(): number
 *   - setMaxDelay(ms: number): void
 *   - pause(): void
 *   - resume(): void
 *   - destroy(): void
 *   - Events: 'batch', 'flush'
 *
 * - encodeBatch(messages: Uint8Array[]): Uint8Array
 * - decodeBatch(data: Uint8Array): Uint8Array[]
 * - canAddToBatch(currentSize: number, messageSize: number, maxSize?: number): boolean
 */
```

#### `LRUCache.js`
```javascript
/**
 * LRU Cache
 *
 * Exports:
 * - class LRUCache<K, V>
 *   - constructor(maxSize)
 *   - get(key): V | undefined
 *   - set(key, value): void
 *   - has(key): boolean
 *   - delete(key): boolean
 *   - clear(): void
 *   - size: number
 *   - keys(): K[]
 *   - values(): V[]
 *   - oldest(): { key: K, value: V } | undefined
 *   - newest(): { key: K, value: V } | undefined
 */
```

#### `RateLimiter.js`
```javascript
/**
 * Token Bucket Rate Limiter
 *
 * General-purpose rate limiter using token bucket algorithm.
 *
 * Exports:
 * - class RateLimiter
 *   - constructor(options: { tokensPerInterval, interval, maxBurst? })
 *   - tryConsume(tokens?: number): boolean
 *   - consume(tokens?: number): Promise<void>
 *   - getTokens(): number
 *   - reset(): void
 */
```

---

## Testing Requirements

### Test Categories

1. **Unit Tests** - Each module in isolation
2. **Integration Tests** - Module interactions
3. **Crypto Test Vectors** - RFC compliance
4. **Property-Based Tests** - For serialization
5. **Stress Tests** - Performance under load
6. **Security Tests** - Attack resistance7. **Compression Tests** - LZ4 correctness8. **Trust Layer Tests** - Verification workflows
### Crypto Test Vectors

Include test vectors from:
- FIPS 180-4 (SHA-256)
- RFC 7748 (X25519)
- RFC 8032 (Ed25519)- RFC 8439 (ChaCha20-Poly1305)
- Noise Protocol test vectors

### New Test Files

```javascript
// __tests__/crypto/ed25519.test.jsdescribe('Ed25519', () => {
  describe('generateSigningKeyPair()', () => {
    test('generates valid 32-byte public key', () => {});
    test('generates valid 64-byte secret key', () => {});
  });
  describe('sign()', () => {
    test('RFC 8032 test vector 1 (empty message)', () => {});
    test('RFC 8032 test vector 2 (1 byte)', () => {});
    test('RFC 8032 test vector 3 (2 bytes)', () => {});
    test('produces deterministic signatures', () => {});
  });
  describe('verify()', () => {
    test('verifies valid signature', () => {});
    test('rejects invalid signature', () => {});
    test('rejects modified message', () => {});
    test('rejects small-order public keys', () => {});
  });
});

// __tests__/crypto/replayProtection.test.jsdescribe('ReplayProtection', () => {
  test('accepts new nonces', () => {});
  test('rejects replayed nonces', () => {});
  test('rejects nonces before window', () => {});
  test('handles out-of-order within window', () => {});
  test('handles BigInt nonces correctly', () => {});
  test('export/restore preserves state', () => {});
});

// __tests__/protocol/padding.test.jsdescribe('Padding', () => {
  test('pads to 256 bytes for small messages', () => {});
  test('pads to 512 bytes for medium messages', () => {});
  test('pads to 1024 bytes for larger messages', () => {});
  test('unpads correctly', () => {});
  test('rejects invalid padding', () => {});
  test('constant-time unpad', () => {});
});

// __tests__/protocol/versionNegotiator.test.jsdescribe('VersionNegotiator', () => {
  test('negotiates highest common version', () => {});
  test('handles version mismatch', () => {});
  test('serializes/deserializes hello message', () => {});
  test('serializes/deserializes ack message', () => {});
});

// __tests__/mesh/trustManager.test.jsdescribe('TrustManager', () => {
  describe('verification', () => {
    test('marks peer as verified', () => {});
    test('detects fingerprint mismatch', () => {});
    test('emits compromised event on mismatch', () => {});
  });
  describe('favorites', () => {
    test('adds and removes favorites', () => {});
  });
  describe('blocking', () => {
    test('blocks and unblocks peers', () => {});
  });
  describe('persistence', () => {
    test('saves and loads trust data', () => {});
  });
});

// __tests__/service/messageRetry.test.jsdescribe('MessageRetryService', () => {
  test('schedules retry on failure', () => {});
  test('implements exponential backoff', () => {});
  test('stops on acknowledgment', () => {});
  test('fails after max retries', () => {});
  test('cancels retries correctly', () => {});
});

// __tests__/service/sessionPool.test.jsdescribe('SessionPool', () => {
  test('caches sessions by peer ID', () => {});
  test('evicts LRU on max size', () => {});
  test('expires idle sessions', () => {});
  test('handles concurrent access', () => {});
});

// __tests__/service/handshakeRateLimiter.test.jsdescribe('HandshakeRateLimiter', () => {
  test('allows under threshold', () => {});
  test('blocks after threshold', () => {});
  test('unblocks after duration', () => {});
  test('manual block/unblock', () => {});
});

// __tests__/utils/compression.test.jsdescribe('LZ4 Compression', () => {
  test('compresses and decompresses text', () => {});
  test('compresses and decompresses binary', () => {});
  test('handles incompressible data', () => {});
  test('enforces max decompressed size', () => {});
  test('matches known LZ4 test vectors', () => {});
});

// __tests__/utils/peerId.test.jsdescribe('Peer ID', () => {
  test('generates 8-byte ID from public key', () => {});
  test('same key produces same ID', () => {});
  test('registry maps ID to full key', () => {});
  test('validates ID format', () => {});
});

// __tests__/utils/messageBatcher.test.jsdescribe('MessageBatcher', () => {
  test('batches multiple messages', () => {});
  test('flushes on max size', () => {});
  test('flushes on timeout', () => {});
  test('encodes/decodes batch format', () => {});
  test('handles high priority flush', () => {});
});
```

### Example Test Structure

```javascript
// __tests__/crypto/sha256.test.js
describe('SHA256', () => {
  describe('hash()', () => {
    test('empty input produces correct hash', () => {});
    test('short input produces correct hash', () => {});
    test('long input produces correct hash', () => {});
    test('FIPS 180-4 test vector 1', () => {});
    test('FIPS 180-4 test vector 2', () => {});
  });
});

// __tests__/integration/handshake.test.js
describe('Noise XX Handshake', () => {
  test('complete handshake between two parties', () => {});
  test('encrypted communication after handshake', () => {});
  test('bidirectional encryption works', () => {});
  test('handshake timeout handling', () => {});
  test('invalid message rejection', () => {});
  test('session rekey after threshold', () => {});  test('replay attack detection', () => {});        test('rate limiting enforcement', () => {});    });

// __tests__/integration/compression.test.jsdescribe('End-to-end Compression', () => {
  test('compressed messages transmit correctly', () => {});
  test('compression flag set in header', () => {});
  test('uncompressed below threshold', () => {});
  test('mixed compressed/uncompressed stream', () => {});
});
```

---

## Error Handling

### Error Class Hierarchy

```
MeshError (base)
├── CryptoError
│   ├── KeyGenerationError
│   ├── EncryptionError
│   ├── DecryptionError
│   ├── SignatureError           Ed25519 signature failures
│   ├── ReplayError              Replay attack detected
│   └── NonceExhaustionError     Nonce space exhausted
├── ConnectionError
│   ├── ConnectionTimeoutError
│   ├── ConnectionLostError
│   └── RateLimitedError         Connection rate limited
├── HandshakeError
│   ├── HandshakeTimeoutError
│   ├── InvalidHandshakeStateError
│   └── HandshakeRateLimitedError Too many handshake attempts
├── MessageError
│   ├── MessageTooLargeError
│   ├── MessageExpiredError
│   ├── InvalidMessageFormatError
│   └── CompressionError         Compression/decompression failure
├── FragmentError                #│   ├── FragmentTimeoutError     # Fragment set timed out
│   ├── FragmentSequenceError    # Invalid fragment sequence
│   ├── FragmentChecksumError    # CRC mismatch on reassembly
│   └── FragmentLimitError       # Too many pending fragment sets
├── PaddingError                 #│   ├── InvalidPaddingError      # PKCS#7 padding invalid
│   └── MessageTooLargeForPaddingError
├── VersionError                 #│   ├── VersionMismatchError     # No compatible protocol version
│   ├── VersionNegotiationTimeoutError
│   └── UnsupportedVersionError
├── TrustError                   #│   ├── PeerNotVerifiedError     # Attempting operation on unverified peer
│   ├── PeerBlockedError         # Peer is blocked
│   ├── FingerprintMismatchError # Fingerprint changed (potential MITM)
│   └── IdentityVerificationError
├── RetryError                   #│   ├── MaxRetriesExceededError  # Message delivery failed after max retries
│   ├── RetryQueueFullError      # Retry queue at capacity
│   └── RetryCancelledError      # Retry was cancelled
└── ValidationError
    ├── InvalidPeerIdError       Invalid peer ID format
    └── InvalidFingerprintError  Invalid fingerprint format
```

### Error Properties

```javascript
class MeshError extends Error {
  code: string         // e.g., 'E_CRYPTO_001'
  category: string     // Error category (CRYPTO, CONNECTION, etc.)
  details: object      // Additional context
  timestamp: number    // When error occurred
  recoverable: boolean // Whether the error is recoverable

  toJSON(): object     // Serializable representation
  static fromJSON(json): MeshError
}
```

### Error Codes

```javascript
ERROR_CODES = {
  // Crypto errors (E_CRYPTO_xxx)
  E_CRYPTO_KEY_GEN: 'E_CRYPTO_001',
  E_CRYPTO_ENCRYPT: 'E_CRYPTO_002',
  E_CRYPTO_DECRYPT: 'E_CRYPTO_003',
  E_CRYPTO_SIGNATURE: 'E_CRYPTO_004',
  E_CRYPTO_REPLAY: 'E_CRYPTO_005',
  E_CRYPTO_NONCE: 'E_CRYPTO_006',

  // Connection errors (E_CONN_xxx)
  E_CONN_TIMEOUT: 'E_CONN_001',
  E_CONN_LOST: 'E_CONN_002',
  E_CONN_RATE_LIMIT: 'E_CONN_003',

  // Handshake errors (E_HAND_xxx)
  E_HAND_TIMEOUT: 'E_HAND_001',
  E_HAND_STATE: 'E_HAND_002',
  E_HAND_RATE_LIMIT: 'E_HAND_003',

  // Message errors (E_MSG_xxx)
  E_MSG_TOO_LARGE: 'E_MSG_001',
  E_MSG_EXPIRED: 'E_MSG_002',
  E_MSG_FORMAT: 'E_MSG_003',
  E_MSG_COMPRESS: 'E_MSG_004',

  // Fragment errors (E_FRAG_xxx)
  E_FRAG_TIMEOUT: 'E_FRAG_001',
  E_FRAG_SEQUENCE: 'E_FRAG_002',
  E_FRAG_CHECKSUM: 'E_FRAG_003',
  E_FRAG_LIMIT: 'E_FRAG_004',

  // Padding errors (E_PAD_xxx)
  E_PAD_INVALID: 'E_PAD_001',
  E_PAD_TOO_LARGE: 'E_PAD_002',

  // Version errors (E_VER_xxx)
  E_VER_MISMATCH: 'E_VER_001',
  E_VER_TIMEOUT: 'E_VER_002',
  E_VER_UNSUPPORTED: 'E_VER_003',

  // Trust errors (E_TRUST_xxx)
  E_TRUST_NOT_VERIFIED: 'E_TRUST_001',
  E_TRUST_BLOCKED: 'E_TRUST_002',
  E_TRUST_FINGERPRINT: 'E_TRUST_003',
  E_TRUST_IDENTITY: 'E_TRUST_004',

  // Retry errors (E_RETRY_xxx)
  E_RETRY_MAX: 'E_RETRY_001',
  E_RETRY_QUEUE_FULL: 'E_RETRY_002',
  E_RETRY_CANCELLED: 'E_RETRY_003',

  // Validation errors (E_VAL_xxx)
  E_VAL_PEER_ID: 'E_VAL_001',
  E_VAL_FINGERPRINT: 'E_VAL_002'
}
```

---

## Documentation Requirements

### API Documentation (docs/API.md)

- Complete API reference
- Code examples for each method
- Event documentation
- TypeScript type definitions

### Architecture Documentation (docs/ARCHITECTURE.md)

- System overview diagram
- Module dependency graph
- Data flow diagrams
- State machine diagrams

### Security Documentation (docs/SECURITY.md)

- Threat model
- Security properties provided
- Cryptographic choices and rationale
- Known limitations

### Protocol Documentation (docs/PROTOCOL.md)

- Wire format specification
- Message types and their purpose
- Handshake sequence diagram
- Routing algorithm description

---

## Package Configuration

### package.json

```json
{
  "name": "react-native-ble-mesh",
  "version": "1.0.0",
  "description": "Production-ready BLE Mesh Network with Noise Protocol security",
  "main": "src/index.js",
  "types": "src/index.d.ts",
  "engines": { "node": ">=18.0.0" },
  "scripts": {
    "test": "jest",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "docs": "jsdoc -c jsdoc.json",
    "validate": "npm run lint && npm test"
  }
}
```

### jest.config.js

```javascript
module.exports = {
  testEnvironment: 'node',
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80 }
  },
  collectCoverageFrom: ['src/**/*.js'],
  testMatch: ['**/__tests__/**/*.test.js']
};
```

---

## Implementation Order

Generate modules in this order to manage dependencies:

1. **Phase 1: Foundation**
   - `constants/protocol.js` (updated with new message types, flags)
   - `constants/ble.js` (updated with power modes)
   - `constants/crypto.js` (updated with Ed25519, replay, rekey, compression configs)
   - `constants/errors.js` (updated with new error codes)
   - `errors/*` (all error classes including new ones)
   - `utils/bytes.js`
   - `utils/encoding.js` (with Base32 support)
   - `utils/uuid.js`
   - `utils/time.js`
   - `utils/validation.js`
   - `utils/peerId.js` (8-byte peer IDs)
   - `utils/LRUCache.js`
   - `utils/RateLimiter.js`
   - `utils/EventEmitter.js`
   - `utils/retry.js`
   - `utils/compression.js` (LZ4)
   - `utils/MessageBatcher.js`
2. **Phase 2: Crypto Core**
   - `crypto/sha256.js`
   - `crypto/sha512.js` (needed for Ed25519)
   - `crypto/hmac.js`
   - `crypto/hkdf.js`
   - `crypto/x25519.js`
   - `crypto/ed25519.js` (signatures)
   - `crypto/chacha20.js`
   - `crypto/poly1305.js`
   - `crypto/aead.js`

3. **Phase 3: Crypto Advanced**
   - `crypto/noise/state.js`
   - `crypto/noise/handshake.js`
   - `crypto/noise/session.js` (with rekey support)
   - `crypto/noise/ReplayProtection.js`   - `crypto/keys/KeyPair.js`
   - `crypto/keys/SigningKeyPair.js`   - `crypto/keys/Fingerprint.js`   - `crypto/keys/KeyManager.js` (updated for dual keys)
   - `crypto/keys/SecureStorage.js`

4. **Phase 4: Protocol**
   - `protocol/header.js` (optimized 24-32 byte format)
   - `protocol/message.js`
   - `protocol/padding.js` (traffic analysis resistance)
   - `protocol/serializer.js` (with compression support)
   - `protocol/deserializer.js` (with decompression)
   - `protocol/validator.js`
   - `protocol/VersionNegotiator.js`   - `protocol/IdentityAnnouncement.js`
5. **Phase 5: Mesh**
   - `mesh/dedup/BloomFilter.js`
   - `mesh/dedup/MessageCache.js`
   - `mesh/fragment/Fragmenter.js` (enhanced with typed fragments)
   - `mesh/fragment/Assembler.js` (enhanced)
   - `mesh/peer/Peer.js` (with trust fields)
   - `mesh/peer/PeerManager.js`
   - `mesh/peer/PeerDiscovery.js`
   - `mesh/peer/TrustManager.js`   - `mesh/router/RouteTable.js`
   - `mesh/router/PathFinder.js`
   - `mesh/router/MessageRouter.js`

6. **Phase 6: Transport**
   - `transport/Transport.js`
   - `transport/MockTransport.js`
   - `transport/BLETransport.js` (with power modes)
   - `transport/adapters/RNBLEAdapter.js`
   - `transport/adapters/NodeBLEAdapter.js`

7. **Phase 7: Storage**
   - `storage/Storage.js`
   - `storage/MemoryStorage.js`
   - `storage/AsyncStorageAdapter.js`
   - `storage/MessageStore.js`

8. **Phase 8: Service**
   - `service/SessionManager.js`
   - `service/SessionPool.js`   - `service/HandshakeManager.js` (enhanced)
   - `service/HandshakeRateLimiter.js`   - `service/MessageRetryService.js`   - `service/ChannelManager.js`
   - `service/MeshService.js` (enhanced with trust, retry, compression)

9. **Phase 9: Tests**
   - Unit tests for each module
   - Crypto test vectors (SHA-256, X25519, Ed25519, ChaCha20-Poly1305)
   - Integration tests (handshake, messaging, compression)
   - Security tests (replay, rate limiting)
   - Test helpers

10. **Phase 10: Documentation**
    - API.md (with new APIs)
    - ARCHITECTURE.md (with new components)
    - SECURITY.md (with new security features)
    - PROTOCOL.md (with optimized header format)
    - README.md

---

## Quality Checklist

Before completion, verify:

### Code Quality
- [ ] All modules under 200 lines
- [ ] JSDoc on all public APIs
- [ ] No circular dependencies
- [ ] ESLint passes with no warnings
- [ ] No secrets in error messages
- [ ] All async operations have timeouts
- [ ] Proper cleanup in destroy methods
- [ ] Events properly typed and documented

### Crypto & Security
- [ ] All crypto test vectors pass (SHA-256, X25519, Ed25519, ChaCha20-Poly1305)
- [ ] RFC 8032 Ed25519 test vectors pass
- [ ] Constant-time comparisons used for security-sensitive operations
- [ ] Replay protection sliding window works correctly
- [ ] Session rekey triggers at configured thresholds
- [ ] Handshake rate limiting prevents DoS
- [ ] PKCS#7 padding validates correctly
- [ ] Fingerprint generation matches expected format

### Protocol
- [ ] Header serialization/deserialization roundtrips correctly
- [ ] Optimized header uses 24 bytes (32 with recipient)
- [ ] TTL encoding packs hopCount and maxHops correctly
- [ ] Fragment types (START/CONTINUE/END) work correctly
- [ ] Version negotiation selects highest common version
- [ ] Identity announcement signatures verify correctly

### Reliability
- [ ] Message retry implements exponential backoff
- [ ] Session pool evicts LRU correctly
- [ ] Read receipts aggregate within batch window
- [ ] Fragment assembly handles out-of-order delivery
- [ ] Trust manager persists/restores state correctly

### Performance
- [ ] LZ4 compression/decompression works correctly
- [ ] Compression only applied above threshold
- [ ] Message batching flushes on size and timeout
- [ ] Power modes apply correct scan/advertise intervals
- [ ] 8-byte peer IDs generate deterministically

### Testing
- [ ] Test coverage > 80% on all modules
- [ ] 100% test coverage on crypto modules
- [ ] Integration tests pass for handshake flow
- [ ] Integration tests pass for compression flow
- [ ] Security tests verify replay protection
- [ ] Security tests verify rate limiting

### Documentation
- [ ] API.md covers all public APIs including new features
- [ ] SECURITY.md documents threat model and mitigations
- [ ] PROTOCOL.md documents optimized wire format
- [ ] README.md includes quickstart with new features
