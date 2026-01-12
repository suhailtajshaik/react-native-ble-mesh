# Architecture Documentation

## System Overview

The BLE Mesh Network library is organized into layered modules with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│                    (MeshService API)                         │
├─────────────────────────────────────────────────────────────┤
│                      Service Layer                           │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│   │  Session    │ │  Handshake  │ │      Channel        │   │
│   │  Manager    │ │  Manager    │ │      Manager        │   │
│   └─────────────┘ └─────────────┘ └─────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                       Mesh Layer                             │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│   │   Router    │ │    Peer     │ │     Fragment        │   │
│   │  (Dedup)    │ │   Manager   │ │     Assembler       │   │
│   └─────────────┘ └─────────────┘ └─────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                     Protocol Layer                           │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│   │  Serializer │ │ Deserializer│ │     Validator       │   │
│   └─────────────┘ └─────────────┘ └─────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                      Crypto Layer                            │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│   │    Noise    │ │    AEAD     │ │      X25519         │   │
│   │  Protocol   │ │ (ChaCha20)  │ │   Key Exchange      │   │
│   └─────────────┘ └─────────────┘ └─────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                     Transport Layer                          │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│   │    BLE      │ │    Mock     │ │      Adapters       │   │
│   │  Transport  │ │  Transport  │ │   (RN/Node/Web)     │   │
│   └─────────────┘ └─────────────┘ └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Module Dependency Graph

```
                        index.js
                           │
                           ▼
                     MeshService
                     /    │    \
                    /     │     \
                   ▼      ▼      ▼
            Session  Handshake  Channel
            Manager   Manager   Manager
                \       │       /
                 \      │      /
                  ▼     ▼     ▼
               ┌─────────────────┐
               │   Mesh Layer    │
               │  ┌───────────┐  │
               │  │  Router   │  │
               │  │  ┌─────┐  │  │
               │  │  │Dedup│  │  │
               │  │  └─────┘  │  │
               │  └───────────┘  │
               │  ┌───────────┐  │
               │  │   Peer    │  │
               │  │  Manager  │  │
               │  └───────────┘  │
               │  ┌───────────┐  │
               │  │ Fragment  │  │
               │  └───────────┘  │
               └─────────────────┘
                        │
                        ▼
               ┌─────────────────┐
               │ Protocol Layer  │
               │  ┌───────────┐  │
               │  │  Message  │  │
               │  │  Header   │  │
               │  └───────────┘  │
               │  ┌───────────┐  │
               │  │Serializer │  │
               │  └───────────┘  │
               └─────────────────┘
                        │
                        ▼
               ┌─────────────────┐
               │  Crypto Layer   │
               │  ┌───────────┐  │
               │  │   Noise   │  │
               │  │ Handshake │  │
               │  └───────────┘  │
               │  ┌───────────┐  │
               │  │   AEAD    │  │
               │  └───────────┘  │
               │  ┌───────────┐  │
               │  │  X25519   │  │
               │  └───────────┘  │
               │  ┌───────────┐  │
               │  │  SHA-256  │  │
               │  └───────────┘  │
               └─────────────────┘
```

## Data Flow

### Outgoing Message Flow

```
Application
    │
    │ sendPrivateMessage(peerId, content)
    ▼
MeshService
    │
    │ Create Message object
    ▼
SessionManager
    │
    │ Get NoiseSession for peer
    │ Encrypt payload
    ▼
MessageRouter
    │
    │ Check routing table
    │ Get next hop
    ▼
Serializer
    │
    │ Serialize to binary
    │ Add CRC32 checksum
    ▼
Transport
    │
    │ Send over BLE
    ▼
Remote Peer
```

### Incoming Message Flow

```
Transport
    │
    │ Receive bytes
    ▼
Deserializer
    │
    │ Parse header
    │ Verify checksum
    ▼
MessageRouter
    │
    │ Check if duplicate (Bloom + LRU)
    │ Check TTL and hop count
    │
    ├──► If for us: process locally
    │
    ▼
SessionManager
    │
    │ Get NoiseSession
    │ Decrypt payload
    ▼
MeshService
    │
    │ Emit 'message:received'
    ▼
Application
```

### Handshake Flow

```
┌──────────┐                              ┌──────────┐
│  Alice   │                              │   Bob    │
│(Initiator)                              │(Responder)
└────┬─────┘                              └────┬─────┘
     │                                         │
     │  initializeInitiator(aliceStatic)       │  initializeResponder(bobStatic)
     │                                         │
     │              Message 1                  │
     │  ────────────────────────────────────►  │
     │  e (ephemeral public key, 32 bytes)     │
     │                                         │
     │              Message 2                  │
     │  ◄────────────────────────────────────  │
     │  e, ee, s, es (96 bytes)                │
     │  - Bob's ephemeral public key           │
     │  - Encrypted Bob's static public key    │
     │                                         │
     │              Message 3                  │
     │  ────────────────────────────────────►  │
     │  s, se (48 bytes)                       │
     │  - Encrypted Alice's static public key  │
     │                                         │
     │         ◄ Session Established ►         │
     │                                         │
     │  getSession() → NoiseSession            │  getSession() → NoiseSession
     │  (sendKey, receiveKey)                  │  (sendKey, receiveKey)
     │                                         │
     │            Encrypted Data               │
     │  ◄─────────────────────────────────────►│
     │                                         │
```

## State Machine

### MeshService States

