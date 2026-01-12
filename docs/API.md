# API Reference

## MeshService

The main class for interacting with the BLE mesh network.

### Constructor

```javascript
const mesh = new MeshService(config?)
```

**Parameters:**
- `config` (Object, optional) - Configuration options
  - `maxPeers` (number) - Maximum concurrent peers (default: 8)
  - `messageTimeout` (number) - Message TTL in ms (default: 30 minutes)
  - `handshakeTimeout` (number) - Handshake timeout in ms (default: 30 seconds)

### Lifecycle Methods

#### initialize(options?)

Initialize the mesh service.

```javascript
await mesh.initialize(options?)
```

**Parameters:**
- `options` (Object, optional)
  - `identity` (Object) - Import existing identity
  - `displayName` (string) - Initial display name

**Returns:** `Promise<void>`

#### start(transport)

Start the mesh service with a transport.

```javascript
await mesh.start(transport)
```

**Parameters:**
- `transport` (Transport) - Transport instance (BLETransport or MockTransport)

**Returns:** `Promise<void>`

#### stop()

Stop the mesh service.

```javascript
await mesh.stop()
```

**Returns:** `Promise<void>`

#### destroy()

Destroy and clean up all resources.

```javascript
await mesh.destroy()
```

**Returns:** `Promise<void>`

### Identity Methods

#### getIdentity()

Get the local identity.

```javascript
const identity = mesh.getIdentity()
// { publicKey: '...', displayName: 'Alice' }
```

**Returns:** `{ publicKey: string, displayName: string }`

#### setDisplayName(name)

Set the display name.

```javascript
mesh.setDisplayName('Alice')
```

**Parameters:**
- `name` (string) - Display name (max 64 characters)

#### exportIdentity()

Export identity for backup.

```javascript
const exported = mesh.exportIdentity()
// { publicKey: '...', secretKey: '...' }
```

**Returns:** `{ publicKey: string, secretKey: string }`

#### importIdentity(identity)

Import a previously exported identity.

```javascript
mesh.importIdentity({ publicKey: '...', secretKey: '...' })
```

**Parameters:**
- `identity` (Object) - Exported identity

### Peer Methods

#### getPeers()

Get all known peers.

```javascript
const peers = mesh.getPeers()
```

**Returns:** `Peer[]`

#### getPeer(id)

Get a specific peer.

```javascript
const peer = mesh.getPeer(peerId)
```

**Parameters:**
- `id` (string) - Peer ID

**Returns:** `Peer | undefined`

#### getConnectedPeers()

Get all connected peers.

```javascript
const connected = mesh.getConnectedPeers()
```

**Returns:** `Peer[]`

#### getSecuredPeers()

Get peers with established secure sessions.

```javascript
const secured = mesh.getSecuredPeers()
```

**Returns:** `Peer[]`

#### initiateHandshake(peerId)

Initiate a secure handshake with a peer.

```javascript
await mesh.initiateHandshake(peerId)
```

**Parameters:**
- `peerId` (string) - Target peer ID

**Returns:** `Promise<void>`

#### blockPeer(id)

Block a peer.

```javascript
mesh.blockPeer(peerId)
```

**Parameters:**
- `id` (string) - Peer ID to block

#### unblockPeer(id)

Unblock a peer.

```javascript
mesh.unblockPeer(peerId)
```

**Parameters:**
- `id` (string) - Peer ID to unblock

### Messaging Methods

#### sendBroadcast(content)

Send a broadcast message to all peers.

```javascript
const messageId = mesh.sendBroadcast('Hello everyone!')
```

**Parameters:**
- `content` (string) - Message content

**Returns:** `string` - Message ID

#### sendPrivateMessage(peerId, content)

Send an encrypted private message.

```javascript
const messageId = await mesh.sendPrivateMessage(peerId, 'Secret')
```

**Parameters:**
- `peerId` (string) - Recipient peer ID
- `content` (string) - Message content

**Returns:** `Promise<string>` - Message ID

