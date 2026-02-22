# Changelog


## [2.0.0] - 2026-02-22

### ⚠️ Breaking Changes

#### Crypto Module Removed
The entire `src/crypto/` module has been removed. This includes:
- X25519 key exchange (pure JavaScript BigInt implementation)
- ChaCha20-Poly1305 AEAD encryption/decryption
- SHA-256 hashing
- HMAC-SHA256 message authentication
- HKDF key derivation
- Poly1305 MAC
- Noise Protocol XX handshake (handshake, session, state)
- Key management (KeyManager, KeyPair, SecureStorage)

**Why:** The pure JavaScript BigInt crypto was a major performance bottleneck on mobile devices. X25519 key exchange took ~100ms+ per operation (vs ~1ms with native). This caused battery drain, UI thread blocking on Hermes/JSC, and made the library impractical for real-world mesh networks with frequent peer connections.

**Migration:** Replace with established, battle-tested libraries:
- [`tweetnacl`](https://npmjs.com/package/tweetnacl) — Lightweight, audited, pure JS (recommended for most cases)
- [`libsodium-wrappers`](https://npmjs.com/package/libsodium-wrappers) — Full NaCl API, WASM-accelerated
- [`react-native-quick-crypto`](https://npmjs.com/package/react-native-quick-crypto) — Native speed, drop-in Node.js crypto replacement for React Native

The `./crypto` package export has been removed. Crypto constants (`CRYPTO_CONFIG`, `NOISE_PROTOCOL_NAME`, `NOISE_HANDSHAKE_STATE`) are still available for protocol compatibility.

### Bug Fixes

- **MeshNetwork restart crash** — Calling `start()` after `stop()` threw "Service already initialized". The service tried to re-initialize on every start. Now correctly skips initialization if already initialized, allowing proper stop/start cycling.
- **MockTransport missing peer ID** — Creating a `MockTransport()` without `localPeerId` caused "localPeerId required" errors when linking two transports. Now auto-generates a unique ID if none provided.
- **BLE connection timer leak** — `BLETransport.connectToPeer()` created a timeout timer that was never cleared on successful connection, leaking memory over time. Now properly clears the timer on success.
- **Error message clarity** — All error classes (`MeshError`, `ValidationError`, `ConnectionError`, `CryptoError`, `HandshakeError`) now prefix messages with the error class name (e.g., `"ValidationError: Invalid type"` instead of just `"Invalid type"`). Makes error identification in catch blocks and logs much easier.

### Testing

All **344 tests passing, 0 failures**.

#### New Test Suites (7 added)
- **`__tests__/transport/BLETransport.test.js`** — Start/stop lifecycle, scanning, peer connection/disconnection, broadcast, timeout handling, power mode switching
- **`__tests__/transport/MockTransport.test.js`** — Auto-ID generation, linking, bidirectional message passing, peer simulation, message logging
- **`__tests__/mesh/MeshNetwork.unit.test.js`** — Constructor defaults, config merging (deep merge), validation (message text, peer ID), channel name normalization, lifecycle (start/stop/restart/destroy), status reporting
- **`__tests__/service/MeshService.test.js`** — Initialize/start/stop/destroy lifecycle, transport requirement, identity management, peer queries, broadcast messaging
- **`__tests__/service/BatteryOptimizer.test.js`** — Mode switching (HIGH_PERFORMANCE/BALANCED/LOW_POWER/AUTO), battery level updates, transport integration, destroy cleanup
- **`__tests__/platform/ios.test.js`** — BLE background mode, battery optimizer for iOS power management, MTU 185 fragmentation (BLE 4.2+), store-and-forward state restoration
- **`__tests__/platform/android.test.js`** — BLE permission denial handling, MTU 23 (BLE 4.0) and 512 (BLE 5.0) fragmentation, Doze mode with low-power settings, BLE bonding reconnection, LRU cache memory limits, BloomFilter false positive rate verification

#### Previously Failing Tests Fixed (10 → 0)
- Integration test: MeshNetwork restart after stop
- Integration test: MockTransport linking without explicit peer IDs
- Integration test: Message text validation error matching
- Integration test: Peer ID validation error matching
- Compression tests: ValidationError message matching (4 tests)
- StoreAndForward tests: ValidationError for invalid inputs (2 tests)

### Removed
- `src/crypto/` — All pure JS cryptographic implementations (see Breaking Changes)
- `__tests__/crypto/` — All crypto unit tests (aead, hkdf, hmac, noise, sha256, x25519)
- `__tests__/integration/handshake.test.js` — Noise Protocol handshake integration test
- `./crypto` export from `package.json` exports map

### Changed
- `jest.config.js` — Removed `jest-junit` reporter dependency (was causing test runner failures)
- Error base class now includes class name in message for all subclasses

---

## [1.1.1] - 2026-01-18

### Changed
- Complete README rewrite for maximum clarity and discoverability
- Simple language understandable by beginners
- Visual diagram showing message hopping concept
- Quick start reduced to 4 lines of code
- Added problem/solution value proposition table
- Enhanced badges (npm downloads, TypeScript, platform support)
- Step-by-step installation guide with numbered steps
- Multiple practical examples (chat, channels, battery, panic mode)
- Complete API reference in easy-to-scan tables
- Security explained in plain terms
- FAQ section for common questions
- Use cases list for different scenarios
- Added AI/Agent instructions documentation

### Fixed
- React hooks example now matches actual useMesh/useMessages/usePeers API
- Events section now lists all actual events emitted by MeshNetwork
- Corrected event payload structures to match implementation

---

## [1.1.0] - 2026-01-18

### Added

#### High-Level MeshNetwork API
- **MeshNetwork class**: Unified high-level API for BitChat-compatible mesh networking
- Simplified initialization with sensible defaults
- Event-driven architecture with typed events
- Full lifecycle management (start, stop, restart, destroy)
- Static property exports for constants (BatteryMode, PanicTrigger, HealthStatus)

#### Store & Forward Messaging
- **StoreAndForwardManager**: Automatic message caching for offline peers
- Configurable retention period (default 24 hours)
- Per-recipient message limits with automatic cleanup
- Automatic delivery when peers reconnect
- Events: `messageCached`, `messageDelivered`, `messageDeliveryFailed`

#### Network Health Monitoring
- **NetworkMonitor**: Real-time network health tracking
- Latency measurement with configurable probes
- Packet loss rate calculation
- Health status classification (GOOD/FAIR/POOR)
- Per-peer health tracking
- Events: `healthChanged`, `peerHealthChanged`

#### Battery Optimization
- **BatteryOptimizer**: Adaptive power management
- Battery modes: HIGH_PERFORMANCE, BALANCED, LOW_POWER, AUTO
- Automatic mode adjustment based on battery level
- Configurable thresholds for mode transitions
- Events: `modeChanged`, `recommendationChanged`

#### Emergency Manager / Panic Mode
- **EmergencyManager**: Rapid data wipe capability (<200ms target)
- Multiple panic triggers: TRIPLE_TAP, SHAKE, MANUAL
- Configurable data clearers with priority ordering
- Performance tracking with wipe time benchmarks
- Events: `panicEnabled`, `panicTriggered`, `dataWiped`

#### LZ4 Compression
- **MessageCompressor**: Pure JavaScript LZ4 implementation
- Automatic compression for payloads above threshold
- 40-60% bandwidth reduction for text messages
- Compression statistics tracking
- Knuth's multiplicative hash (2654435761) for optimal distribution

#### TypeScript Enhancements
- Comprehensive type definitions for all new modules
- Interfaces: `StoreAndForwardStats`, `NetworkMonitorStats`, `NodeHealth`, `BatteryOptimizerStats`, `EmergencyManagerStats`, `WipeResult`, `CompressionStats`, `MeshNetworkStatus`
- Full JSDoc documentation

### Changed
- Input validation now uses typed errors (`ValidationError`, `MeshError`) consistently
- Fixed average wipe time calculation to use proper running average formula
- Enhanced compression with proper final literals block handling

### Fixed
- LZ4 compression final token handling for data ending with unmatched literals
- Average wipe time calculation bug (was averaging incorrectly)
- Missing input validation in `broadcast()` and `sendDirect()` methods

### Testing
- Integration tests for full MeshNetwork lifecycle
- Performance benchmarks for panic wipe time (<200ms verification)
- Comprehensive unit tests for MessageCompressor
- Store and Forward delivery/caching tests
- Network Monitor health tracking tests

---

## [1.0.4] - 2026-01-18

### Changed
- Improved npm search visibility with enhanced keywords
- Updated package description

---

## [1.0.3] - 2026-01-18

### Changed
- Package configuration updates

---

## [1.0.2] - 2026-01-18

### Changed
- Minor fixes and improvements

---

## [1.0.1] - 2026-01-17

- Merge pull request #10 from suhailtajshaik/development (0380149)
- Added release CI-CD (f83bdad)
- Merge pull request #9 from suhailtajshaik/development (4cf7700)
- Added release CI-CD (7134c50)
- Added build fix (4501a88)
- Merge pull request #8 from suhailtajshaik/development (7b258be)
- Added build fix (f681f18)
- Merge pull request #7 from suhailtajshaik/development (1ad634b)
- Add GitHub Actions workflow for NPM publishing (9e77095)
- ci: add GitHub Actions for automated releases (cb2612b)
- Merge pull request #6 from suhailtajshaik/development (a8e9c5c)
- docs: add Bitchat inspiration credit to README (3aeeb67)
- Merge pull request #3 from suhailtajshaik/development (83584c0)
- chore: remove GitHub CI workflows (b8a2241)
- fix(ci): lower coverage thresholds to match current test coverage (1d2b9be)
- Added eslint fixes (8adc54b)
- Added Acknowledgments (de7cb7a)
- Merge pull request #2 from suhailtajshaik/development (78a0a8f)
- Code cleanup (c757c72)
- Merge pull request #1 from suhailtajshaik/project-improvement-recommendations-2M3j3 (064a3a4)


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

### [1.2.0] - Planned
- File transfer support
- Improved route optimization

### [1.3.0] - Planned
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

[2.0.0]: https://github.com/suhailtajshaik/react-native-ble-mesh/releases/tag/v2.0.0
[1.1.1]: https://github.com/suhailtajshaik/react-native-ble-mesh/releases/tag/v1.1.1
[1.1.0]: https://github.com/suhailtajshaik/react-native-ble-mesh/releases/tag/v1.1.0
[1.0.4]: https://github.com/suhailtajshaik/react-native-ble-mesh/releases/tag/v1.0.4
[1.0.3]: https://github.com/suhailtajshaik/react-native-ble-mesh/releases/tag/v1.0.3
[1.0.2]: https://github.com/suhailtajshaik/react-native-ble-mesh/releases/tag/v1.0.2
[1.0.1]: https://github.com/suhailtajshaik/react-native-ble-mesh/releases/tag/v1.0.1
[1.0.0]: https://github.com/suhailtajshaik/react-native-ble-mesh/releases/tag/v1.0.0
[0.1.0]: https://github.com/suhailtajshaik/react-native-ble-mesh/releases/tag/v0.1.0
