'use strict';

/**
 * Noise Protocol Module
 * Re-exports all Noise Protocol components.
 * @module crypto/noise
 */

const { SymmetricState, PROTOCOL_NAME } = require('./state');
const { NoiseHandshake, HandshakeState, Role } = require('./handshake');
const { NoiseSession, MAX_NONCE, REKEY_THRESHOLD } = require('./session');

module.exports = {
  // State management
  SymmetricState,
  PROTOCOL_NAME,

  // Handshake
  NoiseHandshake,
  HandshakeState,
  Role,

  // Transport session
  NoiseSession,
  MAX_NONCE,
  REKEY_THRESHOLD
};
