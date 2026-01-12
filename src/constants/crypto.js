/**
 * @fileoverview Cryptographic constants
 * @module constants/crypto
 */

'use strict';

/**
 * Cryptographic configuration
 * @constant {Object.<string, number|string>}
 */
const CRYPTO_CONFIG = Object.freeze({
  /** Key size in bytes (256 bits) */
  KEY_SIZE: 32,
  /** Nonce size in bytes (96 bits) */
  NONCE_SIZE: 12,
  /** Authentication tag size in bytes (128 bits) */
  TAG_SIZE: 16,
  /** Public key size in bytes (256 bits) */
  PUBLIC_KEY_SIZE: 32,
  /** Hash output size in bytes (256 bits) */
  HASH_SIZE: 32,
  /** HMAC block size in bytes */
  HMAC_BLOCK_SIZE: 64,
  /** Maximum nonce value before rekey */
  MAX_NONCE: Number.MAX_SAFE_INTEGER
});

/**
 * Noise Protocol name
 * XX pattern with X25519, ChaChaPoly, and SHA256
 * @constant {string}
 */
const NOISE_PROTOCOL_NAME = 'Noise_XX_25519_ChaChaPoly_SHA256';

/**
 * Noise handshake states
 * @constant {Object.<string, string>}
 */
const NOISE_HANDSHAKE_STATE = Object.freeze({
  INITIAL: 'initial',
  AWAITING_MESSAGE_1: 'awaitingMessage1',
  AWAITING_MESSAGE_2: 'awaitingMessage2',
  AWAITING_MESSAGE_3: 'awaitingMessage3',
  COMPLETE: 'complete',
  FAILED: 'failed'
});

module.exports = {
  CRYPTO_CONFIG,
  NOISE_PROTOCOL_NAME,
  NOISE_HANDSHAKE_STATE
};
