# AI Agent Instructions: react-native-ble-mesh

> This document provides instructions for AI agents to understand and help users with the `react-native-ble-mesh` npm module.

## Overview

`react-native-ble-mesh` is a Bluetooth Low Energy (BLE) mesh networking library for React Native that enables:
- Peer-to-peer communication without internet
- End-to-end encryption using Noise Protocol
- Offline messaging with store-and-forward
- Multi-hop message routing
- Battery-optimized operation

**Primary use case**: Building decentralized chat apps, emergency communication tools, or any app requiring offline P2P messaging.

---

## Installation

```bash
npm install react-native-ble-mesh
```

### Peer Dependencies (React Native)
```bash
npm install react-native-ble-plx react-native-get-random-values
```

### iOS Setup
```bash
cd ios && pod install
```

Add to `Info.plist`:
```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>App uses Bluetooth to communicate with nearby devices</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>App uses Bluetooth to communicate with nearby devices</string>
<key>UIBackgroundModes</key>
<array>
  <string>bluetooth-central</string>
  <string>bluetooth-peripheral</string>
</array>
```

### Android Setup
Add to `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

---

## Quick Start

### Basic Usage (High-Level API)

```javascript
import { MeshNetwork } from 'react-native-ble-mesh';

// Create mesh instance
const mesh = new MeshNetwork({
  nickname: 'Alice',
  batteryMode: MeshNetwork.BatteryMode.BALANCED,
});

// Set up event listeners
mesh.on('messageReceived', ({ from, text, channel }) => {
  console.log(`${from}: ${text}`);
});

mesh.on('peerConnected', ({ peerId, displayName }) => {
  console.log(`${displayName} joined the network`);
});

// Start the mesh network
await mesh.start();

// Send messages
await mesh.broadcast('Hello everyone!');
await mesh.sendDirect('peer-id-here', 'Private message');

// Join channels
await mesh.joinChannel('#general');
await mesh.sendToChannel('#general', 'Hello channel!');

// Clean up
await mesh.destroy();
```

### Using React Hooks

```javascript
import { useMesh, useMessages, usePeers } from 'react-native-ble-mesh/hooks';

function ChatScreen() {
  const { mesh, isConnected, start, stop } = useMesh({ nickname: 'User' });
  const { messages, sendMessage, sendBroadcast } = useMessages(mesh);
  const { peers, connectedPeers } = usePeers(mesh);

  useEffect(() => {
    start();
    return () => stop();
  }, []);

  return (
    <View>
      <Text>Connected peers: {connectedPeers.length}</Text>
      {messages.map(msg => (
        <Text key={msg.id}>{msg.from}: {msg.text}</Text>
      ))}
    </View>
  );
}
```

---

## Core Concepts

### 1. MeshNetwork (High-Level API)
The main entry point. Handles all mesh operations including peer discovery, messaging, encryption, and battery optimization.

```javascript
const mesh = new MeshNetwork({
  nickname: 'DisplayName',           // User's display name
  batteryMode: 'balanced',           // 'high' | 'balanced' | 'low' | 'auto'
  compression: { enabled: true },    // Enable LZ4 compression
  storeAndForward: { enabled: true }, // Cache messages for offline peers
});
```

### 2. Message Types
- **Broadcast**: Unencrypted, reaches all peers in range
- **Direct/Private**: End-to-end encrypted, point-to-point
- **Channel**: Group messages to subscribed peers

### 3. Peer States
- `discovered`: Peer found via BLE scan
- `connecting`: Handshake in progress
- `connected`: Secure session established
- `disconnected`: Connection lost

### 4. Battery Modes
```javascript
MeshNetwork.BatteryMode.HIGH_PERFORMANCE  // Max range, frequent scans
MeshNetwork.BatteryMode.BALANCED          // Default, balanced power
MeshNetwork.BatteryMode.LOW_POWER         // Minimal power usage
MeshNetwork.BatteryMode.AUTO              // Adapts to battery level
```

### 5. Health Status
```javascript
MeshNetwork.HealthStatus.GOOD  // < 100ms latency, < 5% packet loss
MeshNetwork.HealthStatus.FAIR  // < 300ms latency, < 15% packet loss
MeshNetwork.HealthStatus.POOR  // High latency or packet loss
```

---

## API Reference

### MeshNetwork Methods

| Method | Description |
|--------|-------------|
| `start(transport?)` | Start mesh network (optional custom transport) |
| `stop()` | Stop mesh network |
| `destroy()` | Clean up all resources |
| `broadcast(text)` | Send message to all peers |
| `sendDirect(peerId, text)` | Send encrypted message to peer |
| `sendToChannel(channel, text)` | Send to channel subscribers |
| `joinChannel(channel)` | Subscribe to channel |
| `leaveChannel(channel)` | Unsubscribe from channel |
| `getStatus()` | Get network status object |
| `getPeers()` | Get list of known peers |
| `getIdentity()` | Get own identity info |
| `setNickname(name)` | Update display name |
| `setBatteryMode(mode)` | Change battery mode |
| `getBatteryMode()` | Get current battery mode |
| `getNetworkHealth()` | Get health metrics |
| `blockPeer(peerId)` | Block a peer |
| `unblockPeer(peerId)` | Unblock a peer |
| `enablePanicMode(options?)` | Enable emergency data wipe |
| `disablePanicMode()` | Disable panic mode |
| `wipeAllData()` | Execute immediate data wipe |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `started` | `{}` | Network started |
| `stopped` | `{}` | Network stopped |
| `messageReceived` | `{ from, text, channel?, encrypted }` | Message received |
| `messageSent` | `{ id, to?, channel? }` | Message sent |
| `peerDiscovered` | `{ peerId, rssi }` | New peer found |
| `peerConnected` | `{ peerId, displayName }` | Peer connected |
| `peerDisconnected` | `{ peerId, reason }` | Peer disconnected |
| `channelJoined` | `{ channel }` | Joined channel |
| `channelLeft` | `{ channel }` | Left channel |
| `networkHealthChanged` | `{ health, status }` | Health status changed |
| `batteryModeChanged` | `{ mode, previous }` | Battery mode changed |
| `error` | `{ code, message }` | Error occurred |

---

## Common Patterns

### 1. Handling Offline Peers (Store & Forward)

```javascript
const mesh = new MeshNetwork({
  storeAndForward: {
    enabled: true,
    retentionHours: 24,      // Keep messages for 24 hours
    maxCachedMessages: 500,  // Max messages to cache
  },
});

