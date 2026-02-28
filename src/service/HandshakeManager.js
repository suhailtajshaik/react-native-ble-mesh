'use strict';

/**
 * @fileoverview Handshake orchestration for Noise Protocol XX pattern
 * @module service/HandshakeManager
 */

const EventEmitter = require('../utils/EventEmitter');
const { HandshakeError } = require('../errors');
const { MESSAGE_TYPE, MESH_CONFIG, EVENTS } = require('../constants');
const { randomBytes, concat } = require('../utils/bytes');

const STATE = Object.freeze({
  IDLE: 'idle', INITIATOR_WAITING: 'initiator_waiting',
  RESPONDER_WAITING: 'responder_waiting', COMPLETE: 'complete', FAILED: 'failed'
});

/**
 * Manages Noise Protocol XX handshakes between peers.
 * @class HandshakeManager
 * @extends EventEmitter
 */
class HandshakeManager extends EventEmitter {
  constructor(keyManager, sessionManager) {
    super();
    if (!keyManager || !sessionManager) { throw new Error('keyManager and sessionManager required'); }
    this._keyManager = keyManager;
    this._sessionManager = sessionManager;
    this._pending = new Map();
    this._timeout = MESH_CONFIG.HANDSHAKE_TIMEOUT_MS;
  }

  async initiateHandshake(peerId, transport) {
    if (this._pending.has(peerId)) { throw HandshakeError.alreadyInProgress(peerId); }

    const hs = this._createState(peerId, true);
    this._pending.set(peerId, hs);
    this.emit(EVENTS.HANDSHAKE_STARTED, { peerId, role: 'initiator' });

    try {
      const msg1 = hs.noise.writeMessage1();
      await transport.send(peerId, this._wrap(MESSAGE_TYPE.HANDSHAKE_INIT, msg1));
      hs.state = STATE.INITIATOR_WAITING;
      hs.step = 1;
      this.emit(EVENTS.HANDSHAKE_PROGRESS, { peerId, step: 1, role: 'initiator' });
      return await this._waitForCompletion(peerId);
    } catch (err) {
      this._fail(peerId, err);
      throw err;
    }
  }

  async handleIncomingHandshake(peerId, type, payload, transport) {
    try {
      if (type === MESSAGE_TYPE.HANDSHAKE_INIT) {
        return await this._onInit(peerId, payload, transport);
      }
      if (type === MESSAGE_TYPE.HANDSHAKE_RESPONSE) {
        return await this._onResponse(peerId, payload, transport);
      }
      if (type === MESSAGE_TYPE.HANDSHAKE_FINAL) {
        return await this._onFinal(peerId, payload);
      }
      throw HandshakeError.handshakeFailed(peerId, null, { reason: 'Unknown type' });
    } catch (err) {
      this._fail(peerId, err);
      throw err;
    }
  }

  cancelHandshake(peerId) {
    const hs = this._pending.get(peerId);
    if (!hs) { return; }
    if (hs.timer) { clearTimeout(hs.timer); }
    if (hs.reject) { hs.reject(HandshakeError.handshakeFailed(peerId, hs.step)); }
    this._pending.delete(peerId);
    this.emit(EVENTS.HANDSHAKE_FAILED, { peerId, reason: 'cancelled' });
  }

  isHandshakePending(peerId) { return this._pending.has(peerId); }
  getPendingCount() { return this._pending.size; }

  _createState(peerId, isInitiator) {
    const kp = this._keyManager.getStaticKeyPair();
    return {
      peerId, isInitiator, noise: this._createNoise(kp, isInitiator),
      state: STATE.IDLE, step: 0, startedAt: Date.now(), timer: null, resolve: null, reject: null
    };
  }

