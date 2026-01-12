'use strict';

/**
 * @fileoverview Main mesh network service orchestrator
 * @module service/MeshService
 */

const EventEmitter = require('events');
const { MeshError, ValidationError } = require('../errors');
const { SERVICE_STATE, MESSAGE_TYPE, EVENTS, ERROR_CODE } = require('../constants');
const SessionManager = require('./SessionManager');
const HandshakeManager = require('./HandshakeManager');
const ChannelManager = require('./ChannelManager');

/**
 * Main orchestrator for the BLE Mesh Network.
 * @class MeshService
 * @extends EventEmitter
 */
class MeshService extends EventEmitter {
  constructor(config = {}) {
    super();
    this._config = { displayName: 'Anonymous', ...config };
    this._state = SERVICE_STATE.UNINITIALIZED;
    this._transport = null;
    this._keyManager = null;
    this._sessionManager = null;
    this._handshakeManager = null;
    this._channelManager = null;
    this._peerManager = null;
    this._messageCounter = 0;
  }

  async initialize(options = {}) {
    if (this._state !== SERVICE_STATE.UNINITIALIZED) {
      throw new MeshError('Service already initialized', ERROR_CODE.E002);
    }
    this._setState(SERVICE_STATE.INITIALIZING);
    try {
      this._keyManager = options.keyManager || this._createKeyManager();
      this._sessionManager = new SessionManager();
      this._handshakeManager = new HandshakeManager(this._keyManager, this._sessionManager);
      this._channelManager = new ChannelManager();
      this._setupEventForwarding();
      this._setState(SERVICE_STATE.READY);
      this.emit(EVENTS.INITIALIZED);
    } catch (err) {
      this._setState(SERVICE_STATE.ERROR);
      throw new MeshError(`Initialization failed: ${err.message}`, ERROR_CODE.E001);
    }
  }

  async start(transport) {
    this._validateState([SERVICE_STATE.READY, SERVICE_STATE.SUSPENDED]);
    if (!transport) throw new ValidationError('Transport is required', ERROR_CODE.E802);
    this._transport = transport;
    this._setupTransportListeners();
    await this._transport.start();
    this._setState(SERVICE_STATE.ACTIVE);
  }

  async stop() {
    if (this._state !== SERVICE_STATE.ACTIVE) return;
    if (this._transport) await this._transport.stop();
    this._setState(SERVICE_STATE.SUSPENDED);
  }

  async destroy() {
    await this.stop();
    this._sessionManager?.clear();
    this._channelManager?.clear();
    this._transport = null;
    this._setState(SERVICE_STATE.DESTROYED);
    this.emit(EVENTS.DESTROYED);
    this.removeAllListeners();
  }

  getIdentity() {
    return {
      publicKey: this._keyManager?.getPublicKey() || new Uint8Array(32),
      displayName: this._config.displayName
    };
  }

  setDisplayName(name) { this._config.displayName = name; }
  exportIdentity() { return this._keyManager?.exportIdentity() || null; }
  importIdentity(identity) { this._keyManager?.importIdentity(identity); }

  getPeers() { return this._peerManager?.getAllPeers() || []; }
  getPeer(id) { return this._peerManager?.getPeer(id); }
  getConnectedPeers() { return this._peerManager?.getConnectedPeers() || []; }
  getSecuredPeers() { return this._sessionManager?.getAllSessionPeerIds() || []; }

  async initiateHandshake(peerId) {
    this._validateState([SERVICE_STATE.ACTIVE]);
    return this._handshakeManager.initiateHandshake(peerId, this._transport);
  }

  blockPeer(id) {
    this._peerManager?.blockPeer(id);
    this.emit(EVENTS.PEER_BLOCKED, { peerId: id });
  }

  unblockPeer(id) {
    this._peerManager?.unblockPeer(id);
    this.emit(EVENTS.PEER_UNBLOCKED, { peerId: id });
  }

  sendBroadcast(content) {
    this._validateState([SERVICE_STATE.ACTIVE]);
    const messageId = this._generateMessageId();
    this.emit(EVENTS.BROADCAST_SENT, { messageId, content });
    return messageId;
  }

