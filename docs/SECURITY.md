# Security Documentation

## Overview

The BLE Mesh Network library implements end-to-end encryption using the Noise Protocol Framework with carefully chosen cryptographic primitives.

## Threat Model

### In Scope

- **Passive Eavesdropping**: Attackers can observe all BLE traffic
- **Active MITM**: Attackers can intercept and modify messages
- **Replay Attacks**: Attackers can record and replay messages
- **Identity Spoofing**: Attackers can attempt to impersonate peers

### Out of Scope

- **Physical Device Compromise**: Attacker has physical access to device
- **Side-Channel Attacks**: Timing attacks, power analysis
- **Denial of Service**: Resource exhaustion attacks
- **Traffic Analysis**: Message timing and size patterns

## Cryptographic Primitives

### Key Exchange: X25519

- Elliptic Curve Diffie-Hellman on Curve25519
- 128-bit security level
- Fast, constant-time implementation
- RFC 7748 compliant

### Encryption: ChaCha20-Poly1305

- ChaCha20 stream cipher for encryption
- Poly1305 MAC for authentication
- Combined AEAD construction
- RFC 8439 compliant
- 256-bit key, 96-bit nonce, 128-bit tag

### Hash Function: SHA-256

- FIPS 180-4 compliant
- Used in HKDF for key derivation
- Used in Noise Protocol for transcript hashing

## Noise Protocol XX

### Pattern

```
XX:
  -> e
  <- e, ee, s, es
  -> s, se
```

### Security Properties

1. **Mutual Authentication**: Both parties prove possession of static keys
2. **Forward Secrecy**: Ephemeral keys provide protection for past sessions
3. **Identity Hiding**: Static public keys are encrypted
4. **Replay Protection**: Handshake transcript binding prevents replay

### Message Flow

1. **Message 1** (Initiator → Responder):
   - Initiator sends ephemeral public key `e`
   - Unencrypted, establishes initial key material

2. **Message 2** (Responder → Initiator):
   - Responder sends ephemeral public key `e`
   - Performs DH: `ee = DH(e_responder, e_initiator)`
   - Sends encrypted static public key `s`
   - Performs DH: `es = DH(e_initiator, s_responder)`

3. **Message 3** (Initiator → Responder):
   - Initiator sends encrypted static public key `s`
   - Performs DH: `se = DH(s_initiator, e_responder)`
   - Session keys derived

## Key Management

### Identity Keys

- Generated using cryptographically secure random number generator
- 32-byte X25519 secret key
- Should be stored in secure storage (Keychain/Keystore)

### Session Keys

- Derived from Noise handshake
- Separate keys for send and receive directions
- 32-byte ChaCha20 keys

### Nonce Management

- 64-bit counter, incremented per message
- Maximum 2^64 messages per session
- Session must be rekeyed before exhaustion

## Implementation Security

### Constant-Time Operations

- Tag comparison uses constant-time comparison
- Prevents timing attacks on authentication

### Key Zeroing

- Sensitive key material zeroed after use
- `KeyPair.destroy()` overwrites secret keys

### No Secrets in Logs

- Error messages never contain key material
- Debug output sanitized

## Security Recommendations

1. **Store Identity Keys Securely**
   - Use platform secure storage (iOS Keychain, Android Keystore)
   - Never export keys to plaintext storage

2. **Verify Peer Identity**
   - Display public key fingerprints to users
   - Allow users to verify out-of-band

3. **Handle Session Expiry**
   - Implement session timeout
   - Rekey on reconnection

4. **Monitor for Anomalies**
   - Track failed handshakes
   - Alert on repeated failures

## Known Limitations

1. **No Post-Quantum Security**: X25519 is vulnerable to quantum computers
2. **No Deniability**: Messages can be proven to come from a specific key
3. **No Group Key Agreement**: Channels use pairwise encryption
4. **Metadata Exposure**: Message timing and sizes are visible

## Audit Status

This library has not been independently audited. Use in production at your own risk.

## References

- [Noise Protocol Framework](https://noiseprotocol.org/)
- [RFC 7748 - X25519](https://tools.ietf.org/html/rfc7748)
- [RFC 8439 - ChaCha20-Poly1305](https://tools.ietf.org/html/rfc8439)
- [FIPS 180-4 - SHA-256](https://csrc.nist.gov/publications/detail/fips/180/4/final)