  _createNoise(keyPair, isInitiator) {
    // Get crypto provider from keyManager if available
    const provider = this._keyManager.provider;

    // Generate ephemeral key pair for this handshake
    let ephemeralKeyPair;
    if (provider && typeof provider.generateKeyPair === 'function') {
      ephemeralKeyPair = provider.generateKeyPair();
    } else {
      // Fallback to random keys if no provider available
      ephemeralKeyPair = { publicKey: randomBytes(32), secretKey: randomBytes(32) };
    }

    let remoteEphemeralPublic = null;
    let sharedSecret = null;
    let sessionKeys = null;
    let complete = false;

    const deriveSessionKeys = (secret) => {
      // Derive send/receive keys from shared secret
      // Use hash to derive two different keys from the secret
      if (provider && typeof provider.hash === 'function') {
        const h1 = provider.hash(concat(secret, new Uint8Array([0x01])));
        const h2 = provider.hash(concat(secret, new Uint8Array([0x02])));
        return isInitiator
          ? { sendKey: h1, recvKey: h2 }
          : { sendKey: h2, recvKey: h1 };
      }
      throw new Error('Crypto provider required for key derivation. Install tweetnacl: npm install tweetnacl');
    };

    return {
      writeMessage1: () => {
        // Initiator sends ephemeral public key
        return ephemeralKeyPair.publicKey;
      },

      readMessage1: (msg) => {
        // Responder receives initiator's ephemeral public key
        remoteEphemeralPublic = new Uint8Array(msg);
      },

      writeMessage2: () => {
        // Responder sends ephemeral public key and derives shared secret
        if (provider && typeof provider.sharedSecret === 'function') {
          sharedSecret = provider.sharedSecret(ephemeralKeyPair.secretKey, remoteEphemeralPublic);
        } else {
          throw new Error('Crypto provider required for secure handshake. Install tweetnacl: npm install tweetnacl');
        }
        sessionKeys = deriveSessionKeys(sharedSecret);
        return ephemeralKeyPair.publicKey;
      },

      readMessage2: (msg) => {
        // Initiator receives responder's ephemeral public key and derives shared secret
        remoteEphemeralPublic = new Uint8Array(msg);
        if (provider && typeof provider.sharedSecret === 'function') {
          sharedSecret = provider.sharedSecret(ephemeralKeyPair.secretKey, remoteEphemeralPublic);
        } else {
          throw new Error('Crypto provider required for secure handshake. Install tweetnacl: npm install tweetnacl');
        }
        sessionKeys = deriveSessionKeys(sharedSecret);
      },

      writeMessage3: () => {
        // Initiator confirms handshake completion
        complete = true;
        return ephemeralKeyPair.publicKey;
      },

      readMessage3: (_msg) => {
        // Responder confirms handshake completion
        complete = true;
      },

      isComplete: () => complete,

      getRemotePublicKey: () => remoteEphemeralPublic || new Uint8Array(32),

      getSession: () => {
        if (!sessionKeys) {
          throw new Error('Handshake not complete');
        }

        const sendKey = sessionKeys.sendKey;
        const recvKey = sessionKeys.recvKey;
        let sendNonce = 0;
        let recvNonce = 0;

        return {
          encrypt: (plaintext) => {
            if (provider && typeof provider.encrypt === 'function') {
              // Use proper AEAD encryption with nonce
              const nonce = new Uint8Array(24); // tweetnacl uses 24-byte nonces
              const view = new DataView(nonce.buffer);
              // Store counter in last 8 bytes of nonce
              if (nonce.byteLength >= 8) {
                view.setUint32(nonce.byteLength - 8, 0, true);
                view.setUint32(nonce.byteLength - 4, sendNonce++, true);
              }
              return provider.encrypt(sendKey, nonce, plaintext);
            }
            throw new Error('Crypto provider required for encryption');
          },

          decrypt: (ciphertext) => {
            if (provider && typeof provider.decrypt === 'function') {
              // Use proper AEAD decryption with nonce
              const nonce = new Uint8Array(24);
              const view = new DataView(nonce.buffer);
              if (nonce.byteLength >= 8) {
                view.setUint32(nonce.byteLength - 8, 0, true);
                view.setUint32(nonce.byteLength - 4, recvNonce++, true);
              }
              return provider.decrypt(recvKey, nonce, ciphertext);
            }
            throw new Error('Crypto provider required for encryption');
          },

          export: () => ({
            sendKey: Array.from(sendKey),
            recvKey: Array.from(recvKey),
            sendNonce,
            recvNonce,
            nonceSize: 24
          })
        };
      }
    };
  }