// Messages to offline peers are automatically cached
await mesh.sendDirect('offline-peer', 'Will deliver when online');

// Listen for cached message delivery
mesh.on('messageCached', ({ messageId, recipientId }) => {
  console.log(`Message cached for ${recipientId}`);
});

mesh.on('cachedMessageDelivered', ({ messageId, recipientId }) => {
  console.log(`Cached message delivered to ${recipientId}`);
});
```

### 2. Battery-Aware Operation

```javascript
import { DeviceEventEmitter } from 'react-native';

const mesh = new MeshNetwork({
  batteryMode: MeshNetwork.BatteryMode.AUTO,
});

// Update mesh with battery info
DeviceEventEmitter.addListener('batteryLevelChanged', (level) => {
  mesh.updateBatteryLevel(level, level < 20);
});

// Listen for mode changes
mesh.on('batteryModeChanged', ({ mode }) => {
  console.log(`Switched to ${mode} mode`);
});
```

### 3. Emergency Data Wipe (Panic Mode)

```javascript
const mesh = new MeshNetwork();
await mesh.start();

// Enable panic mode with triple-tap trigger
mesh.enablePanicMode({
  trigger: MeshNetwork.PanicTrigger.TRIPLE_TAP,
  wipeTarget: 200, // Target wipe time in ms
});

// Register taps from UI
onTripleTap(() => {
  mesh.registerPanicTap();
});

// Or trigger manually
await mesh.wipeAllData();
```

### 4. Network Health Monitoring

```javascript
mesh.on('networkHealthChanged', ({ status, health }) => {
  if (status === MeshNetwork.HealthStatus.POOR) {
    // Show warning to user
    showNetworkWarning();
  }

  console.log(`Latency: ${health.averageLatencyMs}ms`);
  console.log(`Packet loss: ${health.packetLossRate}%`);
});

// Get current health
const health = mesh.getNetworkHealth();
```

### 5. Using Compression

```javascript
import { MessageCompressor } from 'react-native-ble-mesh/utils';

// Automatic compression in MeshNetwork
const mesh = new MeshNetwork({
  compression: {
    enabled: true,
    threshold: 100, // Compress payloads > 100 bytes
  },
});

