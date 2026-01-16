'use strict';

/**
 * @fileoverview Main audio service orchestrator
 * @module service/audio/AudioManager
 */

const EventEmitter = require('../../utils/EventEmitter');
const AudioError = require('../../errors/AudioError');
const { MESSAGE_TYPE } = require('../../constants/protocol');
const { EVENTS } = require('../../constants/events');
const { AUDIO_QUALITY, AUDIO_SESSION_STATE } = require('../../constants/audio');
const { LC3Codec } = require('./codec');
const { VoiceMessage, VoiceMessageRecorder } = require('./session/VoiceMessage');
const AudioSession = require('./session/AudioSession');
const { AudioFragmenter, AudioAssembler } = require('./transport/AudioFragmenter');
const { unpackFrame, createStreamFrame } = require('./transport/AudioFramer');

/**
 * Audio manager states
 * @constant {Object}
 */
const MANAGER_STATE = Object.freeze({
  UNINITIALIZED: 'uninitialized',
  INITIALIZING: 'initializing',
  READY: 'ready',
  ACTIVE: 'active',
  ERROR: 'error',
  DESTROYED: 'destroyed'
});

/**
 * Main audio service orchestrator
 * @class AudioManager
 * @extends EventEmitter
 */
class AudioManager extends EventEmitter {
  /**
   * Creates a new AudioManager
   * @param {Object} [options] - Manager options
   * @param {string} [options.quality='MEDIUM'] - Audio quality preset
   */
  constructor(options = {}) {
    super();

    /** @private */
    this._quality = options.quality || 'MEDIUM';
    /** @private */
    this._state = MANAGER_STATE.UNINITIALIZED;
    /** @private */
    this._meshService = null;
    /** @private */
    this._codec = null;
    /** @private */
    this._sessions = new Map(); // peerId -> AudioSession
    /** @private */
    this._pendingRequests = new Map(); // peerId -> { resolve, reject, timeout }
    /** @private */
    this._voiceAssembler = new AudioAssembler();
    /** @private */
    this._senderId = null;

    this._setupAssemblerEvents();
  }

  /**
   * Sets up voice message assembler events
   * @private
   */
  _setupAssemblerEvents() {
    this._voiceAssembler.on('complete', (data) => {
      this._handleVoiceMessageComplete(data);
    });

    this._voiceAssembler.on('progress', (data) => {
      this.emit(EVENTS.VOICE_MESSAGE_PROGRESS, data);
    });

    this._voiceAssembler.on('timeout', (data) => {
      this.emit(EVENTS.VOICE_MESSAGE_FAILED, {
        ...data,
        error: AudioError.voiceMessageTimeout(data.messageId)
      });
    });
  }

  /**
   * Initializes the audio manager
   * @param {MeshService} meshService - Mesh service instance
   * @returns {Promise<void>}
   */
  async initialize(meshService) {
    if (this._state !== MANAGER_STATE.UNINITIALIZED) {
      return;
    }

    this._setState(MANAGER_STATE.INITIALIZING);

    try {
      this._meshService = meshService;

      // Get sender ID from mesh service
      const identity = meshService.getIdentity?.() || {};
      this._senderId = identity.publicKey || new Uint8Array(32);

      // Initialize codec
      const qualityConfig = AUDIO_QUALITY[this._quality];
      this._codec = new LC3Codec(qualityConfig);
      await this._codec.initialize();

      this._setState(MANAGER_STATE.READY);
      this.emit('initialized', { quality: this._quality, codec: this._codec.getConfig() });
    } catch (error) {
      this._setState(MANAGER_STATE.ERROR);
      throw AudioError.codecInitFailed({ reason: error.message });
    }
  }

  /**
   * Destroys the audio manager
   * @returns {Promise<void>}
   */
  async destroy() {
    // End all sessions
    for (const [peerId, session] of this._sessions) {
      await session.end();
    }
    this._sessions.clear();

    // Cancel pending requests
    for (const [peerId, request] of this._pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(AudioError.sessionFailed(peerId, { reason: 'Manager destroyed' }));
    }
    this._pendingRequests.clear();

    // Destroy codec
    if (this._codec) {
      this._codec.destroy();
      this._codec = null;
    }

    this._setState(MANAGER_STATE.DESTROYED);
    this.emit('destroyed');
    this.removeAllListeners();
  }

  /**
   * Sets audio quality
   * @param {string} quality - Quality preset (LOW, MEDIUM, HIGH)
   */
  setQuality(quality) {
    if (!AUDIO_QUALITY[quality]) {
      throw AudioError.invalidConfig(`Unknown quality: ${quality}`);
    }
    this._quality = quality;
  }

  /**
   * Returns current quality setting
   * @returns {string}
   */
  getQuality() {
    return this._quality;
  }

