# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-01

### Added

#### Core Features
- **End-to-End Encryption**: Noise Protocol XX handshake with X25519 key exchange
- **ChaCha20-Poly1305 AEAD**: Authenticated encryption for all private messages
- **Multi-Hop Routing**: Messages relay through intermediate peers (up to 7 hops)
- **Duplicate Detection**: Bloom filter + LRU cache for efficient deduplication
- **Message Fragmentation**: Large messages automatically split and reassembled

#### Cryptographic Primitives
- Pure JavaScript SHA-256 implementation (FIPS 180-4)
- HMAC-SHA256 for message authentication (RFC 2104)
- HKDF for key derivation (RFC 5869)
- X25519 elliptic curve Diffie-Hellman (RFC 7748)
- ChaCha20 stream cipher (RFC 8439)
- Poly1305 MAC (RFC 8439)
- ChaCha20-Poly1305 AEAD (RFC 8439)

#### Noise Protocol
- Full Noise XX handshake pattern implementation
- Symmetric state management (MixHash, MixKey)
- Transport session with nonce management
- Forward secrecy through ephemeral keys
- Identity hiding (static keys encrypted)

#### Messaging
- Broadcast messages (unencrypted, reach all peers)
- Private messages (encrypted, point-to-point)
- Channel messages (group messaging with subscriptions)
- Message acknowledgments

#### Peer Management
- Peer discovery and connection tracking
- Peer lifecycle states (discovered, connected, secured)
- Peer blocking/unblocking
- Automatic stale peer cleanup

#### Transport Layer
- Abstract transport interface
- BLE transport implementation
- Mock transport for testing
- React Native BLE adapter (react-native-ble-plx)
- Node.js BLE adapter (noble)

#### Protocol
- Binary message format with 48-byte header
- CRC32 checksum for integrity
- Message types: TEXT, PRIVATE, CHANNEL, HANDSHAKE, CONTROL
- Message flags: ENCRYPTED, COMPRESSED, REQUIRES_ACK

#### Storage
- Abstract storage interface
- In-memory storage implementation
- AsyncStorage adapter for React Native
- Message persistence

#### Utilities
- Byte manipulation helpers
- Hex/Base64 encoding
- UUID generation
- EventEmitter with typed events
- LRU cache
- Rate limiter
- Retry with exponential backoff

### Security
- All crypto passes official RFC test vectors
- Constant-time comparison for authentication tags
- Secure key storage abstractions
- No secrets in logs or error messages
- Key zeroing after use

### Documentation
- Complete API reference
- Protocol specification
- Security documentation with threat model
- Architecture documentation

### Testing
- Unit tests for all crypto modules (100% coverage)
- Protocol serialization tests
- Mesh layer tests (BloomFilter, routing)
- Integration tests for handshake flow

## [0.1.0] - Initial Development

### Added
- Project structure and configuration
- Basic module scaffolding
- Initial test setup

---

## Roadmap

### [1.1.0] - Planned
- File transfer support
- Message queuing for offline peers
- Improved route optimization
- Compression support

### [1.2.0] - Planned
- Group key agreement
- Post-quantum key exchange option
- Message persistence with IndexedDB
- Web transport (WebRTC)

### [2.0.0] - Future
- TypeScript rewrite
- WASM crypto for performance
- Multiple transport support
- Mesh network visualization

---

[1.0.0]: https://github.com/anthropic/rn-ble-mesh/releases/tag/v1.0.0
[0.1.0]: https://github.com/anthropic/rn-ble-mesh/releases/tag/v0.1.0
