# react-native-ble-mesh

> Inspired by [Bitchat](https://github.com/permissionlesstech/bitchat) - this is the React Native version.

A **production-ready BLE Mesh Network library** for Node.js and React Native with Noise Protocol security. This library enables peer-to-peer communication over Bluetooth Low Energy with end-to-end encryption, multi-hop routing, and offline-first capabilities.

[![npm version](https://img.shields.io/npm/v/react-native-ble-mesh.svg)](https://www.npmjs.com/package/react-native-ble-mesh)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **End-to-End Encryption** - Noise Protocol XX handshake with ChaCha20-Poly1305 AEAD
- **Digital Signatures** - Ed25519 signatures for message authentication and identity verification
- **Multi-Hop Routing** - Messages can traverse multiple peers to reach their destination
- **Offline-First** - Works without internet connectivity using BLE
- **Forward Secrecy** - Automatic session rekeying for enhanced security
- **Replay Protection** - Sliding window algorithm prevents replay attacks
- **Traffic Analysis Resistance** - PKCS#7 padding to fixed block sizes
- **LZ4 Compression** - Efficient bandwidth usage for larger messages
- **Power Management** - Multiple power modes for battery optimization
- **Trust Management** - Peer verification, favorites, and blocking
- **Message Reliability** - Automatic retry with exponential backoff

## Use Cases

- Offline messaging apps (like Bridgefy, Briar)
- Disaster communication networks
- Privacy-focused P2P chat
- IoT mesh networks
- Gaming multiplayer over BLE

## Installation

```bash
npm install react-native-ble-mesh
```

### React Native

For React Native projects, you also need to install the BLE dependency:

```bash
npm install react-native-ble-plx
cd ios && pod install
```

### Node.js

For Node.js projects using Noble:

```bash
npm install @abandonware/noble
```

## Quick Start

### Basic Setup

```javascript
const { MeshService, BLETransport } = require('react-native-ble-mesh');

// Create and initialize the mesh service
const mesh = new MeshService();

async function start() {
  // Initialize with optional configuration
  await mesh.initialize({
    displayName: 'Alice',
    storage: null, // Use in-memory storage
  });

  // Create transport layer
  const transport = new BLETransport();

  // Start the mesh service
  await mesh.start(transport);

  console.log('Mesh network started!');
  console.log('My fingerprint:', mesh.getFingerprint());
}

start();
```

### Discovering Peers

```javascript
// Listen for peer discovery events
mesh.on('peer-discovered', (peer) => {
  console.log('Discovered peer:', peer.id);
  console.log('Display name:', peer.getDisplayName());
});

mesh.on('peer-connected', (peer) => {
  console.log('Connected to peer:', peer.id);
});

mesh.on('peer-secured', (peer) => {
  console.log('Secure session established with:', peer.id);
});
```

### Sending Messages

```javascript
// Send a broadcast message to all nearby peers
const broadcastId = mesh.sendBroadcast('Hello, mesh network!');

// Send a private encrypted message to a specific peer
const peerId = 'abc123...';
try {
  const messageId = await mesh.sendPrivateMessage(peerId, 'Hello, this is private!');
  console.log('Message sent:', messageId);
} catch (error) {
  console.error('Failed to send:', error.message);
}

// Send a message to a channel
const channelMessageId = mesh.sendChannelMessage('general', 'Hello channel!');
```

### Receiving Messages

```javascript
// Listen for incoming messages
mesh.on('message', (message) => {
  console.log('Received message:', message.content);
  console.log('From:', message.senderId);
  console.log('Type:', message.type);
});

// Listen for private messages specifically
mesh.on('private-message', (message) => {
  console.log('Private message from', message.senderId);
  console.log('Content:', message.content);
});

// Listen for channel messages
mesh.on('channel-message', (message) => {
  console.log('Channel:', message.channelId);
  console.log('Content:', message.content);
});
```

### Handling Acknowledgments and Read Receipts

```javascript
// Listen for message delivery confirmations
mesh.on('message-delivered', ({ messageId, peerId, timestamp }) => {
  console.log(`Message ${messageId} delivered to ${peerId}`);
});

// Listen for read receipts
mesh.on('read-receipt', ({ messageIds, fromPeerId, timestamp }) => {
  console.log(`Peer ${fromPeerId} read messages:`, messageIds);
});

// Send read receipts for messages you've read
mesh.sendReadReceipt(['msg-id-1', 'msg-id-2']);

// Mark a single message as read
mesh.markMessageRead('msg-id-1');
```

## API Reference

### MeshService

The main orchestrator for the mesh network.

#### Lifecycle Methods

```javascript
// Initialize the service
await mesh.initialize(options);

// Start with a transport
await mesh.start(transport);

// Stop the service
await mesh.stop();

// Clean up resources
await mesh.destroy();
```

#### Identity Management

```javascript
// Get your identity information
const identity = mesh.getIdentity();
// Returns: { publicKey, signingPublicKey, displayName, fingerprint }

// Set your display name
mesh.setDisplayName('Alice');

// Get your fingerprint for out-of-band verification
const fingerprint = mesh.getFingerprint();

// Export identity for backup
const exported = mesh.exportIdentity();

// Import identity from backup
mesh.importIdentity(exported);

// Announce identity to network
mesh.announceIdentity();
```

#### Peer Management

```javascript
// Get all known peers
const peers = mesh.getPeers();

// Get a specific peer
const peer = mesh.getPeer(peerId);

// Initiate secure handshake with a peer
await mesh.initiateHandshake(peerId);

// Block a peer
mesh.blockPeer(peerId);

// Unblock a peer
mesh.unblockPeer(peerId);
```

#### Trust Management

```javascript
// Verify a peer using their fingerprint
mesh.verifyPeer(peerId, fingerprint);

// Remove verification
mesh.unverifyPeer(peerId);

// Add to favorites
mesh.addFavorite(peerId);

// Remove from favorites
mesh.removeFavorite(peerId);

// Get verified peers
const verified = mesh.getVerifiedPeers();

// Get favorite peers
const favorites = mesh.getFavoritePeers();
```

#### Power Management

```javascript
// Available power modes: PERFORMANCE, BALANCED, POWER_SAVER, ULTRA_POWER_SAVER
mesh.setPowerMode('BALANCED');

// Get current power mode
const mode = mesh.getPowerMode();

// Enable automatic power adjustment based on battery level
mesh.setAutoPowerAdjust(true);
```

#### Status and Statistics

```javascript
// Get service status
const status = mesh.getStatus();

// Get current state
const state = mesh.getState();

// Get detailed statistics
const stats = mesh.getStats();
```

### Events

| Event | Description | Payload |
|-------|-------------|---------|
| `peer-discovered` | New peer found | `{ peer }` |
| `peer-connected` | Connected to peer | `{ peer }` |
| `peer-disconnected` | Disconnected from peer | `{ peer }` |
| `peer-secured` | Secure session established | `{ peer }` |
| `message` | Any message received | `{ message }` |
| `private-message` | Private message received | `{ message }` |
| `channel-message` | Channel message received | `{ message }` |
| `message-delivered` | Message delivery confirmed | `{ messageId, peerId, timestamp }` |
| `message-failed` | Message delivery failed | `{ messageId, peerId, error }` |
| `read-receipt` | Read receipt received | `{ messageIds, fromPeerId, timestamp }` |
| `identity-announced` | Peer announced identity | `{ peerId, fingerprint, nickname }` |
| `peer-verified` | Peer verification changed | `{ peerId, fingerprint }` |
| `peer-compromised` | Fingerprint mismatch detected | `{ peerId, expected, actual }` |

## Configuration

### Initialization Options

```javascript
await mesh.initialize({
  // Display name for this node
  displayName: 'My Device',

  // Storage adapter (null for in-memory)
  storage: null,

  // Custom key manager (optional)
  keyManager: null,

  // Enable compression for messages > 64 bytes
  compressionEnabled: true,

  // Compression threshold in bytes
  compressionThreshold: 64,
});
```

### Power Modes

| Mode | Scan Interval | Window | Use Case |
|------|---------------|--------|----------|
| `PERFORMANCE` | 1s | 800ms | Active foreground use |
| `BALANCED` | 5s | 2s | Default mode |
| `POWER_SAVER` | 30s | 5s | Background operation |
| `ULTRA_POWER_SAVER` | 60s | 5s | Minimal battery drain |

### Message Options

```javascript
// Send with options
await mesh.sendPrivateMessage(peerId, content, {
  // Request delivery acknowledgment
  requiresAck: true,

  // Enable compression
  compress: true,

  // Maximum hop count (1-15)
  maxHops: 7,

  // Priority level
  priority: 'high', // 'normal' | 'high'
});
```

## Security Features

### Cryptographic Primitives

- **Key Exchange**: X25519 (Curve25519 ECDH)
- **Signatures**: Ed25519
- **Encryption**: ChaCha20-Poly1305 AEAD
- **Hashing**: SHA-256, SHA-512
- **Key Derivation**: HKDF

### Noise Protocol XX Handshake

The library implements the Noise XX handshake pattern:

```
-> e
<- e, ee, s, es
-> s, se
```

This provides:
- Mutual authentication
- Forward secrecy
- Identity hiding

### Session Security

- **Automatic Rekeying**: Sessions rekey every hour or after 10,000 messages
- **Replay Protection**: Sliding window algorithm with configurable window size
- **Nonce Management**: Automatic nonce tracking prevents reuse

### Identity Verification

Verify peer identities out-of-band using fingerprints:

```javascript
// Get your fingerprint to share
const myFingerprint = mesh.getFingerprint();
// Format: "A1B2 C3D4 E5F6 G7H8 I9J0 K1L2 M3N4 O5P6"

// Verify a peer after out-of-band confirmation
mesh.verifyPeer(peerId, theirFingerprint);

// Check if a peer is verified
const peer = mesh.getPeer(peerId);
console.log('Verified:', peer.verificationStatus === 'verified');
```

## Protocol Details

### Message Header Format

The library uses an optimized 24-32 byte header:

| Field | Size | Description |
|-------|------|-------------|
| version | 1 | Protocol version |
| type | 1 | Message type |
| flags | 1 | Feature flags |
| ttl | 1 | Hop count + max hops |
| timestamp | 8 | Unix timestamp (ms) |
| payloadLength | 2 | Payload size |
| fragmentIndex | 1 | Fragment index |
| fragmentTotal | 1 | Total fragments |
| senderId | 8 | Truncated peer ID |
| recipientId | 8 | (Optional) Recipient ID |

### Message Types

| Category | Types |
|----------|-------|
| Data | TEXT, TEXT_ACK, BINARY, BINARY_ACK |
| Handshake | HANDSHAKE_INIT, HANDSHAKE_RESPONSE, HANDSHAKE_FINAL |
| Discovery | PEER_ANNOUNCE, PEER_REQUEST, PEER_RESPONSE, IDENTITY_ANNOUNCE |
| Channels | CHANNEL_JOIN, CHANNEL_LEAVE, CHANNEL_MESSAGE |
| Private | PRIVATE_MESSAGE, PRIVATE_ACK, READ_RECEIPT |
| Control | HEARTBEAT, PING, PONG |
| Fragments | FRAGMENT_START, FRAGMENT_CONTINUE, FRAGMENT_END |

## Error Handling

The library provides detailed error classes:

```javascript
const {
  MeshError,
  CryptoError,
  ConnectionError,
  HandshakeError,
  MessageError,
  FragmentError,
  TrustError,
  RetryError
} = require('react-native-ble-mesh/errors');

mesh.on('error', (error) => {
  if (error instanceof CryptoError) {
    console.error('Crypto error:', error.code, error.message);
  } else if (error instanceof ConnectionError) {
    console.error('Connection error:', error.code, error.message);
  } else if (error instanceof TrustError) {
    console.error('Trust error:', error.code, error.message);
  }

  // All errors have these properties
  console.log('Error code:', error.code);
  console.log('Category:', error.category);
  console.log('Recoverable:', error.recoverable);
  console.log('Details:', error.details);
});
```

### Error Codes

| Category | Codes |
|----------|-------|
| Crypto | E_CRYPTO_001 - E_CRYPTO_006 |
| Connection | E_CONN_001 - E_CONN_003 |
| Handshake | E_HAND_001 - E_HAND_003 |
| Message | E_MSG_001 - E_MSG_004 |
| Fragment | E_FRAG_001 - E_FRAG_004 |
| Trust | E_TRUST_001 - E_TRUST_004 |
| Retry | E_RETRY_001 - E_RETRY_003 |

## Platform Support

### React Native

```javascript
const { MeshService, BLETransport } = require('react-native-ble-mesh');
const { RNBLEAdapter } = require('react-native-ble-mesh/adapters');

const transport = new BLETransport({
  adapter: new RNBLEAdapter(),
});
```

**Required permissions (iOS):**
- NSBluetoothAlwaysUsageDescription
- NSBluetoothPeripheralUsageDescription

**Required permissions (Android):**
- BLUETOOTH
- BLUETOOTH_ADMIN
- BLUETOOTH_SCAN
- BLUETOOTH_ADVERTISE
- BLUETOOTH_CONNECT
- ACCESS_FINE_LOCATION

### Node.js

```javascript
const { MeshService, BLETransport } = require('react-native-ble-mesh');
const { NodeBLEAdapter } = require('react-native-ble-mesh/adapters');

const transport = new BLETransport({
  adapter: new NodeBLEAdapter(),
});
```

## Examples

### Basic Chat Application

```javascript
const { MeshService, BLETransport, MemoryStorage } = require('react-native-ble-mesh');

class ChatApp {
  constructor() {
    this.mesh = new MeshService();
    this.messages = [];
  }

  async start(displayName) {
    await this.mesh.initialize({
      displayName,
      storage: new MemoryStorage(),
    });

    const transport = new BLETransport();
    await this.mesh.start(transport);

    this.setupEventHandlers();
    console.log('Chat started! Your fingerprint:', this.mesh.getFingerprint());
  }

  setupEventHandlers() {
    this.mesh.on('peer-discovered', (peer) => {
      console.log(`[+] Discovered: ${peer.getDisplayName()}`);
    });

    this.mesh.on('private-message', (message) => {
      this.messages.push(message);
      console.log(`[${message.senderId.slice(0, 8)}]: ${message.content}`);
    });

    this.mesh.on('message-delivered', ({ messageId }) => {
      console.log(`[OK] Delivered: ${messageId.slice(0, 8)}`);
    });
  }

  async sendMessage(peerId, content) {
    return await this.mesh.sendPrivateMessage(peerId, content, {
      requiresAck: true,
    });
  }

  getPeers() {
    return this.mesh.getPeers();
  }

  verifyPeer(peerId, fingerprint) {
    this.mesh.verifyPeer(peerId, fingerprint);
  }

  async stop() {
    await this.mesh.stop();
    await this.mesh.destroy();
  }
}

// Usage
const chat = new ChatApp();
await chat.start('Alice');

// List discovered peers
const peers = chat.getPeers();
peers.forEach(p => console.log(p.id, p.getDisplayName()));

// Send a message
await chat.sendMessage(peers[0].id, 'Hello!');
```

### Multi-Hop Messaging

```javascript
// Messages automatically route through multiple hops
const messageId = await mesh.sendPrivateMessage(distantPeerId, 'Hello distant peer!', {
  maxHops: 10, // Allow up to 10 hops
  requiresAck: true,
});

// Track routing statistics
const stats = mesh.getStats();
console.log('Messages relayed:', stats.messagesRelayed);
console.log('Average hop count:', stats.averageHopCount);
```

### Secure File Transfer

```javascript
const fs = require('fs');
const path = require('path');

async function sendFile(mesh, peerId, filePath) {
  const fileData = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  // The library automatically handles:
  // - Compression for large payloads
  // - Fragmentation for BLE MTU limits
  // - Encryption with peer's session key
  // - Automatic retry on failure

  const messageId = await mesh.sendPrivateMessage(peerId, {
    type: 'file',
    name: fileName,
    data: fileData.toString('base64'),
    size: fileData.length,
  }, {
    compress: true,
    requiresAck: true,
  });

  console.log('File transfer initiated:', messageId);
}
```

## Testing

Run the test suite:

```bash
npm test
```

Run with coverage:

```bash
npm run test:coverage
```

Run specific test files:

```bash
npm test -- __tests__/crypto/sha256.test.js
npm test -- __tests__/integration/handshake.test.js
```

## Project Structure

```
react-native-ble-mesh/
├── src/
│   ├── index.js                # Main exports
│   ├── constants/              # Protocol, BLE, crypto constants
│   ├── errors/                 # Custom error classes
│   ├── crypto/                 # Cryptographic implementations
│   │   ├── noise/              # Noise Protocol (handshake, session)
│   │   └── keys/               # Key management
│   ├── protocol/               # Message serialization/deserialization
│   ├── mesh/                   # Mesh networking logic
│   │   ├── router/             # Message routing
│   │   ├── dedup/              # Duplicate detection
│   │   ├── fragment/           # Message fragmentation
│   │   └── peer/               # Peer management
│   ├── transport/              # BLE transport layer
│   ├── storage/                # Persistence adapters
│   ├── utils/                  # Utility functions
│   └── service/                # High-level service orchestration
├── __tests__/                  # Test files
├── docs/                       # Documentation
├── examples/                   # Example applications
└── package.json
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests and linting (`npm run validate`)
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

### Code Style

- Maximum 200 lines per file
- JSDoc comments on all public APIs
- ESLint with strict rules
- 100% test coverage on crypto modules
- >80% coverage on other modules

## Documentation

- [API Reference](docs/API.md) - Complete API documentation
- [Architecture](docs/ARCHITECTURE.md) - System design and module structure
- [Security](docs/SECURITY.md) - Threat model and security properties
- [Protocol](docs/PROTOCOL.md) - Wire format and message types

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

This project is inspired by [bitchat](https://github.com/permissionlesstech/bitchat).

- [Noise Protocol Framework](https://noiseprotocol.org/) - Cryptographic handshake pattern
- [react-native-ble-plx](https://github.com/Polidea/react-native-ble-plx) - React Native BLE library
- [Noble](https://github.com/abandonware/noble) - Node.js BLE library
