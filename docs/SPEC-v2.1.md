# react-native-ble-mesh v2.1 Feature Spec

## Overview
Five new features to make the library production-grade and competitive:
1. Wi-Fi Direct Transport
2. Expo Support  
3. File/Image Sharing
4. Native Crypto Integration
5. Connection Quality Indicator

---

## Feature 1: Wi-Fi Direct Transport

### Why
BLE has ~1Mbps throughput and ~100m range. Wi-Fi Direct offers ~250Mbps and ~200m. For file sharing and high-bandwidth scenarios, Wi-Fi Direct is essential. The library should auto-negotiate the best available transport.

### Design
- New `WiFiDirectTransport` extending `Transport` base class (same interface as `BLETransport`)
- New `WiFiDirectAdapter` for React Native (wraps `react-native-wifi-p2p`)
- `MultiTransport` — aggregates BLE + Wi-Fi Direct, auto-selects best for each message
  - BLE for discovery + small messages (<1KB)
  - Wi-Fi Direct for large payloads (files, images)
  - Automatic fallback if one transport fails

### Files
```
src/transport/WiFiDirectTransport.js      — Transport implementation
src/transport/MultiTransport.js           — Aggregator/auto-selector
src/transport/adapters/WiFiDirectAdapter.js — RN adapter (react-native-wifi-p2p)
__tests__/transport/WiFiDirectTransport.test.js
__tests__/transport/MultiTransport.test.js
```

### API
```js
import { MultiTransport, WiFiDirectTransport } from 'react-native-ble-mesh';

// Auto-select (recommended)
const mesh = new MeshNetwork({ 
  nickname: 'Alice',
  transport: 'auto' // BLE + Wi-Fi Direct
});

// Or explicit
const transport = new MultiTransport({
  transports: ['ble', 'wifi-direct'],
  preferWifiForSize: 1024, // Use Wi-Fi Direct for payloads >1KB
});
```

### Peer Dependencies
- `react-native-wifi-p2p` (optional — Wi-Fi Direct only works if installed)

---

## Feature 2: Expo Support

### Why
~40% of new React Native projects use Expo. Currently the library only works with bare RN (react-native-ble-plx requires native modules). Expo SDK 53+ supports config plugins.

### Design
- Expo config plugin for BLE permissions (iOS Info.plist + Android manifest)
- Auto-detect Expo vs bare RN at runtime
- Graceful degradation: if native BLE not available, warn clearly
- Support `expo-crypto` as crypto provider when available

### Files
```
app.plugin.js                             — Expo config plugin entry
src/expo/withBLEMesh.js                   — Config plugin (permissions, background modes)
src/transport/adapters/ExpoBLEAdapter.js  — Adapter using expo-ble (if/when available)
docs/EXPO.md                              — Setup guide for Expo users
__tests__/expo/configPlugin.test.js
```

### API
```json
// app.json
{
  "expo": {
    "plugins": [
      ["react-native-ble-mesh", {
        "bluetoothAlwaysPermission": "This app uses Bluetooth to chat with nearby devices",
        "backgroundModes": ["bluetooth-central", "bluetooth-peripheral"]
      }]
    ]
  }
}
```

### How It Works
- Config plugin modifies iOS `Info.plist` (NSBluetoothAlwaysUsageDescription, UIBackgroundModes)
- Config plugin modifies Android `AndroidManifest.xml` (BLUETOOTH_SCAN, BLUETOOTH_CONNECT, ACCESS_FINE_LOCATION)
- At runtime: `react-native-ble-plx` still needed via `expo prebuild` (dev client)

---

## Feature 3: File/Image Sharing

### Why
Text-only mesh is limiting. Users need to share photos, documents, and small files. The mesh's fragmentation system already handles large payloads — we just need a file abstraction layer.

### Design
- `FileManager` — handles chunking, progress, resume
- Files are fragmented, encrypted (if crypto provider available), and sent via the mesh
- Automatic transport selection: BLE for <50KB, Wi-Fi Direct for larger
- MIME type detection, thumbnail generation for images
- Progress events with percentage

### Files
```
src/service/file/FileManager.js           — File send/receive orchestration
src/service/file/FileChunker.js           — Splits files into mesh-compatible chunks
src/service/file/FileAssembler.js         — Reassembles received chunks
src/service/file/FileMessage.js           — File metadata message type
src/service/file/index.js
__tests__/service/file/FileManager.test.js
__tests__/service/file/FileChunker.test.js
```

### API
```js
const mesh = new MeshNetwork({ nickname: 'Alice' });
await mesh.start();

// Send a file
const transfer = await mesh.sendFile(peerId, {
  uri: 'file:///path/to/photo.jpg',  // or base64 data
  name: 'photo.jpg',
  mimeType: 'image/jpeg',
});

transfer.on('progress', ({ percent }) => console.log(`${percent}%`));
transfer.on('complete', ({ messageId }) => console.log('Sent!'));
transfer.on('error', (err) => console.error(err));

// Receive files
mesh.on('fileReceived', ({ from, file }) => {
  console.log(`${from} sent ${file.name} (${file.size} bytes)`);
  // file.data is Uint8Array
  // file.mimeType, file.name available
});

// Progress for incoming files
mesh.on('fileProgress', ({ from, name, percent }) => {
  console.log(`Receiving ${name}: ${percent}%`);
});
```

### Limits
- Max file size: 10MB (configurable)
- Supported: any binary data (images, docs, audio clips)
- Transfer timeout: 5 minutes (configurable)

