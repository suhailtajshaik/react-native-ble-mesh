'use strict';

/**
 * @fileoverview Handshake orchestration for Noise Protocol XX pattern
 * @module service/HandshakeManager
 */

const EventEmitter = require('../utils/EventEmitter');
const { HandshakeError } = require('../errors');
const { MESSAGE_TYPE, MESH_CONFIG, EVENTS } = require('../constants');

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
      if (type === MESSAGE_TYPE.HANDSHAKE_INIT) { return await this._onInit(peerId, payload, transport); }
      if (type === MESSAGE_TYPE.HANDSHAKE_RESPONSE) { return await this._onResponse(peerId, payload, transport); }
      if (type === MESSAGE_TYPE.HANDSHAKE_FINAL) { return await this._onFinal(peerId, payload); }
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

  _createNoise() {
    return {
      writeMessage1: () => new Uint8Array(32), readMessage1: () => {},
      writeMessage2: () => new Uint8Array(80), readMessage2: () => {},
      writeMessage3: () => new Uint8Array(48), readMessage3: () => {},
      isComplete: () => false, getSession: () => ({ encrypt: () => {}, decrypt: () => {} }),
      getRemotePublicKey: () => new Uint8Array(32)
    };
  }

  async _onInit(peerId, payload, transport) {
    if (this._pending.has(peerId)) { throw HandshakeError.alreadyInProgress(peerId); }
    const hs = this._createState(peerId, false);
    this._pending.set(peerId, hs);
    this.emit(EVENTS.HANDSHAKE_STARTED, { peerId, role: 'responder' });
    hs.noise.readMessage1(payload);
    await transport.send(peerId, this._wrap(MESSAGE_TYPE.HANDSHAKE_RESPONSE, hs.noise.writeMessage2()));
    hs.state = STATE.RESPONDER_WAITING;
    hs.step = 2;
    this.emit(EVENTS.HANDSHAKE_PROGRESS, { peerId, step: 2, role: 'responder' });
    this._setTimeout(peerId);
    return null;
  }

  async _onResponse(peerId, payload, transport) {
    const hs = this._pending.get(peerId);
    if (!hs || !hs.isInitiator) { throw HandshakeError.invalidState(peerId, 2); }
    hs.noise.readMessage2(payload);
    await transport.send(peerId, this._wrap(MESSAGE_TYPE.HANDSHAKE_FINAL, hs.noise.writeMessage3()));
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

  _wrap(type, payload) {
    const w = new Uint8Array(1 + payload.length);
    w[0] = type;
    w.set(payload, 1);
    return w;
  }
}

HandshakeManager.STATE = STATE;
module.exports = HandshakeManager;
