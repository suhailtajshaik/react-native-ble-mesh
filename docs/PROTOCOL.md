# Protocol Specification

## Overview

The BLE Mesh Protocol defines the wire format and message types for peer-to-peer communication over Bluetooth Low Energy.

## Message Format

### Header (48 bytes)

| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0 | 1 | version | Protocol version (currently 1) |
| 1 | 1 | type | Message type identifier |
| 2 | 1 | flags | Message flags bitmap |
| 3 | 1 | hopCount | Current hop count |
| 4 | 1 | maxHops | Maximum allowed hops |
| 5 | 3 | reserved | Reserved for future use |
| 8 | 16 | messageId | UUID v4 as bytes |
| 24 | 8 | timestamp | Creation time (ms since epoch, big-endian) |
| 32 | 8 | expiresAt | Expiry time (ms since epoch, big-endian) |
| 40 | 2 | payloadLength | Payload size in bytes (big-endian) |
| 42 | 1 | fragmentIndex | Fragment index (0-based) |
| 43 | 1 | fragmentTotal | Total number of fragments |
| 44 | 4 | checksum | CRC32 of header (excluding checksum field) |

### Payload

Variable length payload follows the header. Maximum payload size is 500 bytes.

## Message Types

### Data Messages (0x01-0x0F)

| Type | Value | Description |
|------|-------|-------------|
| TEXT | 0x01 | Plain text message |
| TEXT_ACK | 0x02 | Text message acknowledgment |

### Handshake Messages (0x10-0x1F)

| Type | Value | Description |
|------|-------|-------------|
| HANDSHAKE_INIT | 0x10 | Noise XX Message 1 |
| HANDSHAKE_RESPONSE | 0x11 | Noise XX Message 2 |
| HANDSHAKE_FINAL | 0x12 | Noise XX Message 3 |

### Discovery Messages (0x20-0x2F)

| Type | Value | Description |
|------|-------|-------------|
| PEER_ANNOUNCE | 0x20 | Peer presence announcement |
| PEER_REQUEST | 0x21 | Request for peer information |
| PEER_RESPONSE | 0x22 | Response with peer information |

### Channel Messages (0x30-0x3F)

| Type | Value | Description |
|------|-------|-------------|
| CHANNEL_JOIN | 0x30 | Join channel request |
| CHANNEL_LEAVE | 0x31 | Leave channel notification |
| CHANNEL_MESSAGE | 0x32 | Channel broadcast message |

### Private Messages (0x40-0x4F)

| Type | Value | Description |
|------|-------|-------------|
| PRIVATE_MESSAGE | 0x40 | Encrypted private message |
| PRIVATE_ACK | 0x41 | Private message acknowledgment |

### Control Messages (0x60-0x6F)

| Type | Value | Description |
|------|-------|-------------|
| HEARTBEAT | 0x60 | Keep-alive message |
| PING | 0x61 | Ping request |
| PONG | 0x62 | Ping response |

### Fragment Messages (0x70-0x7F)

| Type | Value | Description |
|------|-------|-------------|
| FRAGMENT | 0x70 | Message fragment |

### Error Messages (0xFF)

| Type | Value | Description |
|------|-------|-------------|
| ERROR | 0xFF | Error notification |

## Message Flags

| Flag | Value | Description |
|------|-------|-------------|
| NONE | 0x00 | No flags |
| ENCRYPTED | 0x01 | Payload is encrypted |
| COMPRESSED | 0x02 | Payload is compressed |
| REQUIRES_ACK | 0x04 | Acknowledgment requested |
| IS_FRAGMENT | 0x08 | Message is a fragment |
| IS_BROADCAST | 0x10 | Broadcast message |
| HIGH_PRIORITY | 0x20 | High priority delivery |

## Routing

### Hop Count

- Messages include current `hopCount` and `maxHops`
- On relay, `hopCount` is incremented
- Messages with `hopCount >= maxHops` are not relayed
- Default `maxHops` is 7

### Duplicate Detection

- Bloom filter for fast probabilistic detection
- LRU cache for verification
- Messages seen before are dropped

### Route Discovery

- Routes learned from received messages
- Route table maps destination to next hop
- Routes expire after 10 minutes

## Fragmentation

### Fragment Header

For messages exceeding MTU:

- `fragmentIndex`: 0-based index of this fragment
- `fragmentTotal`: Total number of fragments
- Same `messageId` across all fragments

### Reassembly

- Receiver buffers fragments by `messageId`
- Fragments can arrive out of order
- Incomplete sets timeout after 60 seconds
- Payload reassembled in order

## Handshake Protocol

### Noise XX Pattern

```
-> e                    (32 bytes)
<- e, ee, s, es         (32 + 48 bytes)
-> s, se                (48 bytes)
```

### Message 1 Payload

- Initiator ephemeral public key (32 bytes)

### Message 2 Payload

- Responder ephemeral public key (32 bytes)
- Encrypted responder static public key (32 + 16 tag)

### Message 3 Payload

- Encrypted initiator static public key (32 + 16 tag)

## BLE Characteristics

### Service UUID

```
6E400001-B5A3-F393-E0A9-E50E24DCCA9E
```

### TX Characteristic (Write)

```
6E400002-B5A3-F393-E0A9-E50E24DCCA9E
```

### RX Characteristic (Notify)

```
6E400003-B5A3-F393-E0A9-E50E24DCCA9E
```

## Serialization

- All multi-byte integers are big-endian
- UUIDs serialized as 16 bytes (no dashes)
- Strings encoded as UTF-8
- CRC32 uses polynomial 0xEDB88320

## Version Compatibility

- Version 1 is the initial protocol version
- Future versions maintain backward compatibility
- Unknown message types are ignored