  /**
   * Returns codec info
   * @returns {Object|null}
   */
  getCodecInfo() {
    return this._codec ? this._codec.getConfig() : null;
  }

  /**
   * Requests an audio stream with a peer
   * @param {string} peerId - Remote peer ID
   * @returns {Promise<AudioSession>}
   */
  async requestStream(peerId) {
    this._validateReady();

    if (this._sessions.has(peerId)) {
      throw AudioError.sessionFailed(peerId, { reason: 'Session already exists' });
    }

    const session = new AudioSession({
      peerId,
      codec: this._codec,
      isInitiator: true,
      sendCallback: (data) => this._sendStreamData(data)
    });

    session.setRequesting();
    this._sessions.set(peerId, session);

    // Send stream request
    await this._sendMessage(peerId, MESSAGE_TYPE.AUDIO_STREAM_REQUEST, new Uint8Array(0));

    // Wait for response with timeout
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._pendingRequests.delete(peerId);
        session.setFailed('Timeout');
        this._sessions.delete(peerId);
        reject(AudioError.sessionFailed(peerId, { reason: 'Request timeout' }));
      }, 30000);

      this._pendingRequests.set(peerId, { resolve, reject, timeout, session });
    });
  }

  /**
   * Accepts an incoming stream request
   * @param {string} peerId - Remote peer ID
   * @returns {Promise<AudioSession>}
   */
  async acceptStream(peerId) {
    this._validateReady();

    const session = this._sessions.get(peerId);
    if (!session || session.getState() !== AUDIO_SESSION_STATE.PENDING) {
      throw AudioError.sessionFailed(peerId, { reason: 'No pending request' });
    }

    await this._sendMessage(peerId, MESSAGE_TYPE.AUDIO_STREAM_ACCEPT, new Uint8Array(0));
    await session.start();

    this.emit(EVENTS.AUDIO_STREAM_STARTED, { peerId });
    return session;
  }

  /**
   * Rejects an incoming stream request
   * @param {string} peerId - Remote peer ID
   * @param {string} [reason] - Rejection reason
   */
  async rejectStream(peerId, reason) {
    const session = this._sessions.get(peerId);
    if (session) {
      session.setFailed(reason || 'Rejected');
      this._sessions.delete(peerId);
    }

    const payload = reason ? new TextEncoder().encode(reason) : new Uint8Array(0);
    await this._sendMessage(peerId, MESSAGE_TYPE.AUDIO_STREAM_REJECT, payload);
  }

  /**
   * Ends an audio stream
   * @param {string} peerId - Remote peer ID
   * @returns {Promise<void>}
   */
  async endStream(peerId) {
    const session = this._sessions.get(peerId);
    if (session) {
      await session.end();
      this._sessions.delete(peerId);
      await this._sendMessage(peerId, MESSAGE_TYPE.AUDIO_STREAM_END, new Uint8Array(0));
      this.emit(EVENTS.AUDIO_STREAM_ENDED, { peerId });
    }
  }

  /**
   * Gets a session by peer ID
   * @param {string} peerId - Peer ID
   * @returns {AudioSession|undefined}
   */
  getSession(peerId) {
    return this._sessions.get(peerId);
  }

  /**
   * Gets all active sessions
   * @returns {AudioSession[]}
   */
  getActiveSessions() {
    return Array.from(this._sessions.values())
      .filter(s => s.getState() === AUDIO_SESSION_STATE.ACTIVE);
  }

  /**
   * Starts recording a voice message
   * @returns {VoiceMessageRecorder}
   */
  startRecording() {
    this._validateReady();

    return new VoiceMessageRecorder({
      codec: this._codec,
      senderId: this._senderId
    });
  }

  /**
   * Sends a voice message to a peer
   * @param {string} peerId - Remote peer ID
   * @param {VoiceMessage} message - Voice message to send
   * @returns {Promise<string>} Message ID
   */
  async sendVoiceMessage(peerId, message) {
    this._validateReady();

    const messageId = this._generateMessageId();
    const serialized = message.serialize();
    const fragments = AudioFragmenter.fragment(serialized, { messageId });

    for (const fragment of fragments) {
      await this._sendRaw(peerId, fragment);
    }

    this.emit(EVENTS.VOICE_MESSAGE_SENT, { peerId, messageId, size: serialized.length });
    return messageId;
  }

  /**
   * Handles incoming audio message
   * @param {string} peerId - Source peer ID
   * @param {number} type - Message type
   * @param {Uint8Array} payload - Message payload
   */
  handleIncomingMessage(peerId, type, payload) {
    switch (type) {
      case MESSAGE_TYPE.AUDIO_STREAM_REQUEST:
        this._handleStreamRequest(peerId);
        break;
      case MESSAGE_TYPE.AUDIO_STREAM_ACCEPT:
        this._handleStreamAccept(peerId);
        break;
      case MESSAGE_TYPE.AUDIO_STREAM_REJECT:
        this._handleStreamReject(peerId, payload);
        break;
      case MESSAGE_TYPE.AUDIO_STREAM_DATA:
        this._handleStreamData(peerId, payload);
        break;
      case MESSAGE_TYPE.AUDIO_STREAM_END:
        this._handleStreamEnd(peerId);
        break;
      case MESSAGE_TYPE.VOICE_MESSAGE_START:
      case MESSAGE_TYPE.VOICE_MESSAGE_DATA:
      case MESSAGE_TYPE.VOICE_MESSAGE_END:
        this._handleVoiceMessageFragment(peerId, payload);
        break;
    }
  }

  /** @private */
  _handleStreamRequest(peerId) {
    if (this._sessions.has(peerId)) return;

    const session = new AudioSession({
      peerId,
      codec: this._codec,
      isInitiator: false,
      sendCallback: (data) => this._sendStreamData(data)
    });

    session.setPending();
    this._sessions.set(peerId, session);

    this.emit(EVENTS.AUDIO_STREAM_REQUEST, { peerId });
  }

  /** @private */
  _handleStreamAccept(peerId) {
    const request = this._pendingRequests.get(peerId);
    if (request) {
      clearTimeout(request.timeout);
      this._pendingRequests.delete(peerId);
      request.session.start().then(() => {
        this.emit(EVENTS.AUDIO_STREAM_STARTED, { peerId });
        request.resolve(request.session);
      });
    }
  }

  /** @private */
  _handleStreamReject(peerId, payload) {
    const request = this._pendingRequests.get(peerId);
    if (request) {
      clearTimeout(request.timeout);
      this._pendingRequests.delete(peerId);
      this._sessions.delete(peerId);
      const reason = payload.length > 0 ? new TextDecoder().decode(payload) : 'Rejected';
      request.reject(AudioError.streamRejected(peerId, reason));
    }
  }

  /** @private */
  _handleStreamData(peerId, payload) {
    const session = this._sessions.get(peerId);
    if (session && session.getState() === AUDIO_SESSION_STATE.ACTIVE) {
      try {
        const { frame, sequenceNumber, timestampDelta } = unpackFrame(payload);
        session.receiveAudio(frame, sequenceNumber, timestampDelta);
      } catch (error) {
        this.emit('error', error);
      }
    }
  }

  /** @private */
  _handleStreamEnd(peerId) {
    const session = this._sessions.get(peerId);
    if (session) {
      session.end();
      this._sessions.delete(peerId);
      this.emit(EVENTS.AUDIO_STREAM_ENDED, { peerId, initiatedBy: 'remote' });
    }
  }

  /** @private */
  _handleVoiceMessageFragment(peerId, payload) {
    const fullPayload = new Uint8Array(payload.length + 1);
    fullPayload[0] = payload[0]; // type is already in payload for fragments
    fullPayload.set(payload, 0);

    const complete = this._voiceAssembler.addFragment(fullPayload);
    if (complete) {
      // Complete message will be handled by assembler event
      this._lastVoiceMessagePeerId = peerId;
    }
  }

  /** @private */
  _handleVoiceMessageComplete({ messageId, size }) {
    // Note: The actual voice message data comes from the assembler
    this.emit(EVENTS.VOICE_MESSAGE_RECEIVED, {
      peerId: this._lastVoiceMessagePeerId,
      messageId,
      size
    });
  }

  /** @private */
  async _sendStreamData({ peerId, frame, sequenceNumber, timestampDelta }) {
    const packed = createStreamFrame(frame, sequenceNumber, timestampDelta);
    await this._sendRaw(peerId, packed);
  }

  /** @private */
  async _sendMessage(peerId, type, payload) {
    const data = new Uint8Array(1 + payload.length);
    data[0] = type;
    data.set(payload, 1);
    await this._sendRaw(peerId, data);
  }

  /** @private */
  async _sendRaw(peerId, data) {
    if (this._meshService && typeof this._meshService._sendRaw === 'function') {
      await this._meshService._sendRaw(peerId, data);
    }
  }

  /** @private */
  _generateMessageId() {
    return `vm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  /** @private */
  _validateReady() {
    if (this._state !== MANAGER_STATE.READY && this._state !== MANAGER_STATE.ACTIVE) {
      throw AudioError.codecInitFailed({ reason: 'Audio manager not ready' });
    }
  }

  /** @private */
  _setState(newState) {
    this._state = newState;
  }

  /**
   * Returns manager state
   * @returns {string}
   */
  getState() {
    return this._state;
  }
}

AudioManager.STATE = MANAGER_STATE;

module.exports = AudioManager;
