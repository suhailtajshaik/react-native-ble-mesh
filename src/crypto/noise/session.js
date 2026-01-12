'use strict';

/**
 * Noise Protocol Transport Session
 * Handles encrypted communication after a successful handshake.
 * @module crypto/noise/session
 */

const { encrypt, decrypt } = require('../aead');

/**
 * Maximum nonce value before requiring rekey (2^64 - 1 as safe integer)
 * In practice, we use a lower limit to ensure safety
 * @constant {number}
 */
const MAX_NONCE = Number.MAX_SAFE_INTEGER;

/**
 * Nonce threshold for rekey warning
 * @constant {number}
 */
const REKEY_THRESHOLD = 0xFFFFFFFF; // 2^32 - 1

/**
 * NoiseSession handles encrypted transport after handshake completion.
 *
 * Each direction has its own key and nonce counter:
 * - sendKey/sendNonce for outgoing messages
 * - receiveKey/receiveNonce for incoming messages
 *
 * @class
 */
class NoiseSession {
  /**
   * Creates a new NoiseSession.
   * @param {Uint8Array} sendKey - 32-byte key for sending
   * @param {Uint8Array} receiveKey - 32-byte key for receiving
   * @param {boolean} isInitiator - True if this is the initiator's session
   */
  constructor(sendKey, receiveKey, isInitiator) {
    if (!(sendKey instanceof Uint8Array) || sendKey.length !== 32) {
      throw new Error('Send key must be 32 bytes');
    }
    if (!(receiveKey instanceof Uint8Array) || receiveKey.length !== 32) {
      throw new Error('Receive key must be 32 bytes');
    }

    /** @type {Uint8Array} */
    this._sendKey = new Uint8Array(sendKey);

    /** @type {Uint8Array} */
    this._receiveKey = new Uint8Array(receiveKey);

    /** @type {number} */
    this._sendNonce = 0;

    /** @type {number} */
    this._receiveNonce = 0;

    /** @type {boolean} */
    this._isInitiator = isInitiator;

    /** @type {boolean} */
    this._established = true;
  }

  /**
   * Gets the current send nonce.
   * @returns {number} Current send nonce value
   */
  get sendNonce() {
    return this._sendNonce;
  }

  /**
   * Gets the current receive nonce.
   * @returns {number} Current receive nonce value
   */
  get receiveNonce() {
    return this._receiveNonce;
  }

  /**
   * Encrypts a message for sending.
   * @param {Uint8Array} plaintext - Message to encrypt
   * @returns {Uint8Array} Encrypted message with authentication tag
   * @throws {Error} If nonce overflow or session not established
   */
  encrypt(plaintext) {
    if (!this._established) {
      throw new Error('Session not established');
    }
    if (!(plaintext instanceof Uint8Array)) {
      throw new Error('Plaintext must be a Uint8Array');
    }
    if (this._sendNonce >= MAX_NONCE) {
      throw new Error('Send nonce overflow - session must be rekeyed');
    }

    const nonce = this._createNonce(this._sendNonce);
    this._sendNonce++;

    // Warn if approaching nonce limit
    if (this._sendNonce === REKEY_THRESHOLD) {
      console.warn('NoiseSession: Approaching send nonce limit, rekey recommended');
    }

    return encrypt(this._sendKey, nonce, plaintext);
  }

  /**
   * Decrypts a received message.
   * @param {Uint8Array} ciphertext - Encrypted message with authentication tag
   * @returns {Uint8Array|null} Decrypted plaintext, or null if authentication fails
   * @throws {Error} If nonce overflow or session not established
   */
  decrypt(ciphertext) {
    if (!this._established) {
      throw new Error('Session not established');
    }
    if (!(ciphertext instanceof Uint8Array)) {
      throw new Error('Ciphertext must be a Uint8Array');
    }
    if (ciphertext.length < 16) {
      throw new Error('Ciphertext too short (minimum 16 bytes for tag)');
    }
    if (this._receiveNonce >= MAX_NONCE) {
      throw new Error('Receive nonce overflow - session must be rekeyed');
    }

    const nonce = this._createNonce(this._receiveNonce);
    const plaintext = decrypt(this._receiveKey, nonce, ciphertext);

    if (plaintext !== null) {
      this._receiveNonce++;

      // Warn if approaching nonce limit
      if (this._receiveNonce === REKEY_THRESHOLD) {
        console.warn('NoiseSession: Approaching receive nonce limit, rekey recommended');
      }
    }

    return plaintext;
  }

  /**
   * Checks if the session is established and ready for use.
   * @returns {boolean} True if session is established
   */
  isEstablished() {
    return this._established;
  }

  /**
   * Exports the session state for persistence.
   * WARNING: Contains sensitive key material, handle with care.
   * @returns {object} Session state object
   */
  exportState() {
    return {
      sendKey: Array.from(this._sendKey),
      receiveKey: Array.from(this._receiveKey),
      sendNonce: this._sendNonce,
      receiveNonce: this._receiveNonce,
      isInitiator: this._isInitiator,
      established: this._established
    };
  }

  /**
   * Creates a NoiseSession from exported state.
   * @param {object} state - Previously exported session state
   * @returns {NoiseSession} Restored session
   * @throws {Error} If state is invalid
   */
  static importState(state) {
    if (!state || typeof state !== 'object') {
      throw new Error('Invalid session state');
    }

    const requiredFields = [
      'sendKey', 'receiveKey', 'sendNonce', 'receiveNonce', 'isInitiator'
    ];
    for (const field of requiredFields) {
      if (!(field in state)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    const sendKey = new Uint8Array(state.sendKey);
    const receiveKey = new Uint8Array(state.receiveKey);

    if (sendKey.length !== 32 || receiveKey.length !== 32) {
      throw new Error('Invalid key length in state');
    }

    const session = new NoiseSession(sendKey, receiveKey, state.isInitiator);
    session._sendNonce = state.sendNonce;
    session._receiveNonce = state.receiveNonce;
    session._established = state.established !== false;

    return session;
  }

  /**
   * Destroys the session, zeroing sensitive key material.
   */
  destroy() {
    this._sendKey.fill(0);
    this._receiveKey.fill(0);
    this._sendNonce = 0;
    this._receiveNonce = 0;
    this._established = false;
  }

  /**
   * Creates a 12-byte nonce from a counter value.
   * Format: 4 zero bytes + 8-byte little-endian counter
   * @param {number} counter - Nonce counter value
   * @returns {Uint8Array} 12-byte nonce
   * @private
   */
  _createNonce(counter) {
    const nonce = new Uint8Array(12);
    const view = new DataView(nonce.buffer);
    // First 4 bytes are zero
    // Next 8 bytes are little-endian counter
    view.setUint32(4, counter >>> 0, true);
    view.setUint32(8, Math.floor(counter / 0x100000000) >>> 0, true);
    return nonce;
  }

  /**
   * Gets session statistics.
   * @returns {object} Session statistics
   */
  getStats() {
    return {
      messagesSent: this._sendNonce,
      messagesReceived: this._receiveNonce,
      isInitiator: this._isInitiator,
      established: this._established,
      sendNonceRemaining: MAX_NONCE - this._sendNonce,
      receiveNonceRemaining: MAX_NONCE - this._receiveNonce
    };
  }
}

module.exports = {
  NoiseSession,
  MAX_NONCE,
  REKEY_THRESHOLD
};