---

## Feature 4: Native Crypto Integration

### Why
We removed the pure JS crypto in v2.0.0 (too slow). Now we add a proper crypto abstraction that delegates to fast native/WASM libraries.

### Design
- `CryptoProvider` interface — pluggable crypto backends
- Built-in providers:
  - `TweetNaClProvider` — uses `tweetnacl` (pure JS but optimized, works everywhere)
  - `QuickCryptoProvider` — uses `react-native-quick-crypto` (native speed)
  - `ExpoCryptoProvider` — uses `expo-crypto` for Expo projects
- Auto-detection: picks the best available provider at runtime
- Same operations: key generation, key exchange (X25519), AEAD encrypt/decrypt, hashing

### Files
```
src/crypto/CryptoProvider.js              — Abstract interface
src/crypto/providers/TweetNaClProvider.js  — tweetnacl backend
src/crypto/providers/QuickCryptoProvider.js — react-native-quick-crypto backend
src/crypto/providers/ExpoCryptoProvider.js  — expo-crypto backend
src/crypto/providers/index.js
src/crypto/AutoCrypto.js                  — Auto-detect best provider
src/crypto/index.js                       — Module entry
__tests__/crypto/CryptoProvider.test.js
__tests__/crypto/AutoCrypto.test.js
```

### API
```js
import { MeshNetwork } from 'react-native-ble-mesh';

// Auto-detect (recommended)
const mesh = new MeshNetwork({
  nickname: 'Alice',
  crypto: 'auto', // Picks best available provider
});

// Or explicit
import { TweetNaClProvider } from 'react-native-ble-mesh/crypto';
const mesh = new MeshNetwork({
  nickname: 'Alice',
  crypto: new TweetNaClProvider(),
});
```

### CryptoProvider Interface
```js
class CryptoProvider {
  generateKeyPair()          → { publicKey, secretKey }
  sharedSecret(sk, pk)       → Uint8Array(32)
  encrypt(key, nonce, pt, ad) → Uint8Array (ciphertext + tag)
  decrypt(key, nonce, ct, ad) → Uint8Array (plaintext)
  hash(data)                 → Uint8Array(32)
  randomBytes(n)             → Uint8Array(n)
}
```

### Peer Dependencies (all optional)
- `tweetnacl` — fallback, works everywhere
- `react-native-quick-crypto` — fastest on RN
- `expo-crypto` — for Expo projects

---

## Feature 5: Connection Quality Indicator

### Why
Users and apps need to know connection quality to adapt UI (show signal bars, warn about poor connections, switch transports).

### Design
- Extend `NetworkMonitor` with real-time quality metrics per peer
- Quality levels: EXCELLENT / GOOD / FAIR / POOR / DISCONNECTED
- Based on: RSSI, latency, packet loss, throughput
- Periodic quality probes (configurable interval)
- Events when quality changes

### Files
```
src/mesh/monitor/ConnectionQuality.js     — Quality calculator
src/mesh/monitor/QualityProbe.js          — Active probing
__tests__/mesh/monitor/ConnectionQuality.test.js
__tests__/mesh/monitor/QualityProbe.test.js
```

### API
```js
const mesh = new MeshNetwork({ nickname: 'Alice' });
await mesh.start();

// Get quality for a specific peer
const quality = mesh.getConnectionQuality(peerId);
// {
//   level: 'good',        // excellent|good|fair|poor|disconnected
//   rssi: -65,            // Signal strength (dBm)
//   latencyMs: 45,        // Round-trip latency
//   packetLoss: 0.02,     // 2% loss
//   throughputKbps: 120,  // Estimated throughput
//   transport: 'ble',     // Which transport is active
//   lastUpdated: 1708123456789,
// }

// Get quality for all peers
const allQuality = mesh.getAllConnectionQuality();

// Listen for quality changes
mesh.on('connectionQualityChanged', ({ peerId, quality }) => {
  if (quality.level === 'poor') {
    console.warn(`Connection to ${peerId} is degraded`);
  }
});

// Quality thresholds (customizable)
const mesh = new MeshNetwork({
  qualityConfig: {
    probeIntervalMs: 10000,  // Probe every 10s
    rssiThresholds: { excellent: -50, good: -70, fair: -85 },
    latencyThresholds: { excellent: 100, good: 300, fair: 1000 },
  }
});
```

### Quality Calculation
```
score = (rssiScore * 0.3) + (latencyScore * 0.3) + (packetLossScore * 0.25) + (throughputScore * 0.15)

EXCELLENT: score >= 0.8
GOOD:      score >= 0.6
FAIR:      score >= 0.4
POOR:      score < 0.4
```

---

## Implementation Order

| # | Feature | Complexity | Dependencies |
|---|---------|-----------|--------------|
| 1 | Connection Quality Indicator | Low | None — extends existing NetworkMonitor |
| 2 | Native Crypto Integration | Medium | None — pluggable providers |
| 3 | File/Image Sharing | Medium | Uses fragmentation + optionally crypto |
| 4 | Expo Support | Low | Config plugin, no runtime deps |
| 5 | Wi-Fi Direct Transport | High | New transport + MultiTransport aggregator |

---

## Testing Strategy
- Unit tests for every new module
- Integration tests for multi-transport scenarios
- Platform tests (iOS + Android) for each feature
- Mock providers for crypto/transport to test without native modules
- Target: maintain 0 test failures