#### sendChannelMessage(channelId, content)

Send a message to a channel.

```javascript
const messageId = mesh.sendChannelMessage('general', 'Hello channel!')
```

**Parameters:**
- `channelId` (string) - Channel ID
- `content` (string) - Message content

**Returns:** `string` - Message ID

### Channel Methods

#### joinChannel(channelId, password?)

Join a channel.

```javascript
mesh.joinChannel('general')
mesh.joinChannel('private-room', 'secretPassword')
```

**Parameters:**
- `channelId` (string) - Channel ID
- `password` (string, optional) - Channel password

#### leaveChannel(channelId)

Leave a channel.

```javascript
mesh.leaveChannel('general')
```

**Parameters:**
- `channelId` (string) - Channel ID

#### getChannels()

Get joined channels.

```javascript
const channels = mesh.getChannels()
```

**Returns:** `Channel[]`

### Status Methods

#### getStatus()

Get mesh status.

```javascript
const status = mesh.getStatus()
// { state: 'active', peerCount: 3, securedCount: 2 }
```

**Returns:** `MeshStatus`

#### getState()

Get current state.

```javascript
const state = mesh.getState()
// 'active'
```

**Returns:** `string`

## Events

### Peer Events

#### peer:discovered

Emitted when a new peer is discovered.

```javascript
mesh.on('peer:discovered', ({ peer }) => {
  console.log('Found:', peer.id, peer.name)
})
```

#### peer:connected

Emitted when connected to a peer.

```javascript
mesh.on('peer:connected', ({ peerId }) => {
  console.log('Connected:', peerId)
})
```

#### peer:disconnected

Emitted when disconnected from a peer.

```javascript
mesh.on('peer:disconnected', ({ peerId, reason }) => {
  console.log('Disconnected:', peerId, reason)
})
```

#### peer:secured

Emitted when secure session established.

```javascript
mesh.on('peer:secured', ({ peerId }) => {
  console.log('Secure channel:', peerId)
})
```

### Message Events

#### message:received

Emitted when a message is received.

```javascript
mesh.on('message:received', ({ message, sourcePeerId }) => {
  console.log('From:', sourcePeerId)
  console.log('Content:', message.getContent())
})
```

#### message:sent

Emitted when a message is sent.

```javascript
mesh.on('message:sent', ({ messageId }) => {
  console.log('Sent:', messageId)
})
```

### Handshake Events

#### handshake:started

Emitted when handshake begins.

```javascript
mesh.on('handshake:started', ({ peerId }) => {
  console.log('Handshake started:', peerId)
})
```

#### handshake:complete

Emitted when handshake completes.

```javascript
mesh.on('handshake:complete', ({ peerId }) => {
  console.log('Handshake complete:', peerId)
})
```

#### handshake:failed

Emitted when handshake fails.

```javascript
mesh.on('handshake:failed', ({ peerId, error }) => {
  console.log('Handshake failed:', peerId, error)
})
```

### Channel Events

#### channel:joined

Emitted when joined a channel.

```javascript
mesh.on('channel:joined', ({ channelId }) => {
  console.log('Joined:', channelId)
})
```

#### channel:message

Emitted when channel message received.

```javascript
mesh.on('channel:message', ({ channelId, message, senderId }) => {
  console.log(`[${channelId}] ${senderId}: ${message}`)
})
```

## Types

### Peer

```typescript
interface Peer {
  id: string
  publicKey: string
  name: string
  rssi: number
  hopCount: number
  lastSeen: number
  connectionState: string
  hasSecureSession: boolean

  isConnected(): boolean
  isSecured(): boolean
}
```

### Message

```typescript
interface Message {
  header: MessageHeader
  payload: Uint8Array

  isExpired(): boolean
  isFragment(): boolean
  isEncrypted(): boolean
  getContent(): string
}
```

### Channel

```typescript
interface Channel {
  id: string
  name: string
  memberCount: number
  hasPassword: boolean
}
```
