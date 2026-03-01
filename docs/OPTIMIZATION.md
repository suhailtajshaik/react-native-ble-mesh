# Performance Optimization Guide

## v2.1.0 Performance Overhaul

Version 2.1.0 is a comprehensive performance optimization release targeting React Native speed, reduced GC pressure, and elimination of memory leaks. All changes are non-breaking.

### Key Principles Applied

1. **Zero-copy where possible** — Use `Uint8Array.subarray()` instead of `slice()` for read-only views
2. **Cache singletons** — `TextEncoder`, `TextDecoder`, crypto providers, hex lookup tables
3. **Avoid allocation in hot paths** — Inline computations, reuse buffers, pre-compute constants
4. **O(1) over O(n)** — Circular buffers, running sums, pre-computed Sets
5. **Clean up resources** — Clear timers, remove event listeners, bound map growth

---

## Hot Path Optimizations

### Message Processing Pipeline

Every message flows through: transport → deserialize → dedup → route → serialize → transport. Each stage was optimized:

| Stage | Before | After | Improvement |
|-------|--------|-------|-------------|
| Deserialize header | 3x `slice()` copies | 0 copies (`subarray()`) | ~3x fewer allocations |
| Deserialize payload | 1x `slice()` copy | 0 copies (`subarray()`) | Zero-copy payload |
| CRC32 checksum | `slice(0, 44)` copy | `subarray(0, 44)` view | Zero-copy |
| BloomFilter check | `new TextEncoder()` + array alloc | Cached encoder, inlined positions | 3 fewer allocations/msg |
| BloomFilter fill ratio | O(n) bit scan | O(1) running counter | Constant time |
| Serialize header | `slice(0, 44)` for CRC | `subarray(0, 44)` view | Zero-copy |
| Hex conversion | `Array.from().map().join()` | Pre-computed lookup table | ~5x faster |
| UUID generation | 16 temp strings + join | Hex table + concatenation | ~3x faster |
| Encrypt/Decrypt nonce | `new Uint8Array(24)` per call | Pre-allocated per session | 0 allocations |

### TextEncoder/TextDecoder Caching

Before v2.1.0, `new TextEncoder()` was called on every:
- Message validation (byte length check)
- Message encoding (broadcast, private, channel)
- BloomFilter dedup check (string → bytes)
- File chunk encoding (per-chunk in loop!)
- Protocol serialization (string payloads)
- Read receipt handling (per-receipt in loop)

Now: **One singleton per module**, created once at import time.

### Crypto Provider Caching

- `AutoCrypto.detectProvider()` — Now caches the singleton result
- `QuickCryptoProvider` — Caches `require('tweetnacl')` result instead of calling per encrypt/decrypt
- DER header buffers for X25519 — Hoisted to module level (were re-created from hex per handshake)

---

## Memory Leak Fixes

### Timer Leaks

| Location | Issue | Fix |
|----------|-------|-----|
| `MeshNetwork.sendFile()` | Per-chunk timeout timers never cleared on success | `clearTimeout()` in both success/error paths |
| `DedupManager._resetBloomFilter()` | Grace period timer leaked on repeated resets | Store timer ID, clear on reset/destroy |

### Event Listener Leaks

| Location | Issue | Fix |
|----------|-------|-----|
| `MultiTransport._wireTransport()` | Handlers never removed across start/stop | Store references, remove in `stop()` |
| `useMesh.js` initialize | Listeners stacked on re-init | Store in refs, remove old before adding new |
| `AppStateManager` | `.bind()` per initialize, old subscription not removed | Bind once in constructor, remove old sub |

### Unbounded Growth

| Location | Issue | Fix |
|----------|-------|-----|
| `NetworkMonitor._pendingMessages` | Undelivered messages never removed | Cleanup entries older than `nodeTimeoutMs` |
| `ConnectionQuality._peers` | Timer runs with 0 peers | Stop timer when last peer removed |
| `BLETransport.disconnectFromPeer()` | Write queue/writing maps not cleaned | Added cleanup in disconnect |

