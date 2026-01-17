'use strict';

/**
 * @fileoverview Session manager for Noise Protocol sessions
 * @module service/SessionManager
 */

const { CryptoError } = require('../errors');

/**
 * Manages Noise Protocol sessions for secure peer communication.
 * @class SessionManager
 */
class SessionManager {
  constructor() {
    this._sessions = new Map();
  }

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

  getSession(peerId) {
    const entry = this._sessions.get(peerId);
    return entry ? entry.session : undefined;
  }

  hasSession(peerId) { return this._sessions.has(peerId); }
  removeSession(peerId) { this._sessions.delete(peerId); }

  encryptFor(peerId, plaintext) {
    const entry = this._sessions.get(peerId);
    if (!entry) { throw CryptoError.encryptionFailed({ reason: 'Session not found', peerId }); }
    try {
      const ciphertext = entry.session.encrypt(plaintext);
      entry.lastUsedAt = Date.now();
      entry.messageCount++;
      return ciphertext;
    } catch (error) {
      throw CryptoError.encryptionFailed({ reason: error.message, peerId });
    }
  }

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
    } catch (error) {
      return null;
    }
  }

  exportSession(peerId) {
    const entry = this._sessions.get(peerId);
    if (!entry || typeof entry.session.export !== 'function') { return null; }
    return {
      peerId, sessionData: entry.session.export(),
      createdAt: entry.createdAt, lastUsedAt: entry.lastUsedAt, messageCount: entry.messageCount
    };
  }

  importSession(peerId, state) {
    if (!state || !state.sessionData) { throw new Error('Invalid session state'); }
    this._sessions.set(peerId, {
      session: state.sessionData,
      createdAt: state.createdAt || Date.now(),
      lastUsedAt: state.lastUsedAt || Date.now(),
      messageCount: state.messageCount || 0
    });
  }

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
