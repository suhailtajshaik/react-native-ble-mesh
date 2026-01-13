# Node.js Quick Start Guide

This guide shows how to use react-native-ble-mesh in Node.js applications.

## Installation

```bash
npm install react-native-ble-mesh

# For real BLE hardware support (optional):
npm install @abandonware/noble
```

## Basic Usage

### Method 1: Using Factory Functions (Recommended)

```javascript
const { createNodeMesh, createTestMesh, MockTransport } = require('react-native-ble-mesh');

// For testing without BLE hardware
async function testExample() {
  // Creates an initialized mesh with MockTransport
  const { mesh, transport } = await createTestMesh({ displayName: 'TestNode' });

  // Mesh is ready to use!
  mesh.on('message', (msg) => console.log('Received:', msg));

  // Clean up
  await mesh.stop();
  await mesh.destroy();
}

// For production with BLE
async function productionExample() {
  const mesh = await createNodeMesh({ displayName: 'MyNode' });

  // You provide the transport
  const { BLETransport } = require('react-native-ble-mesh');
  const transport = new BLETransport();

  await mesh.start(transport);
  // ...
}
```

### Method 2: Manual Setup

```javascript
const { MeshService, MockTransport, MemoryStorage } = require('react-native-ble-mesh');

async function main() {
  // Create service
  const mesh = new MeshService({ displayName: 'Alice' });

  // Initialize with storage
  await mesh.initialize({
    storage: new MemoryStorage()
  });

  // Create and start transport
  const transport = new MockTransport();
  await mesh.start(transport);

  // Use the mesh...
  mesh.sendBroadcast('Hello!');

  // Clean up
  await mesh.stop();
  await mesh.destroy();
}
```

## Connecting Two Nodes

```javascript
const { createTestMesh } = require('react-native-ble-mesh');

async function twoNodeExample() {
  // Create two test nodes
  const { mesh: alice, transport: aliceTransport } = await createTestMesh({ displayName: 'Alice' });
  const { mesh: bob, transport: bobTransport } = await createTestMesh({ displayName: 'Bob' });

  // Link their transports (simulates BLE discovery)
  aliceTransport.linkTo(bobTransport);

  // Set up message handlers
  bob.on('message', (msg) => {
    console.log('Bob received:', msg);
  });

  // Send a message
  alice.sendBroadcast('Hello Bob!');
}
```

## Event Handling

```javascript
const mesh = await createNodeMesh({ displayName: 'MyNode' });

// Peer events
mesh.on('peer-discovered', ({ peer }) => console.log('Found peer:', peer.id));
mesh.on('peer-connected', ({ peerId }) => console.log('Connected:', peerId));
mesh.on('peer-disconnected', ({ peerId }) => console.log('Disconnected:', peerId));
mesh.on('peer-secured', ({ peer }) => console.log('Secured session with:', peer.id));

// Message events
mesh.on('message', (message) => console.log('Any message:', message));
mesh.on('private-message', (message) => console.log('Private:', message));
mesh.on('channel-message', (message) => console.log('Channel:', message));

// Handshake events
mesh.on('handshake-complete', ({ peerId }) => console.log('Handshake done:', peerId));
mesh.on('handshake-failed', ({ peerId, error }) => console.error('Handshake failed:', error));

// State events
mesh.on('state-changed', ({ oldState, newState }) => console.log(`State: ${oldState} -> ${newState}`));

// Error handling
mesh.on('error', (error) => console.error('Error:', error.code, error.message));
```

## Debug Logging

Enable debug output to see what's happening:

```bash
# Enable all debug output
DEBUG=ble-mesh:* node your-app.js

# Enable specific namespaces
DEBUG=ble-mesh:service,ble-mesh:handshake node your-app.js
```

Available namespaces:
- `ble-mesh:service` - MeshService events
- `ble-mesh:transport` - Transport layer
- `ble-mesh:crypto` - Cryptographic operations
- `ble-mesh:handshake` - Noise Protocol handshake
- `ble-mesh:mesh` - Mesh routing
- `ble-mesh:protocol` - Protocol serialization
- `ble-mesh:storage` - Storage operations

Or enable programmatically:

```javascript
const { utils } = require('react-native-ble-mesh');
utils.enableDebug('ble-mesh:*');
```

## ESM Import

For ES Modules:

```javascript
import { createNodeMesh, MockTransport } from 'react-native-ble-mesh';

const mesh = await createNodeMesh({ displayName: 'ESMNode' });
```

## TypeScript

TypeScript definitions are included:

```typescript
import { MeshService, Peer, Message } from 'react-native-ble-mesh';

const mesh = new MeshService({ displayName: 'TypedNode' });

mesh.on('peer-discovered', ({ peer }: { peer: Peer }) => {
  console.log(peer.id, peer.name);
});

mesh.on('message', (message: Message) => {
  console.log(message.content);
});
```

## Using Real BLE (Noble)

For actual Bluetooth communication:

```javascript
const { MeshService, BLETransport, MemoryStorage } = require('react-native-ble-mesh');
const { NodeBLEAdapter } = require('react-native-ble-mesh/adapters');

async function realBLE() {
  const mesh = new MeshService({ displayName: 'BLENode' });
  await mesh.initialize({ storage: new MemoryStorage() });

  // Use real BLE with Noble adapter
  const transport = new BLETransport({
    adapter: new NodeBLEAdapter()
  });

  await mesh.start(transport);

  // Now using real Bluetooth!
}
```

**Requirements for Noble:**
- Linux: BlueZ 5.x (install with `apt-get install bluetooth bluez libbluetooth-dev libudev-dev`)
- macOS: Xcode Command Line Tools
- Windows: Not currently supported by Noble

## Examples

Run the included examples:

```bash
# Quick start demo
npm run example:node

# Interactive chat (terminal)
npm run example:chat

# Auto chat demo (non-interactive)
node examples/node-chat/chat.js --auto
```

## Testing Helper

For unit tests:

```javascript
const {
  createTestMesh,
  createTestPair,
  createTestNetwork,
  cleanupTestMeshes,
  waitForEvent
} = require('react-native-ble-mesh/examples/testing/test-helper');

describe('My mesh tests', () => {
  let alice, bob;

  beforeEach(async () => {
    const pair = await createTestPair();
    alice = pair.alice;
    bob = pair.bob;
  });

  afterEach(async () => {
    await cleanupTestMeshes(alice, bob);
  });

  test('sends message', async () => {
    alice.sendBroadcast('Hello');
    const event = await waitForEvent(bob, 'message', 1000);
    expect(event).toBeDefined();
  });
});
```

## API Reference

See [docs/API.md](API.md) for complete API documentation.