// Manual compression
const compressor = new MessageCompressor({ threshold: 50 });
const { data, compressed } = compressor.compress(payload);
const original = compressor.decompress(data, compressed);
```

---

## Low-Level API (Advanced)

For advanced use cases, access individual components:

```javascript
import {
  // Core service
  MeshService,

  // Crypto
  NoiseHandshake,
  KeyManager,
  AEAD,

  // Mesh components
  PeerManager,
  MessageRouter,
  BloomFilter,

  // Transport
  BLETransport,
  MockTransport,

  // Protocol
  MessageSerializer,
  MessageDeserializer,

  // Storage
  MessageStore,
  MemoryStorage,
} from 'react-native-ble-mesh';
```

### Custom Transport

```javascript
import { Transport, MeshService } from 'react-native-ble-mesh';

class MyCustomTransport extends Transport {
  async start() { /* ... */ }
  async stop() { /* ... */ }
  async send(peerId, data) { /* ... */ }
  async broadcast(data) { /* ... */ }
}

const service = new MeshService();
await service.initialize(new MyCustomTransport());
```

---

## Testing

### Mock Transport for Tests

```javascript
import { MeshNetwork, MockTransport } from 'react-native-ble-mesh';

describe('Chat Feature', () => {
  let mesh1, mesh2;

  beforeEach(async () => {
    const transport1 = new MockTransport();
    const transport2 = new MockTransport();

    // Link transports for peer-to-peer simulation
    transport1.linkTo(transport2);
    transport2.linkTo(transport1);

    mesh1 = new MeshNetwork({ nickname: 'Alice' });
    mesh2 = new MeshNetwork({ nickname: 'Bob' });

    await mesh1.start(transport1);
    await mesh2.start(transport2);
  });

  afterEach(async () => {
    await mesh1.destroy();
    await mesh2.destroy();
  });

  it('sends messages between peers', async () => {
    const received = jest.fn();
    mesh2.on('messageReceived', received);

    await mesh1.broadcast('Hello!');

    expect(received).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Hello!' })
    );
  });
});
```

---

## Error Handling

```javascript
import { ValidationError, MeshError, ConnectionError } from 'react-native-ble-mesh';

try {
  await mesh.sendDirect('', 'message'); // Invalid peer ID
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Invalid input:', error.message);
  } else if (error instanceof ConnectionError) {
    console.log('Connection failed:', error.message);
  } else if (error instanceof MeshError) {
    console.log('Mesh error:', error.code, error.message);
  }
}

// Global error handling
mesh.on('error', ({ code, message, details }) => {
  console.error(`Error ${code}: ${message}`, details);
});
```

---

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import {
  MeshNetwork,
  MeshNetworkConfig,
  MeshNetworkStatus,
  Peer,
  Message,
  BATTERY_MODE,
  PANIC_TRIGGER,
  HEALTH_STATUS,
  NetworkHealthReport,
  StoreAndForwardStats,
} from 'react-native-ble-mesh';

const config: MeshNetworkConfig = {
  nickname: 'TypedUser',
  batteryMode: BATTERY_MODE.BALANCED,
};

const mesh = new MeshNetwork(config);

mesh.on('messageReceived', (message: Message) => {
  console.log(message.text);
});
```

---

## Troubleshooting

### Common Issues

1. **BLE not working on Android**
   - Ensure location permissions are granted (required for BLE scanning)
   - Check if Bluetooth is enabled

2. **Peers not discovering each other**
   - Devices must be within BLE range (~10-30 meters)
   - Check battery mode isn't set to LOW_POWER (reduces scan frequency)

3. **Messages not delivering**
   - Verify peer is connected (not just discovered)
   - Check if peer is blocked
   - For encrypted messages, ensure handshake completed

4. **High battery drain**
   - Switch to `LOW_POWER` or `AUTO` battery mode
   - Reduce scan frequency in config

### Debug Mode

```javascript
const mesh = new MeshNetwork({
  debug: true, // Enable verbose logging
});
```

---

## Security Notes

- All private messages use **Noise Protocol XX** handshake
- Encryption: **ChaCha20-Poly1305** AEAD
- Key exchange: **X25519** ECDH
- Messages have **forward secrecy** via ephemeral keys
- Panic mode wipes all keys and message history in <200ms

---

## Version Compatibility

| Library Version | React Native | react-native-ble-plx |
|-----------------|--------------|----------------------|
| 1.1.x           | >= 0.60.0    | >= 2.0.0             |
| 1.0.x           | >= 0.60.0    | >= 2.0.0             |

---

## Resources

- [Full API Documentation](./API.md)
- [Protocol Specification](./PROTOCOL.md)
- [Security Documentation](./SECURITY.md)
- [React Native Guide](./REACT_NATIVE.md)
- [GitHub Repository](https://github.com/suhailtajshaik/react-native-ble-mesh)
- [npm Package](https://www.npmjs.com/package/react-native-ble-mesh)
