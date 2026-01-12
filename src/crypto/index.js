'use strict';

/**
 * Crypto Module
 * Main exports for all cryptographic primitives and protocols.
 * @module crypto
 */

// Hash functions
const { hash, createHash, HashContext } = require('./sha256');
const { hmacSha256, verifyHmac } = require('./hmac');
const { extract, expand, derive, deriveMultiple } = require('./hkdf');

// Symmetric encryption
const { chacha20, chacha20Block } = require('./chacha20');
const { poly1305 } = require('./poly1305');
const { encrypt, decrypt } = require('./aead');

// Asymmetric encryption (key exchange)
const { generateKeyPair, scalarMult, scalarMultBase } = require('./x25519');

// Noise Protocol
const noise = require('./noise');

// Key management
const keys = require('./keys');

module.exports = {
  // SHA-256
  hash,
  createHash,
  HashContext,

  // HMAC
  hmacSha256,
  verifyHmac,

  // HKDF
  hkdfExtract: extract,
  hkdfExpand: expand,
  hkdf: derive,
  hkdfMultiple: deriveMultiple,

  // ChaCha20
  chacha20,
  chacha20Block,

  // Poly1305
  poly1305,

  // AEAD (ChaCha20-Poly1305)
  encrypt,
  decrypt,

  // X25519
  generateKeyPair,
  scalarMult,
  scalarMultBase,

  // Noise Protocol (as namespace)
  noise,

  // Key management (as namespace)
  keys,

  // Re-export commonly used classes at top level
  NoiseHandshake: noise.NoiseHandshake,
  NoiseSession: noise.NoiseSession,
  SymmetricState: noise.SymmetricState,
  KeyPair: keys.KeyPair,
  KeyManager: keys.KeyManager
};
