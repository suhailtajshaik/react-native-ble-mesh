'use strict';

/**
 * @fileoverview Main mesh network service orchestrator
 * @module service/MeshService
 */

const EventEmitter = require('../utils/EventEmitter');
const { MeshError, ValidationError, AudioError } = require('../errors');
const { SERVICE_STATE, MESSAGE_TYPE, EVENTS, ERROR_CODE } = require('../constants');
const SessionManager = require('./SessionManager');
const HandshakeManager = require('./HandshakeManager');
const { AudioManager } = require('./audio');
const { TextManager, ChannelManager } = require('./text');

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
    this._audioManager = null;
    this._textManager = null;
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
    if (!transport) { throw new ValidationError('Transport is required', ERROR_CODE.E802); }
    this._transport = transport;
    this._setupTransportListeners();
    await this._transport.start();
    this._setState(SERVICE_STATE.ACTIVE);
  }

  async stop() {
    if (this._state !== SERVICE_STATE.ACTIVE) { return; }
    if (this._transport) { await this._transport.stop(); }
    this._setState(SERVICE_STATE.SUSPENDED);
  }

  async destroy() {
    await this.stop();
    this._sessionManager?.clear();
    this._channelManager?.clear();
    if (this._textManager) { await this._textManager.destroy(); }
    if (this._audioManager) { await this._audioManager.destroy(); }
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

  // Text messaging methods
  sendBroadcast(content) {
    this._validateState([SERVICE_STATE.ACTIVE]);
    if (this._textManager) {
      return this._textManager.sendBroadcast(content);
    }
    const messageId = this._generateMessageId();
    // Actually send through the transport
    if (this._transport) {
      const payload = new TextEncoder().encode(content);
      const data = new Uint8Array(1 + payload.length);
      data[0] = MESSAGE_TYPE.TEXT;
      data.set(payload, 1);
      this._transport.broadcast(data);
    }
    this.emit(EVENTS.BROADCAST_SENT, { messageId, content });
    return messageId;
  }

  async sendPrivateMessage(peerId, content) {
    this._validateState([SERVICE_STATE.ACTIVE]);
    if (this._textManager) {
      return this._textManager.sendPrivateMessage(peerId, content);
    }
    if (!this._sessionManager.hasSession(peerId)) { await this.initiateHandshake(peerId); }
    const messageId = this._generateMessageId();
    const plaintext = new TextEncoder().encode(content);
    const ciphertext = this._sessionManager.encryptFor(peerId, plaintext);
    await this._transport.send(peerId, ciphertext);
    this.emit(EVENTS.PRIVATE_MESSAGE_SENT, { messageId, peerId });
    return messageId;
  }

  sendChannelMessage(channelId, content) {
    this._validateState([SERVICE_STATE.ACTIVE]);
    if (this._textManager) {
      return this._textManager.sendChannelMessage(channelId, content);
    }
    if (!this._channelManager.isInChannel(channelId)) {
      throw new MeshError('Not in channel', ERROR_CODE.E602);
    }
    const messageId = this._generateMessageId();
    this.emit(EVENTS.CHANNEL_MESSAGE, { messageId, channelId, content });
    return messageId;
  }

  joinChannel(channelId, password) {
    if (this._textManager) {
      return this._textManager.joinChannel(channelId, password);
    }
    this._channelManager.joinChannel(channelId, password);
  }

  leaveChannel(channelId) {
    if (this._textManager) {
      return this._textManager.leaveChannel(channelId);
    }
    this._channelManager.leaveChannel(channelId);
  }

  getChannels() {
    if (this._textManager) {
      return this._textManager.getChannels();
    }
    return this._channelManager.getChannels();
  }

  // Text manager methods
  async initializeText(options = {}) {
    this._validateState([SERVICE_STATE.READY, SERVICE_STATE.ACTIVE]);
    if (this._textManager) {
      throw new MeshError('Text already initialized', ERROR_CODE.E002);
    }
    this._textManager = new TextManager(options);
    await this._textManager.initialize(this);
    this._setupTextEventForwarding();
  }

  getTextManager() { return this._textManager; }

  // Audio methods
  async initializeAudio(options = {}) {
    this._validateState([SERVICE_STATE.READY, SERVICE_STATE.ACTIVE]);
    if (this._audioManager) {
      throw new MeshError('Audio already initialized', ERROR_CODE.E002);
    }
    this._audioManager = new AudioManager(options);
    await this._audioManager.initialize(this);
    this._setupAudioEventForwarding();
  }

  getAudioManager() { return this._audioManager; }

  async sendVoiceMessage(peerId, voiceMessage) {
    this._validateState([SERVICE_STATE.ACTIVE]);
    if (!this._audioManager) {
      throw AudioError.codecNotAvailable();
    }
    return this._audioManager.sendVoiceMessage(peerId, voiceMessage);
  }

  async requestAudioStream(peerId) {
    this._validateState([SERVICE_STATE.ACTIVE]);
    if (!this._audioManager) {
      throw AudioError.codecNotAvailable();
    }
    return this._audioManager.requestStream(peerId);
  }

  _setupTextEventForwarding() {
    if (!this._textManager) { return; }
    const textEvents = [
      EVENTS.PRIVATE_MESSAGE_RECEIVED, EVENTS.PRIVATE_MESSAGE_SENT,
      EVENTS.BROADCAST_SENT, EVENTS.BROADCAST_RECEIVED,
      EVENTS.CHANNEL_JOINED, EVENTS.CHANNEL_LEFT, EVENTS.CHANNEL_MESSAGE,
      EVENTS.CHANNEL_MEMBER_JOINED, EVENTS.CHANNEL_MEMBER_LEFT
    ];
    textEvents.forEach(e => this._textManager.on(e, d => this.emit(e, d)));
  }

  _setupAudioEventForwarding() {
    if (!this._audioManager) { return; }
    const audioEvents = [
      EVENTS.AUDIO_STREAM_REQUEST, EVENTS.AUDIO_STREAM_STARTED, EVENTS.AUDIO_STREAM_ENDED,
      EVENTS.VOICE_MESSAGE_RECEIVED, EVENTS.VOICE_MESSAGE_SENT, EVENTS.VOICE_MESSAGE_PROGRESS
    ];
    audioEvents.forEach(e => this._audioManager.on(e, d => this.emit(e, d)));
  }

  async _sendRaw(peerId, data) {
    if (this._state === SERVICE_STATE.DESTROYED || !this._transport) {
      return; // Silently ignore sends after destroy
    }
    await this._transport.send(peerId, data);
  }

  getStatus() {
    return {
      state: this._state, identity: this.getIdentity(),
      peerCount: this.getConnectedPeers().length, securedPeerCount: this.getSecuredPeers().length,
      channelCount: this._channelManager?.getChannels().length || 0,
      sessionCount: this._sessionManager?.getAllSessionPeerIds().length || 0,
      hasTextManager: !!this._textManager,
      hasAudioManager: !!this._audioManager
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
    const { createProvider } = require('../crypto/AutoCrypto');
    let provider;
    let keyPair;

    try {
      provider = createProvider('auto');
      keyPair = provider.generateKeyPair();
    } catch (e) {
      // If no crypto provider is available, return a minimal fallback
      // that generates random keys using basic randomBytes
      const { randomBytes } = require('../utils/bytes');
      keyPair = { publicKey: randomBytes(32), secretKey: randomBytes(32) };
      return {
        getStaticKeyPair: () => keyPair,
        getPublicKey: () => keyPair.publicKey,
        exportIdentity: () => ({ publicKey: Array.from(keyPair.publicKey) }),
        importIdentity: (id) => {
          if (id && id.publicKey) {
            keyPair.publicKey = new Uint8Array(id.publicKey);
          }
          if (id && id.secretKey) {
            keyPair.secretKey = new Uint8Array(id.secretKey);
          }
        }
      };
    }

    return {
      getStaticKeyPair: () => keyPair,
      getPublicKey: () => keyPair.publicKey,
      provider,
      exportIdentity: () => ({
        publicKey: Array.from(keyPair.publicKey),
        secretKey: Array.from(keyPair.secretKey)
      }),
      importIdentity: (id) => {
        if (id && id.publicKey) {
          keyPair.publicKey = new Uint8Array(id.publicKey);
        }
        if (id && id.secretKey) {
          keyPair.secretKey = new Uint8Array(id.secretKey);
        }
      }
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
      if (this._textManager) {
        this._textManager.handleIncomingMessage(peerId, type, payload);
      } else {
        // Try to parse channel ID from payload
        let channelId = '';
        let content = payload;
        try {
          const decoded = new TextDecoder().decode(payload);
          const parsed = JSON.parse(decoded);
          channelId = parsed.channelId || '';
          content = parsed.content ? new TextEncoder().encode(parsed.content) : payload;
        } catch (e) {
          // If not JSON, try to extract channelId as length-prefixed string
          if (payload.length > 1) {
            const channelIdLen = payload[0];
            if (channelIdLen > 0 && channelIdLen < payload.length) {
              channelId = new TextDecoder().decode(payload.subarray(1, 1 + channelIdLen));
              content = payload.subarray(1 + channelIdLen);
            }
          }
        }
        this._channelManager.handleChannelMessage({ channelId, senderId: peerId, content });
      }
    } else if (type >= MESSAGE_TYPE.VOICE_MESSAGE_START && type <= MESSAGE_TYPE.AUDIO_STREAM_END) {
      if (this._audioManager) {
        this._audioManager.handleIncomingMessage(peerId, type, payload);
      }
    } else if (type === MESSAGE_TYPE.TEXT || type === MESSAGE_TYPE.PRIVATE_MESSAGE) {
      if (this._textManager) {
        this._textManager.handleIncomingMessage(peerId, type, payload);
      } else {
        this.emit(EVENTS.MESSAGE_RECEIVED, { peerId, type, payload });
      }
    } else {
      this.emit(EVENTS.MESSAGE_RECEIVED, { peerId, type, payload });
    }
  }
}

MeshService.STATE = SERVICE_STATE;
module.exports = MeshService;
