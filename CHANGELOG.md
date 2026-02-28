# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-02-28

Major release consolidating all features since v1.1.1. Replaces the slow pure-JS
crypto module with a pluggable native provider system, adds Wi-Fi Direct transport,
Expo support, file sharing, connection quality monitoring, and comprehensive
production-hardening fixes for real iOS/Android devices.

**433 tests passing across 23 test suites.**

### Breaking Changes

#### Pure JS Crypto Module Removed
The entire pure-JS `src/crypto/` module (X25519, ChaCha20-Poly1305, SHA-256, HMAC,
HKDF, Poly1305, Noise XX handshake, KeyManager/KeyPair/SecureStorage) has been
removed. X25519 key exchange took ~100ms+ per operation on mobile (vs ~1ms native),
causing battery drain and UI thread blocking.

**Migration:** The new pluggable crypto provider system replaces it automatically:
- [`tweetnacl`](https://npmjs.com/package/tweetnacl) — Lightweight, audited, pure JS (default fallback)
- [`react-native-quick-crypto`](https://npmjs.com/package/react-native-quick-crypto) — Native JSI speed (auto-preferred)
- [`expo-crypto`](https://npmjs.com/package/expo-crypto) + tweetnacl — For Expo projects (auto-detected)

The `./crypto` package.json export has been removed. Crypto constants
(`CRYPTO_CONFIG`, `NOISE_PROTOCOL_NAME`, `NOISE_HANDSHAKE_STATE`) remain for
protocol compatibility.

#### Crypto Standardized on XSalsa20-Poly1305
All three crypto providers now use `nacl.secretbox` (XSalsa20-Poly1305) with
24-byte nonces. Previously, QuickCryptoProvider used ChaCha20-Poly1305 with 12-byte
nonces, making cross-provider encrypted sessions incompatible. Sessions established
with one provider can now be decrypted by any other.

#### Handshake XOR Fallbacks Removed
The HandshakeManager no longer falls back to XOR-based "encryption" when tweetnacl
is unavailable. This was a security vulnerability — XOR provides no real encryption.
The handshake now requires a proper crypto provider or throws an explicit error.

### New Features

#### Wi-Fi Direct Transport
- **`WiFiDirectTransport`** — High-bandwidth transport (~250 Mbps, ~200 m range) via `react-native-wifi-p2p`
- **`MultiTransport`** — Aggregates BLE + Wi-Fi Direct behind a single interface
  - Auto-selects BLE for small messages (<1 KB), Wi-Fi Direct for large payloads
  - Automatic fallback if preferred transport fails
  - Strategies: `auto`, `ble-only`, `wifi-only`, `redundant`
- Peer dependency: `react-native-wifi-p2p` (optional)

#### Expo Support
- **Expo config plugin** (`app.plugin.js`) — automatically configures BLE permissions
  - iOS: `NSBluetoothAlwaysUsageDescription`, `UIBackgroundModes`
  - Android: `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `BLUETOOTH_ADVERTISE`, `ACCESS_FINE_LOCATION`
  - Usage: `["react-native-ble-mesh", { "bluetoothAlwaysPermission": "..." }]` in app.json
- Supports Expo SDK 53+ with config plugins / dev client

#### File & Image Sharing
- **`FileManager`** — Full file transfer orchestration over the mesh
  - Chunking with configurable size (default 4 KB) and max file size (default 10 MB)
  - Progress events: `fileSendProgress`, `fileReceiveProgress`, `fileReceived`
  - Concurrent transfer management (max 5 simultaneous)
  - Transfer timeouts (default 5 min) with automatic cancellation
  - `mesh.sendFile(peerId, { data, name, mimeType })` high-level API
  - Binary chunk protocol (3-4x smaller than JSON encoding)
  - Incoming offer validation (size limits, required fields, chunk count)
- **`FileChunker`** — Splits files into mesh-compatible chunks
- **`FileAssembler`** — Reassembles received chunks with out-of-order support and memory cleanup after assembly
- **`FileMessage`** — Transfer metadata with offer/chunk/complete protocol

#### Native Crypto Provider System
- **`CryptoProvider`** — Abstract interface for key gen, key exchange, AEAD, hashing, random bytes
- **`TweetNaClProvider`** — Uses `tweetnacl` (lightweight, audited, works everywhere)
- **`QuickCryptoProvider`** — Uses `react-native-quick-crypto` (native JSI speed)
- **`ExpoCryptoProvider`** — Uses `expo-crypto` + `tweetnacl` for Expo projects
- **`AutoCrypto.detectProvider()`** — Picks best available provider at runtime
  - Priority: quick-crypto > expo-crypto > tweetnacl
- Usage: `new MeshNetwork({ crypto: 'auto' })` or pass a provider instance

#### Connection Quality Indicator
- **`ConnectionQuality`** — Real-time per-peer connection quality tracking
  - Quality levels: `EXCELLENT`, `GOOD`, `FAIR`, `POOR`, `DISCONNECTED`
  - Metrics: RSSI, latency, packet loss, throughput, active transport
  - Weighted scoring: RSSI (30%) + latency (30%) + packet loss (25%) + throughput (15%)
  - Configurable thresholds, sample sizes, and update intervals
- `mesh.getConnectionQuality(peerId)` and `mesh.getAllConnectionQuality()`
- Event: `connectionQualityChanged` when a peer's quality level changes

#### iOS Background BLE
- **State restoration support** in `RNBLEAdapter` via `restoreIdentifier` option
  - Allows iOS to re-launch the app and restore BLE connections after termination
  - Automatically re-populates device map from restored state
- Guide: `docs/IOS-BACKGROUND-BLE.md`

#### Real Noise NN Handshake
- HandshakeManager now implements a real Noise NN handshake using crypto providers
  (X25519 ephemeral key exchange + XSalsa20-Poly1305 session encryption)
- SessionManager reconstructs functional encrypt/decrypt when importing sessions
- Session expiry: 24-hour max age and 1 million message count limit to prevent nonce exhaustion
- Handshake tie-breaking via public key comparison for simultaneous initiation

### Bug Fixes

#### Critical (Production Blockers)
- **BLE MTU-based write chunking** — BLE writes now respect per-peer MTU (negotiated up to 512 bytes). Previously, writes exceeding the default 20-byte MTU were silently truncated, corrupting every message longer than a few bytes.
- **BLE disconnect event wiring** — `RNBLEAdapter` and `NodeBLEAdapter` now notify the transport layer on device disconnection. Previously, disconnected peers remained in the connected-peers map indefinitely, causing sends to a dead connection.
- **BLE write queue serialization** — Per-peer write queue prevents concurrent BLE characteristic writes. Concurrent writes caused data corruption on iOS and "device busy" errors on Android.
- **Nonce size standardized to 24 bytes** — SessionManager was generating 12-byte nonces but XSalsa20-Poly1305 requires 24 bytes, causing every encrypted message to fail decryption.

#### High Severity
- **MeshNetwork start() crash** — Starting with BLETransport auto-detects the adapter or throws a helpful error instead of crashing on `undefined`.
- **Event listener leak** — `MeshNetwork.stop()` now removes fileManager and connectionQuality listeners added during `start()`.
- **Store-and-forward re-encryption** — Cached messages are now re-encrypted via `sendPrivateMessage` on delivery instead of sending stale ciphertext.
- **Channel message routing** — MeshService now correctly parses channelId from incoming payloads (JSON + length-prefix fallback).
- **Broadcast send** — `MeshService.sendBroadcast()` fallback now actually sends through transport instead of silently dropping.
- **EmergencyManager async wipe** — `_triggerPanic` is now properly async with error handling at call sites.
- **Handshake tie-breaking** — Simultaneous handshake initiation no longer causes both sides to fail; deterministic winner selected by public key comparison.
- **Session expiry** — Sessions now expire after 24 hours or 1M messages, preventing nonce reuse.
- **File transfer chunk timeout** — Each chunk has a 10-second send timeout; transfer aborts if peer disconnects mid-transfer.
- **Fragment assembly bounds check** — Rejects assembled payloads exceeding 500 KB to prevent memory exhaustion from malformed fragments.
- **BLE subscription cleanup** — Both BLE adapters now clean up characteristic subscriptions on disconnect.
- **Dedup after send** — Messages are now marked as seen in the dedup manager *after* successful send, not before, allowing retries on failure.
- **`_sendRaw` guard** — MeshService guards against sends after destroy, preventing "cannot read property of null" crashes.
- **React hook memory leak** — `useMessages` clears `messageIdRef` on unmount; `useMesh` uses `mountedRef` pattern to prevent post-unmount state updates.

#### Medium Severity
- **Hop count off-by-one** — MessageRouter used `>=` instead of `>` for max hops, dropping messages one hop early.
- **Broadcast relay flood** — Broadcast messages now respect TTL and limit relay to max 3 peers instead of flooding all connected peers exponentially.
- **Double-buffered bloom filter** — DedupManager now uses a 1-minute grace period when rotating bloom filters, preventing false-negative dedup during the rotation window.
- **Event name constants** — MeshNetwork uses `EVENTS.*` constants (colon format: `peer:connected`) instead of hardcoded strings.
- **Config merge** — `_mergeConfig` now includes `fileTransfer` and `qualityConfig` sections.
- **Safe `getStatus()`** — Returns safely before initialization instead of throwing on undefined.
- **StoreAndForward secure IDs** — Uses `randomBytes()` instead of `Math.random()` for message IDs.
- **BLE auto-scan** — BLETransport auto-starts scanning after `start()`.
- **Timer cleanup** — All `setInterval` timers (BatteryOptimizer, StoreAndForwardManager, NetworkMonitor, BroadcastManager) call `.unref()` to prevent blocking Node.js process exit.
- **AudioManager destroy** — Properly awaits `session.end()` using `Promise.all()`.
- **NetworkMonitor health check** — Health check timer callback now has try-catch error handling.
- **RouteTable eviction** — Cleans expired routes before evicting valid ones when table is full.
- **PeerManager cleanup** — Protects peers in `CONNECTING` state from stale-peer cleanup.
- **BroadcastManager dedup** — Auto-cleanup timer every 5 minutes prevents unbounded memory growth.
- **FileAssembler memory** — Clears internal chunk map after assembly to free memory.
- **SessionManager decrypt** — Throws `CryptoError` on decryption failure instead of returning silent null.

### Testing

**433 tests, 23 test suites, 0 failures.**

#### New Test Suites (13 added since v1.1.1)
- `BLETransport.test.js` — Lifecycle, scanning, connection, broadcast, timeout, power modes
- `MockTransport.test.js` — Auto-ID, linking, bidirectional messaging, peer simulation
- `MeshNetwork.unit.test.js` — Config, validation, lifecycle, status
- `MeshService.test.js` — Initialize, start, stop, destroy, identity, broadcast
- `BatteryOptimizer.test.js` — Mode switching, battery levels, transport integration
- `ios.test.js` — Background BLE, MTU 185 fragmentation, state restoration
- `android.test.js` — Permissions, MTU 23/512, Doze mode, bonding, bloom filter rates
- `ConnectionQuality.test.js` — Quality calculation, RSSI/latency/packet loss, timeouts
- `CryptoProvider.test.js` — Abstract interface, TweetNaCl provider, auto-detection
- `FileManager.test.js` — Chunking, assembly, send/receive flow, progress, cancellation
- `configPlugin.test.js` — iOS/Android permission injection, deduplication
- `WiFiDirectTransport.test.js` — Lifecycle, discovery, connection, send/broadcast
- `MultiTransport.test.js` — Auto strategy, fallback, peer merging, broadcast

### Removed
- `src/crypto/aead.js`, `chacha20.js`, `hkdf.js`, `hmac.js`, `poly1305.js`, `sha256.js`, `x25519.js` — Pure JS crypto
- `src/crypto/noise/` — Noise Protocol XX handshake, session, state
- `src/crypto/keys/` — KeyManager, KeyPair, SecureStorage
- `__tests__/crypto/aead.test.js`, `hkdf.test.js`, `hmac.test.js`, `noise.test.js`, `sha256.test.js`, `x25519.test.js`
- `__tests__/integration/handshake.test.js` — Noise XX integration test
- `./crypto` export from `package.json` exports map
- XOR-based encryption fallbacks in HandshakeManager

### Documentation
- `docs/SPEC-v2.1.md` — Full feature specification
- `docs/IOS-BACKGROUND-BLE.md` — iOS background BLE guide with workarounds
- `docs/OPTIMIZATION.md` — Performance optimization notes
- Complete README rewrite with file sharing, connection quality, Wi-Fi Direct, and Expo examples

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

### Fixed
- LZ4 compression final token handling for data ending with unmatched literals
- Average wipe time calculation bug (was averaging incorrectly)
- Missing input validation in `broadcast()` and `sendDirect()` methods

---

## [1.0.4] - 2026-01-18

### Changed
- Improved npm search visibility with enhanced keywords

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

### Added
- Release CI/CD with GitHub Actions
- Bitchat inspiration credit in README
- ESLint fixes and code cleanup

---

## [1.0.0] - 2024-01-01

### Added

#### Core Features
- **End-to-End Encryption**: Noise Protocol handshake with X25519 key exchange
- **AEAD Encryption**: Authenticated encryption for all private messages
- **Multi-Hop Routing**: Messages relay through intermediate peers (up to 7 hops)
- **Duplicate Detection**: Bloom filter + LRU cache for efficient deduplication
- **Message Fragmentation**: Large messages automatically split and reassembled

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
- LRU cache, rate limiter, retry with exponential backoff

---

[2.0.0]: https://github.com/suhailtajshaik/react-native-ble-mesh/releases/tag/v2.0.0
[1.1.1]: https://github.com/suhailtajshaik/react-native-ble-mesh/releases/tag/v1.1.1
[1.1.0]: https://github.com/suhailtajshaik/react-native-ble-mesh/releases/tag/v1.1.0
[1.0.4]: https://github.com/suhailtajshaik/react-native-ble-mesh/releases/tag/v1.0.4
[1.0.3]: https://github.com/suhailtajshaik/react-native-ble-mesh/releases/tag/v1.0.3
[1.0.2]: https://github.com/suhailtajshaik/react-native-ble-mesh/releases/tag/v1.0.2
[1.0.1]: https://github.com/suhailtajshaik/react-native-ble-mesh/releases/tag/v1.0.1
[1.0.0]: https://github.com/suhailtajshaik/react-native-ble-mesh/releases/tag/v1.0.0