  async sendPrivateMessage(peerId, content) {
    this._validateState([SERVICE_STATE.ACTIVE]);
    if (!this._sessionManager.hasSession(peerId)) await this.initiateHandshake(peerId);
    const messageId = this._generateMessageId();
    const plaintext = new TextEncoder().encode(content);
    const ciphertext = this._sessionManager.encryptFor(peerId, plaintext);
    await this._transport.send(peerId, ciphertext);
    this.emit(EVENTS.PRIVATE_MESSAGE_SENT, { messageId, peerId });
    return messageId;
  }

  sendChannelMessage(channelId, content) {
    this._validateState([SERVICE_STATE.ACTIVE]);
    if (!this._channelManager.isInChannel(channelId)) {
      throw new MeshError('Not in channel', ERROR_CODE.E602);
    }
    const messageId = this._generateMessageId();
    this.emit(EVENTS.CHANNEL_MESSAGE, { messageId, channelId, content });
    return messageId;
  }

  joinChannel(channelId, password) { this._channelManager.joinChannel(channelId, password); }
  leaveChannel(channelId) { this._channelManager.leaveChannel(channelId); }
  getChannels() { return this._channelManager.getChannels(); }

  getStatus() {
    return {
      state: this._state, identity: this.getIdentity(),
      peerCount: this.getConnectedPeers().length, securedPeerCount: this.getSecuredPeers().length,
      channelCount: this._channelManager?.getChannels().length || 0,
      sessionCount: this._sessionManager?.getAllSessionPeerIds().length || 0
    };
  }

  getState() { return this._state; }

  _setState(newState) {
    const oldState = this._state;
    this._state = newState;
    this.emit(EVENTS.STATE_CHANGED, { oldState, newState });
  }

  _validateState(allowed) {
    if (!allowed.includes(this._state)) {
      throw new MeshError(`Invalid state: ${this._state}`, ERROR_CODE.E003);
    }
  }

  _generateMessageId() { return `msg_${Date.now()}_${++this._messageCounter}`; }

  _createKeyManager() {
    return {
      getStaticKeyPair: () => ({ publicKey: new Uint8Array(32), secretKey: new Uint8Array(32) }),
      getPublicKey: () => new Uint8Array(32),
      exportIdentity: () => ({}), importIdentity: () => {}
    };
  }

  _setupEventForwarding() {
    const fwd = (em, evts) => evts.forEach(e => em.on(e, d => this.emit(e, d)));
    fwd(this._handshakeManager, [EVENTS.HANDSHAKE_STARTED, EVENTS.HANDSHAKE_PROGRESS,
      EVENTS.HANDSHAKE_COMPLETE, EVENTS.HANDSHAKE_FAILED]);
    fwd(this._channelManager, [EVENTS.CHANNEL_JOINED, EVENTS.CHANNEL_LEFT,
      EVENTS.CHANNEL_MESSAGE, EVENTS.CHANNEL_MEMBER_JOINED, EVENTS.CHANNEL_MEMBER_LEFT]);
  }

  _setupTransportListeners() {
    this._transport.on('message', d => this._handleIncoming(d));
    this._transport.on('peerConnected', d => this.emit(EVENTS.PEER_CONNECTED, d));
    this._transport.on('peerDisconnected', d => this.emit(EVENTS.PEER_DISCONNECTED, d));
  }

  _handleIncoming({ peerId, data }) {
    const type = data[0], payload = data.subarray(1);
    if (type >= MESSAGE_TYPE.HANDSHAKE_INIT && type <= MESSAGE_TYPE.HANDSHAKE_FINAL) {
      this._handshakeManager.handleIncomingHandshake(peerId, type, payload, this._transport);
    } else if (type === MESSAGE_TYPE.CHANNEL_MESSAGE) {
      this._channelManager.handleChannelMessage({ channelId: '', senderId: peerId, content: payload });
    } else {
      this.emit(EVENTS.MESSAGE_RECEIVED, { peerId, type, payload });
    }
  }
}

MeshService.STATE = SERVICE_STATE;
module.exports = MeshService;
