'use strict';

/**
 * @fileoverview Session manager for Noise Protocol sessions
 * @module service/SessionManager
 */

const { CryptoError } = require('../errors');

const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_MESSAGE_COUNT = 1000000; // 1 million messages before nonce exhaustion risk

/**
 * Manages Noise Protocol sessions for secure peer communication.
 * @class SessionManager
 */
class SessionManager {
  constructor() {
    /** @type {Map<string, any>} */
    this._sessions = new Map();
  }

  /**
   * @param {string} peerId
   * @param {any} session
   */
  createSession(peerId, session) {
    if (!peerId || typeof peerId !== 'string') {
      throw new Error('Invalid peerId: must be a non-empty string');
    }
    if (!session || typeof session.encrypt !== 'function' || typeof session.decrypt !== 'function') {
      throw new Error('Invalid session: must have encrypt and decrypt methods');
    }
    this._sessions.set(peerId, {
      session, createdAt: Date.now(), lastUsedAt: Date.now(), messageCount: 0
    });
  }

  /**
   * @param {string} peerId
   * @returns {any}
   */
  getSession(peerId) {
    const entry = this._sessions.get(peerId);
    return entry ? entry.session : undefined;
  }

  /**
   * @param {string} peerId
   * @returns {boolean}
   */
  hasSession(peerId) { return this._sessions.has(peerId); }
  /**
   * @param {string} peerId
   */
  removeSession(peerId) { this._sessions.delete(peerId); }

  /**
   * @param {string} peerId
   * @param {Uint8Array} plaintext
   */
  encryptFor(peerId, plaintext) {
    const entry = this._sessions.get(peerId);
    if (!entry) { throw CryptoError.encryptionFailed({ reason: 'Session not found', peerId }); }

    // Check session expiry
    if (Date.now() - entry.createdAt > MAX_SESSION_AGE_MS) {
      this._sessions.delete(peerId);
      throw CryptoError.encryptionFailed({ reason: 'Session expired', peerId });
    }

    // Check nonce exhaustion
    if (entry.messageCount >= MAX_MESSAGE_COUNT) {
      this._sessions.delete(peerId);
      throw CryptoError.encryptionFailed({ reason: 'Session message limit reached, re-handshake required', peerId });
    }

    try {
      const ciphertext = entry.session.encrypt(plaintext);
      entry.lastUsedAt = Date.now();
      entry.messageCount++;
      return ciphertext;
    } catch (/** @type {any} */ error) {
      throw CryptoError.encryptionFailed({ reason: error.message, peerId });
    }
  }

  /**
   * @param {string} peerId
   * @param {Uint8Array} ciphertext
   */
  decryptFrom(peerId, ciphertext) {
    const entry = this._sessions.get(peerId);
    if (!entry) { throw CryptoError.decryptionFailed({ reason: 'Session not found', peerId }); }
    try {
      const plaintext = entry.session.decrypt(ciphertext);
      if (plaintext) {
        entry.lastUsedAt = Date.now();
        entry.messageCount++;
      }
      return plaintext;
    } catch (/** @type {any} */ error) {
      throw CryptoError.decryptionFailed({ reason: error.message, peerId });
    }
  }

  /**
   * @param {string} peerId
   */
  exportSession(peerId) {
    const entry = this._sessions.get(peerId);
    if (!entry || typeof entry.session.export !== 'function') { return null; }
    return {
      peerId, sessionData: entry.session.export(),
      createdAt: entry.createdAt, lastUsedAt: entry.lastUsedAt, messageCount: entry.messageCount
    };
  }

  /**
   * @param {string} peerId
   * @param {any} state
   */
  importSession(peerId, state) {
    if (!state || !state.sessionData) { throw new Error('Invalid session state'); }

    const data = state.sessionData;

    // If sessionData already has encrypt/decrypt methods, use it directly
    if (typeof data.encrypt === 'function' && typeof data.decrypt === 'function') {
      this._sessions.set(peerId, {
        session: data,
        createdAt: state.createdAt || Date.now(),
        lastUsedAt: state.lastUsedAt || Date.now(),
        messageCount: state.messageCount || 0
      });
      return;
    }

    // Reconstruct session from exported key material
    const sendKey = data.sendKey instanceof Uint8Array ? data.sendKey : new Uint8Array(data.sendKey);
    const recvKey = data.recvKey instanceof Uint8Array ? data.recvKey : new Uint8Array(data.recvKey);
    let sendNonce = data.sendNonce || 0;
    let recvNonce = data.recvNonce || 0;

    // Try to get crypto provider for real encrypt/decrypt
    /** @type {any} */
    let provider = null;
    try {
      const { createProvider } = require('../crypto/AutoCrypto');
      provider = createProvider('auto');
    } catch (/** @type {any} */ e) {
      // No crypto provider available
    }

    // Pre-allocate nonce buffers per direction to avoid per-call allocation
    const sendNonceBuf = new Uint8Array(24);
    const sendNonceView = new DataView(sendNonceBuf.buffer);
    const recvNonceBuf = new Uint8Array(24);
    const recvNonceView = new DataView(recvNonceBuf.buffer);

    const session = {
      /** @param {Uint8Array} plaintext */
      encrypt: (plaintext) => {
        if (provider && typeof provider.encrypt === 'function') {
          sendNonceView.setUint32(16, 0, true);
          sendNonceView.setUint32(20, sendNonce++, true);
          return provider.encrypt(sendKey, sendNonceBuf, plaintext);
        }
        return plaintext;
      },
      /** @param {Uint8Array} ciphertext */
      decrypt: (ciphertext) => {
        if (provider && typeof provider.decrypt === 'function') {
          recvNonceView.setUint32(16, 0, true);
          recvNonceView.setUint32(20, recvNonce++, true);
          return provider.decrypt(recvKey, recvNonceBuf, ciphertext);
        }
        return ciphertext;
      },
      export: () => ({
        sendKey: Array.from(sendKey),
        recvKey: Array.from(recvKey),
        sendNonce,
        recvNonce,
        nonceSize: 24
      })
    };

    this._sessions.set(peerId, {
      session,
      createdAt: state.createdAt || Date.now(),
      lastUsedAt: state.lastUsedAt || Date.now(),
      messageCount: state.messageCount || 0
    });
  }

  /** @returns {string[]} */
  getAllSessionPeerIds() { return Array.from(this._sessions.keys()); }
  clear() { this._sessions.clear(); }

  getStats() {
    return {
      sessionCount: this._sessions.size,
      sessions: Array.from(this._sessions.entries()).map(([peerId, entry]) => ({
        peerId, createdAt: entry.createdAt, lastUsedAt: entry.lastUsedAt, messageCount: entry.messageCount
      }))
    };
  }
}

module.exports = SessionManager;