```
                         initialize()
        ┌───────────┐ ──────────────► ┌──────────────┐
        │UNINITIALIZED│               │ INITIALIZING │
        └───────────┘                 └──────┬───────┘
                                             │
                                             │ success
                                             ▼
                              ┌─────────────────────────┐
                              │         READY           │
                              └───────────┬─────────────┘
                                          │
                                          │ start(transport)
                                          ▼
              stop()        ┌─────────────────────────┐
         ◄────────────────  │         ACTIVE          │
                            └───────────┬─────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    │ error             │ suspend           │ destroy
                    ▼                   ▼                   ▼
            ┌───────────┐       ┌───────────┐       ┌───────────┐
            │   ERROR   │       │ SUSPENDED │       │ DESTROYED │
            └───────────┘       └───────────┘       └───────────┘
                    │                   │
                    └───────────────────┘
                            │
                            │ recover/resume
                            ▼
                    ┌───────────┐
                    │  ACTIVE   │
                    └───────────┘
```

### Peer States

```
        ┌──────────────┐
        │  DISCOVERED  │ ◄── Transport discovery
        └──────┬───────┘
               │
               │ connect()
               ▼
        ┌──────────────┐
        │  CONNECTING  │
        └──────┬───────┘
               │
               │ connection established
               ▼
        ┌──────────────┐
        │  CONNECTED   │
        └──────┬───────┘
               │
               │ handshake complete
               ▼
        ┌──────────────┐
        │   SECURED    │ ◄── Ready for encrypted messages
        └──────┬───────┘
               │
               │ disconnect / timeout
               ▼
        ┌──────────────┐
        │ DISCONNECTED │
        └──────────────┘
```

## Key Components

### Crypto Layer

| Component | Purpose |
|-----------|---------|
| `sha256.js` | SHA-256 hash function (FIPS 180-4) |
| `hmac.js` | HMAC-SHA256 message authentication |
| `hkdf.js` | HKDF key derivation (RFC 5869) |
| `x25519.js` | Elliptic curve Diffie-Hellman |
| `chacha20.js` | ChaCha20 stream cipher |
| `poly1305.js` | Poly1305 MAC |
| `aead.js` | ChaCha20-Poly1305 AEAD |
| `noise/state.js` | Noise symmetric state |
| `noise/handshake.js` | Noise XX handshake |
| `noise/session.js` | Post-handshake encryption |

### Protocol Layer

| Component | Purpose |
|-----------|---------|
| `header.js` | 48-byte message header |
| `message.js` | Message container class |
| `serializer.js` | Binary serialization |
| `deserializer.js` | Binary deserialization |
| `validator.js` | Message validation |
| `crc32.js` | CRC32 checksum |

### Mesh Layer

| Component | Purpose |
|-----------|---------|
| `BloomFilter.js` | Fast probabilistic duplicate detection |
| `MessageCache.js` | LRU cache for recent messages |
| `DedupManager.js` | Combined deduplication |
| `Fragmenter.js` | Message fragmentation |
| `Assembler.js` | Fragment reassembly |
| `Peer.js` | Peer data structure |
| `PeerManager.js` | Peer lifecycle management |
| `RouteTable.js` | Routing information |
| `MessageRouter.js` | Message routing logic |

### Service Layer

| Component | Purpose |
|-----------|---------|
| `MeshService.js` | Main orchestrator, public API |
| `SessionManager.js` | Noise session lifecycle |
| `HandshakeManager.js` | Handshake orchestration |
| `ChannelManager.js` | Channel subscriptions |

## Design Decisions

### Why Pure JavaScript Crypto?

1. **Portability**: Works in Node.js, React Native, and browsers
2. **No Native Dependencies**: Easier installation and deployment
3. **Auditability**: Code can be reviewed without native expertise
4. **Trade-off**: Slower than native, but sufficient for messaging workloads

### Why Noise Protocol XX?

1. **Mutual Authentication**: Both parties prove identity
2. **Forward Secrecy**: Ephemeral keys protect past sessions
3. **Identity Hiding**: Static keys encrypted during handshake
4. **Simplicity**: Well-defined pattern with clear security properties
5. **No PKI Required**: Works peer-to-peer without certificate authorities

### Why Bloom Filter + LRU?

1. **Fast**: O(1) probabilistic check with Bloom filter
2. **Accurate**: LRU cache eliminates false positives
3. **Memory Efficient**: Bloom filter uses minimal memory
4. **Bounded**: LRU prevents unbounded growth

### Why 48-byte Header?

1. **Fixed Size**: Simplifies parsing and allocation
2. **Complete**: Contains all necessary routing metadata
3. **Extensible**: Reserved bytes for future use
4. **Checksummed**: CRC32 catches corruption

## Performance Considerations

### Message Throughput

- Header serialization: ~50μs
- AEAD encryption (256 bytes): ~100μs
- Bloom filter check: ~1μs
- Total per message: ~200μs
- Theoretical throughput: ~5000 messages/second

### Memory Usage

- Bloom filter (2KB): 2,048 bytes
- LRU cache (1000 entries): ~100KB
- Peer manager (100 peers): ~50KB
- Session keys (10 sessions): ~2KB
- Total baseline: ~200KB

### Battery Considerations

- BLE scanning: Major power consumer
- Configurable scan intervals (POWER_MODE)
- Heartbeat interval tuning
- Aggressive peer timeout for cleanup