---

## Data Structure Improvements

### Circular Buffers (O(n) → O(1))

`Array.shift()` is O(n) because it re-indexes all elements. For sliding windows that shift on every sample, this was a significant cost.

**Replaced with circular buffers:**
- `NetworkMonitor._latencies` → `Float64Array` ring buffer with running sum
- `ConnectionQuality._rssiSamples` → `Float64Array` ring buffer with running sum
- `ConnectionQuality._latencySamples` → `Float64Array` ring buffer with running sum

Average computation is now O(1) via running sum instead of O(n) `reduce()`.

### Pre-Computed Sets (O(n) → O(1))

`Object.values(ENUM).includes(value)` creates an array and does linear scan on every call.

**Replaced with module-level `Set`s:**
- `Peer.setConnectionState()` — `CONNECTION_STATE_SET.has(state)`
- `BatteryOptimizer.setMode()` — `BATTERY_MODE_SET.has(mode)`

### Direct Map Iteration

`Array.from(map.values()).filter(...)` creates two arrays. Direct iteration creates one:

```js
// Before (2 arrays)
getConnectedPeers() { return this.getAllPeers().filter(p => p.isConnected()); }

// After (1 array)
getConnectedPeers() {
  const result = [];
  for (const peer of this._peers.values()) {
    if (peer.isConnected()) result.push(peer);
  }
  return result;
}
```

Applied to: `PeerManager.getConnectedPeers()`, `getSecuredPeers()`, `getDirectPeers()`

---

## React Native Hook Optimizations

### usePeers — Eliminated Double Re-render

Before: Every peer event called both `setPeers()` and `setLastUpdate(Date.now())`, causing two re-renders (React may batch, but not always across async boundaries).

After: `lastUpdate` is a `useRef` (no re-render). Added shallow comparison to skip `setPeers()` when peers haven't actually changed.

Also: `getPeer()` now uses a `useMemo` Map for O(1) lookup instead of O(n) `Array.find()`.

### useMessages — Reduced Array Copies

Before: 3 array copies per incoming message when over `maxMessages` (`[msg, ...prev]` + `slice(maxMessages)` + `slice(0, maxMessages)`).

After: 1 array copy + in-place truncation via `updated.length = maxMessages`.

---

## Storage Optimization

### MessageStore Payload Encoding

Before: `Array.from(Uint8Array)` converted each byte to a boxed JS Number — **8x memory bloat** (1 byte → 8 bytes for Number object + array overhead).

After: Base64 encoding. A 10KB payload uses ~13.3KB as base64 string (1.33x) instead of ~80KB as Number array (8x).

---

## Compression Optimization

### LZ4 Hash Table Reuse

Before: `new Int32Array(4096)` (16KB allocation) on every `_lz4Compress()` call.

After: Pre-allocated in constructor, reused with `.fill(-1)` reset per call.

---

## WiFi Direct Base64 Fix

### O(n^2) → O(n) String Building

Before: Character-by-character `binary += String.fromCharCode(bytes[i])` — O(n^2) due to string immutability.

After: Chunk-based `String.fromCharCode.apply(null, bytes.subarray(i, i+8192))` with final `join()` — O(n).

For a 1MB file transfer, this eliminates ~1 million intermediate string allocations.

---

## Historical Changes (v2.0.0)

### Crypto Module Removed
The pure JavaScript cryptographic implementations (`src/crypto/`) were removed in v2.0.0. Pure JS BigInt field arithmetic for X25519 was orders of magnitude slower than native:
- ~100ms+ per key exchange (vs ~1ms with native)
- Battery drain from CPU-intensive crypto
- UI thread blocking on Hermes/JSC

Replaced by the pluggable provider system: `tweetnacl`, `react-native-quick-crypto`, or `expo-crypto`.