  async _onInit(peerId, payload, transport) {
    const existing = this._pending.get(peerId);

    if (existing) {
      // Tie-breaking: compare public keys, lower key becomes responder
      const localKey = this._keyManager.getPublicKey();
      const shouldYield = this._compareKeys(localKey, peerId) > 0;

      if (shouldYield) {
        // Cancel our outgoing handshake and accept incoming
        this.cancelHandshake(peerId);
      } else {
        // Keep our outgoing, reject incoming
        throw HandshakeError.alreadyInProgress(peerId);
      }
    }

    const hs = this._createState(peerId, false);
    this._pending.set(peerId, hs);
    this.emit(EVENTS.HANDSHAKE_STARTED, { peerId, role: 'responder' });
    hs.noise.readMessage1(payload);
    const msg2 = hs.noise.writeMessage2();
    await transport.send(peerId, this._wrap(MESSAGE_TYPE.HANDSHAKE_RESPONSE, msg2));
    hs.state = STATE.RESPONDER_WAITING;
    hs.step = 2;
    this.emit(EVENTS.HANDSHAKE_PROGRESS, { peerId, step: 2, role: 'responder' });
    this._setTimeout(peerId);
    return null;
  }

  async _onResponse(peerId, payload, transport) {
    const hs = this._pending.get(peerId);
    if (!hs || !hs.isInitiator) {
      throw HandshakeError.invalidState(peerId, 2);
    }
    hs.noise.readMessage2(payload);
    const msg3 = hs.noise.writeMessage3();
    await transport.send(peerId, this._wrap(MESSAGE_TYPE.HANDSHAKE_FINAL, msg3));
    hs.step = 3;
    this.emit(EVENTS.HANDSHAKE_PROGRESS, { peerId, step: 3, role: 'initiator' });
    return this._complete(peerId, hs);
  }

  async _onFinal(peerId, payload) {
    const hs = this._pending.get(peerId);
    if (!hs || hs.isInitiator) { throw HandshakeError.invalidState(peerId, 3); }
    hs.noise.readMessage3(payload);
    hs.step = 3;
    return this._complete(peerId, hs);
  }

  _complete(peerId, hs) {
    if (hs.timer) { clearTimeout(hs.timer); }
    const session = hs.noise.getSession();
    this._sessionManager.createSession(peerId, session);
    hs.state = STATE.COMPLETE;
    this._pending.delete(peerId);
    if (hs.resolve) { hs.resolve(session); }
    this.emit(EVENTS.HANDSHAKE_COMPLETE, {
      peerId, remotePublicKey: hs.noise.getRemotePublicKey(), duration: Date.now() - hs.startedAt
    });
    return session;
  }

  _fail(peerId, error) {
    const hs = this._pending.get(peerId);
    if (hs) {
      if (hs.timer) { clearTimeout(hs.timer); }
      hs.state = STATE.FAILED;
      this._pending.delete(peerId);
    }
    this.emit(EVENTS.HANDSHAKE_FAILED, { peerId, error: error.message, step: hs?.step });
  }

  _setTimeout(peerId) {
    const hs = this._pending.get(peerId);
    if (!hs) { return; }
    hs.timer = setTimeout(() => {
      const h = this._pending.get(peerId);
      if (h?.reject) { h.reject(HandshakeError.handshakeTimeout(peerId, h.step)); }
      this._fail(peerId, HandshakeError.handshakeTimeout(peerId));
    }, this._timeout);
  }

  _waitForCompletion(peerId) {
    return new Promise((resolve, reject) => {
      const hs = this._pending.get(peerId);
      if (!hs) { return reject(HandshakeError.handshakeFailed(peerId)); }
      hs.resolve = resolve;
      hs.reject = reject;
      this._setTimeout(peerId);
    });
  }

  _compareKeys(localKey, remoteId) {
    // Simple string/byte comparison for deterministic tie-breaking
    const localStr = typeof localKey === 'string' ? localKey : Array.from(localKey).join(',');
    const remoteStr = typeof remoteId === 'string' ? remoteId : Array.from(remoteId).join(',');
    return localStr < remoteStr ? -1 : localStr > remoteStr ? 1 : 0;
  }

  _wrap(type, payload) {
    const w = new Uint8Array(1 + payload.length);
    w[0] = type;
    w.set(payload, 1);
    return w;
  }
}

HandshakeManager.STATE = STATE;
module.exports = HandshakeManager;
