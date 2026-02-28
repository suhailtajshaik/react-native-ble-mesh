'use strict';

/**
 * @fileoverview MeshNetwork - Simplified High-Level API
 * @module MeshNetwork
 *
 * Primary entry point for react-native-ble-mesh as specified in the PRD.
 * Provides a developer-friendly API for BitChat-compatible mesh networking.
 *
 * Target: Setup-to-first-message in <15 minutes, <10 lines for basic messaging.
 */

const EventEmitter = require('./utils/EventEmitter');
const { MeshService } = require('./service');
const { BLETransport } = require('./transport');
const { MemoryStorage } = require('./storage');
const { StoreAndForwardManager } = require('./mesh/store');
const { NetworkMonitor, HEALTH_STATUS, ConnectionQuality } = require('./mesh/monitor');
const { BatteryOptimizer, BATTERY_MODE } = require('./service/BatteryOptimizer');
const { EmergencyManager, PANIC_TRIGGER } = require('./service/EmergencyManager');
const { MessageCompressor } = require('./utils/compression');
const { ValidationError, MeshError } = require('./errors');
const { FileManager } = require('./service/file');
const { SERVICE_STATE, EVENTS } = require('./constants');

/**
 * Default MeshNetwork configuration
 * @constant {Object}
 */
const DEFAULT_CONFIG = Object.freeze({
  /** Display name for this node */
  nickname: 'Anonymous',
  /** Battery mode: 'high' | 'balanced' | 'low' | 'auto' */
  batteryMode: BATTERY_MODE.BALANCED,
  /** Encryption settings */
  encryption: {
    level: 'standard',
    rotateKeysAfter: 1000
  },
  /** Routing configuration */
  routing: {
    maxHops: 7,
    bloomFilterSize: 10000
  },
  /** Compression settings */
  compression: {
    enabled: true,
    threshold: 100
  },
  /** Store and forward settings */
  storeAndForward: {
    enabled: true,
    retentionHours: 24,
    maxCachedMessages: 1000
  }
});

/**
 * MeshNetwork - High-level API for BitChat-compatible mesh networking.
 *
 * @class MeshNetwork
 * @extends EventEmitter
 * @example
 * // Basic Setup (Minimal)
 * const mesh = new MeshNetwork({
 *   nickname: 'Alice',
 *   batteryMode: 'balanced',
 * });
 *
 * await mesh.start();
 * await mesh.broadcast('Hello mesh!');
 *
 * mesh.on('messageReceived', (message) => {
 *   console.log(`${message.from}: ${message.text}`);
 * });
 */
class MeshNetwork extends EventEmitter {
  /**
     * Creates a new MeshNetwork instance.
     * @param {Object} [config={}] - Network configuration
     * @param {string} [config.nickname='Anonymous'] - Display name
     * @param {string} [config.batteryMode='balanced'] - Battery mode
     * @param {Object} [config.encryption] - Encryption settings
     * @param {Object} [config.routing] - Routing settings
     * @param {Object} [config.compression] - Compression settings
     * @param {Object} [config.storeAndForward] - Store and forward settings
     */
  constructor(config = {}) {
    super();

    /**
         * Configuration
         * @type {Object}
         * @private
         */
    this._config = this._mergeConfig(DEFAULT_CONFIG, config);

    /**
         * Underlying MeshService
         * @type {MeshService}
         * @private
         */
    this._service = new MeshService({
      displayName: this._config.nickname
    });

    /**
         * Transport layer
         * @type {Transport|null}
         * @private
         */
    this._transport = null;

    /**
         * Store and forward manager
         * @type {StoreAndForwardManager|null}
         * @private
         */
    this._storeForward = this._config.storeAndForward.enabled
      ? new StoreAndForwardManager({
        retentionMs: this._config.storeAndForward.retentionHours * 60 * 60 * 1000,
        maxTotalMessages: this._config.storeAndForward.maxCachedMessages
      })
      : null;

    /**
         * Network monitor
         * @type {NetworkMonitor}
         * @private
         */
    this._monitor = new NetworkMonitor();

    /**
         * Battery optimizer
         * @type {BatteryOptimizer}
         * @private
         */
    this._batteryOptimizer = new BatteryOptimizer({
      initialMode: this._config.batteryMode
    });

    /**
         * Emergency manager
         * @type {EmergencyManager}
         * @private
         */
    this._emergencyManager = new EmergencyManager();

    /**
         * File transfer manager
         * @type {FileManager}
         * @private
         */
    this._fileManager = new FileManager({
      chunkSize: this._config.fileTransfer?.chunkSize,
      maxFileSize: this._config.fileTransfer?.maxFileSize,
      transferTimeoutMs: this._config.fileTransfer?.timeoutMs
    });

    /**
         * Connection quality tracker
         * @type {ConnectionQuality}
         * @private
         */
    this._connectionQuality = new ConnectionQuality(this._config.qualityConfig || {});

    /**
         * Message compressor
         * @type {MessageCompressor}
         * @private
         */
    this._compressor = new MessageCompressor({
      threshold: this._config.compression.threshold
    });

    /**
         * Channel manager reference
         * @type {Object|null}
         * @private
         */
    this._channels = null;

    /**
         * Network state
         * @type {string}
         * @private
         */
    this._state = 'stopped';

    // Setup event forwarding
    this._setupEventForwarding();
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  /**
     * Starts the mesh network.
     * @param {Object} [transport] - Optional custom transport
     * @returns {Promise<void>}
     */
  async start(transport) {
    if (this._state === 'running') {
      return;
    }

    // Create transport if not provided
    if (!transport) {
      try {
        const { RNBLEAdapter } = require('./transport/adapters');
        const adapter = new RNBLEAdapter();
        this._transport = new BLETransport(adapter);
      } catch (e) {
        throw new MeshError(
          'No transport provided and BLE adapter not available. ' +
          'Either pass a transport to start(), install react-native-ble-plx for BLE, ' +
          'or use MockTransport for testing.',
          'E900',
          { cause: e.message }
        );
      }
    } else {
      this._transport = transport;
    }

    // Initialize the service (only on first start)
    if (this._service._state === SERVICE_STATE.UNINITIALIZED) {
      await this._service.initialize({
        storage: new MemoryStorage()
      });
    }

    // Connect battery optimizer to transport
    this._batteryOptimizer.setTransport(this._transport);
    await this._batteryOptimizer.setMode(this._config.batteryMode);

    // Register data clearers for panic mode
    this._registerPanicClearers();

    // Start the service
    await this._service.start(this._transport);

    // Setup store and forward
    if (this._storeForward) {
      this._setupStoreAndForward();
    }

    // Setup file transfer events
    this._fileManager.on('sendProgress', (info) => this.emit('fileSendProgress', info));
    this._fileManager.on('receiveProgress', (info) => this.emit('fileReceiveProgress', info));
    this._fileManager.on('fileReceived', (info) => this.emit('fileReceived', info));
    this._fileManager.on('transferFailed', (info) => this.emit('fileTransferFailed', info));
    this._fileManager.on('transferCancelled', (info) => this.emit('fileTransferCancelled', info));

    // Start connection quality monitoring
    this._connectionQuality.start();
    this._connectionQuality.on('qualityChanged', (quality) => {
      this.emit('connectionQualityChanged', quality);
    });

    this._state = 'running';
    this.emit('started');
  }

  /**
     * Stops the mesh network.
     * @returns {Promise<void>}
     */
  async stop() {
    if (this._state !== 'running') {
      return;
    }

    // Clean up listeners added in start()
    this._fileManager.removeAllListeners('sendProgress');
    this._fileManager.removeAllListeners('receiveProgress');
    this._fileManager.removeAllListeners('fileReceived');
    this._fileManager.removeAllListeners('transferFailed');
    this._fileManager.removeAllListeners('transferCancelled');
    this._connectionQuality.removeAllListeners('qualityChanged');
    this._connectionQuality.stop();

    await this._service.stop();
    this._state = 'stopped';
    this.emit('stopped');
  }

  /**
     * Destroys the mesh network and cleans up resources.
     * @returns {Promise<void>}
     */
  async destroy() {
    await this.stop();
    await this._service.destroy();

    this._connectionQuality.destroy();
    this._fileManager.destroy();

    if (this._storeForward) {
      this._storeForward.destroy();
    }
    this._monitor.destroy();
    this._batteryOptimizer.destroy();
    this._emergencyManager.destroy();

    this.removeAllListeners();
  }

  // ============================================================================
  // Messaging Methods
  // ============================================================================

  /**
     * Broadcasts a message to all peers.
     * @param {string} text - Message text
     * @returns {Promise<string>} Message ID
     * @throws {Error} If text is invalid
     */
  async broadcast(text) {
    this._validateRunning();
    this._validateMessageText(text);

    const messageId = await this._service.sendBroadcast(text);
    this._monitor.trackMessageSent('broadcast', messageId);

    return messageId;
  }

  /**
     * Sends a direct encrypted message to a specific peer.
     * @param {string} peerId - Target peer ID or nickname
     * @param {string} text - Message text
     * @returns {Promise<string>} Message ID
     * @throws {Error} If peerId or text is invalid
     */
  async sendDirect(peerId, text) {
    this._validateRunning();
    this._validatePeerId(peerId);
    this._validateMessageText(text);

    try {
      const messageId = await this._service.sendPrivateMessage(peerId, text);
      this._monitor.trackMessageSent(peerId, messageId);
      return messageId;
    } catch (error) {
      // If peer is offline and store-forward is enabled, cache the message
      if (this._storeForward && this._isPeerOffline(peerId)) {
        const payload = this._encodeMessage(text);
        await this._storeForward.cacheForOfflinePeer(peerId, payload, {
          needsEncryption: true
        });
        this.emit('messageCached', { peerId, text });
        return 'cached';
      }
      throw error;
    }
  }

  // ============================================================================
  // Channel Methods
  // ============================================================================

  /**
     * Joins a channel (IRC-style topic-based group chat).
     * @param {string} channelName - Channel name (e.g., '#general')
     * @param {string} [password] - Optional password
     * @returns {Promise<void>}
     */
  async joinChannel(channelName, password) {
    this._validateRunning();

    const normalized = this._normalizeChannelName(channelName);
    await this._service.joinChannel(normalized, password);

    this.emit('channelJoined', { channel: normalized });
  }

  /**
     * Leaves a channel.
     * @param {string} channelName - Channel name
     * @returns {Promise<void>}
     */
  async leaveChannel(channelName) {
    this._validateRunning();

    const normalized = this._normalizeChannelName(channelName);
    await this._service.leaveChannel(normalized);

    this.emit('channelLeft', { channel: normalized });
  }

  /**
     * Sends a message to a channel.
     * @param {string} channelName - Channel name
     * @param {string} text - Message text
     * @returns {Promise<string>} Message ID
     */
  async sendToChannel(channelName, text) {
    this._validateRunning();

    const normalized = this._normalizeChannelName(channelName);
    return await this._service.sendChannelMessage(normalized, text);
  }

  /**
     * Gets list of joined channels.
     * @returns {Object[]} Channels
     */
  getChannels() {
    return this._service.getChannels();
  }

  // ============================================================================
  // Peer Methods
  // ============================================================================

  /**
     * Gets all known peers.
     * @returns {Object[]} Array of peers
     */
  getPeers() {
    return this._service.getPeers();
  }

  /**
     * Gets connected peers.
     * @returns {Object[]} Connected peers
     */
  getConnectedPeers() {
    return this._service.getConnectedPeers();
  }

  /**
     * Gets peers with secure sessions.
     * @returns {Object[]} Secured peers
     */
  getSecuredPeers() {
    return this._service.getSecuredPeers();
  }

  /**
     * Blocks a peer.
     * @param {string} peerId - Peer ID
     */
  blockPeer(peerId) {
    this._service.blockPeer(peerId);
    this.emit('peerBlocked', { peerId });
  }

  /**
     * Unblocks a peer.
     * @param {string} peerId - Peer ID
     */
  unblockPeer(peerId) {
    this._service.unblockPeer(peerId);
    this.emit('peerUnblocked', { peerId });
  }

  // ============================================================================
  // Network Health Methods
  // ============================================================================

  /**
     * Gets network health metrics.
     * @returns {Object} Health report
     */
  getNetworkHealth() {
    return this._monitor.generateHealthReport();
  }

  /**
     * Gets detailed health for a specific peer.
     * @param {string} peerId - Peer ID
     * @returns {Object|null} Node health
     */
  getPeerHealth(peerId) {
    return this._monitor.getNodeHealth(peerId);
  }

  // ============================================================================
  // Battery Management
  // ============================================================================

  /**
     * Sets the battery mode.
     * @param {string} mode - 'high' | 'balanced' | 'low' | 'auto'
     * @returns {Promise<void>}
     */
  async setBatteryMode(mode) {
    await this._batteryOptimizer.setMode(mode);
  }

  /**
     * Gets the current battery mode.
     * @returns {string} Current mode
     */
  getBatteryMode() {
    return this._batteryOptimizer.getMode();
  }

  /**
     * Updates battery level (for auto mode).
     * @param {number} level - Battery level (0-100)
     * @param {boolean} [charging=false] - Whether charging
     */
  updateBatteryLevel(level, charging = false) {
    this._batteryOptimizer.updateBatteryLevel(level, charging);
  }

  // ============================================================================
  // Security Methods
  // ============================================================================

  /**
     * Enables panic mode for emergency data wipe.
     * @param {Object} [options={}] - Panic mode options
     * @param {string} [options.trigger='triple_tap'] - Trigger type
     * @param {Function} [options.onWipe] - Callback after wipe
     */
  enablePanicMode(options = {}) {
    this._emergencyManager.enablePanicMode(options);
    this.emit('panicModeEnabled');
  }

  /**
     * Disables panic mode.
     */
  disablePanicMode() {
    this._emergencyManager.disablePanicMode();
    this.emit('panicModeDisabled');
  }

  /**
     * Registers a tap for panic mode detection.
     */
  registerPanicTap() {
    this._emergencyManager.registerTap();
  }

  /**
     * Manually triggers data wipe.
     * @returns {Promise<Object>} Wipe result
     */
  async wipeAllData() {
    return await this._emergencyManager.wipeAllData();
  }

  // ============================================================================
  // File Sharing Methods
  // ============================================================================

  /**
     * Sends a file to a specific peer.
     * @param {string} peerId - Target peer ID
     * @param {Object} fileInfo - File information
     * @param {Uint8Array} fileInfo.data - File data
     * @param {string} fileInfo.name - File name
     * @param {string} [fileInfo.mimeType] - MIME type
     * @returns {Object} Transfer info with id and event emitter
     */
  async sendFile(peerId, fileInfo) {
    this._validateRunning();
    this._validatePeerId(peerId);

    if (!fileInfo || !fileInfo.data || !fileInfo.name) {
      throw new ValidationError('File must have data and name', 'E800');
    }

    const transfer = this._fileManager.prepareSend(peerId, fileInfo);

    // Send offer (JSON is OK for metadata, but use binary type marker)
    const offerJson = JSON.stringify(transfer.offer);
    const offerBytes = new TextEncoder().encode(offerJson);
    const offerPayload = new Uint8Array(1 + offerBytes.length);
    offerPayload[0] = 0x01; // Binary type marker for OFFER
    offerPayload.set(offerBytes, 1);
    await this._service._sendRaw(peerId, offerPayload);

    // Send chunks sequentially using binary protocol
    for (let i = 0; i < transfer.chunks.length; i++) {
      // Check if still running (handles app backgrounding)
      if (this._state !== 'running') {
        this._fileManager.cancelTransfer(transfer.id);
        throw new MeshError('File transfer cancelled: network stopped', 'E900');
      }

      const chunk = transfer.chunks[i];

      // Binary format: [type(1)] [transferIdLen(1)] [transferId(N)] [index(2)] [data(M)]
      const transferIdBytes = new TextEncoder().encode(transfer.id);
      const header = new Uint8Array(1 + 1 + transferIdBytes.length + 2);
      let offset = 0;
      header[offset++] = 0x02; // Binary type marker for CHUNK
      header[offset++] = transferIdBytes.length;
      header.set(transferIdBytes, offset);
      offset += transferIdBytes.length;
      header[offset++] = (chunk.index >> 8) & 0xFF;
      header[offset++] = chunk.index & 0xFF;

      // Combine header + chunk data
      const payload = new Uint8Array(header.length + chunk.data.length);
      payload.set(header, 0);
      payload.set(chunk.data, header.length);

      // Add per-chunk timeout (10 seconds)
      const sendPromise = this._service._sendRaw(peerId, payload);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Chunk send timeout')), 10000)
      );

      try {
        await Promise.race([sendPromise, timeoutPromise]);
      } catch (err) {
        this._fileManager.cancelTransfer(transfer.id);
        this.emit('fileTransferFailed', {
          id: transfer.id, name: fileInfo.name, error: err.message
        });
        throw err;
      }

      this._fileManager.markChunkSent(transfer.id, i);
    }

    return { id: transfer.id, name: fileInfo.name };
  }

  /**
     * Gets active file transfers
     * @returns {Object} { outgoing: [], incoming: [] }
     */
  getActiveTransfers() {
    return this._fileManager.getActiveTransfers();
  }

  /**
     * Cancels a file transfer
     * @param {string} transferId - Transfer ID
     */
  cancelTransfer(transferId) {
    this._fileManager.cancelTransfer(transferId);
  }

  // ============================================================================
  // Connection Quality Methods
  // ============================================================================

  /**
     * Gets connection quality for a specific peer.
     * @param {string} peerId - Peer ID
     * @returns {Object|null} Quality report
     */
  getConnectionQuality(peerId) {
    return this._connectionQuality.getQuality(peerId);
  }

  /**
     * Gets connection quality for all peers.
     * @returns {Object[]} Array of quality reports
     */
  getAllConnectionQuality() {
    return this._connectionQuality.getAllQuality();
  }

  // ============================================================================
  // Status Methods
  // ============================================================================

  /**
     * Gets the network status.
     * @returns {Object} Status
     */
  getStatus() {
    const identity = this._state === 'running' ? this._service.getIdentity() : null;
    return {
      state: this._state,
      identity,
      peers: this._state === 'running' ? this.getPeers().length : 0,
      connectedPeers: this._state === 'running' ? this.getConnectedPeers().length : 0,
      channels: this._state === 'running' ? this.getChannels().length : 0,
      health: this._state === 'running' ? this.getNetworkHealth() : null,
      batteryMode: this.getBatteryMode()
    };
  }

  /**
     * Gets the identity information.
     * @returns {Object} Identity
     */
  getIdentity() {
    return this._service.getIdentity();
  }

  /**
     * Sets the display name/nickname.
     * @param {string} nickname - New nickname
     */
  setNickname(nickname) {
    this._config.nickname = nickname;
    this._service.setDisplayName(nickname);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
     * Merges configuration with defaults.
     * @param {Object} defaults - Default config
     * @param {Object} custom - Custom config
     * @returns {Object} Merged config
     * @private
     */
  _mergeConfig(defaults, custom) {
    return {
      ...defaults,
      ...custom,
      encryption: { ...defaults.encryption, ...custom.encryption },
      routing: { ...defaults.routing, ...custom.routing },
      compression: { ...defaults.compression, ...custom.compression },
      storeAndForward: { ...defaults.storeAndForward, ...custom.storeAndForward },
      fileTransfer: { ...defaults.fileTransfer, ...custom.fileTransfer },
      qualityConfig: { ...defaults.qualityConfig, ...custom.qualityConfig }
    };
  }

  /**
     * Sets up event forwarding from underlying services.
     * @private
     */
  _setupEventForwarding() {
    // Forward service events with PRD-style naming
    this._service.on(EVENTS.PEER_DISCOVERED, (peer) => {
      this._monitor.trackPeerDiscovered(peer.id);
      this.emit('peerDiscovered', peer);
    });

    this._service.on(EVENTS.PEER_CONNECTED, (peer) => {
      if (peer.rssi) {
        this._connectionQuality.recordRssi(peer.id, peer.rssi);
      }
      this.emit('peerConnected', peer);
      // Deliver cached messages
      if (this._storeForward && this._storeForward.hasCachedMessages(peer.id)) {
        this._deliverCachedMessages(peer.id);
      }
    });

    this._service.on(EVENTS.PEER_DISCONNECTED, (peer) => {
      this._monitor.trackPeerDisconnected(peer.id);
      this._connectionQuality.removePeer(peer.id);
      this.emit('peerDisconnected', peer);
    });

    this._service.on('message', (message) => {
      this._monitor.trackMessageReceived(message.senderId);
      this.emit('messageReceived', {
        from: message.senderId,
        text: message.content,
        timestamp: message.timestamp,
        type: message.type
      });
    });

    this._service.on('private-message', (message) => {
      this.emit('directMessage', {
        from: message.senderId,
        text: message.content,
        timestamp: message.timestamp
      });
    });

    this._service.on('channel-message', (message) => {
      this.emit('channelMessage', {
        channel: message.channelId,
        from: message.senderId,
        text: message.content,
        timestamp: message.timestamp
      });
    });

    this._service.on('message-delivered', (info) => {
      this._monitor.trackMessageDelivered(info.messageId);
      this.emit('messageDelivered', info);
    });

    this._service.on('error', (error) => {
      this.emit('error', error);
    });

    // Forward monitor events
    this._monitor.on('health-changed', (info) => {
      this.emit('networkHealthChanged', info);
    });

    // Forward emergency events
    this._emergencyManager.on('panic-wipe-completed', (result) => {
      this.emit('dataWiped', result);
    });
  }

  /**
     * Sets up store and forward integration.
     * @private
     */
  _setupStoreAndForward() {
    // Nothing extra needed - handled in peerConnected event
  }

  /**
     * Delivers cached messages to a peer.
     * @param {string} peerId - Peer ID
     * @private
     */
  async _deliverCachedMessages(peerId) {
    if (!this._storeForward) { return; }

    const sendFn = async (payload) => {
      // Re-encrypt and send via the proper encrypted channel
      try {
        const text = new TextDecoder().decode(payload);
        await this._service.sendPrivateMessage(peerId, text);
      } catch (e) {
        // Fallback to raw send if encryption fails
        await this._service._sendRaw(peerId, payload);
      }
    };

    const result = await this._storeForward.deliverCachedMessages(peerId, sendFn);

    if (result.delivered > 0) {
      this.emit('cachedMessagesDelivered', {
        peerId,
        delivered: result.delivered
      });
    }
  }

  /**
     * Registers data clearers for panic mode.
     * @private
     */
  _registerPanicClearers() {
    // Clear service data
    this._emergencyManager.registerClearer(async () => {
      await this._service.destroy();
    });

    // Clear store and forward cache
    if (this._storeForward) {
      this._emergencyManager.registerClearer(async () => {
        this._storeForward.clear();
      });
    }

    // Clear monitor data
    this._emergencyManager.registerClearer(() => {
      this._monitor.reset();
    });
  }

  /**
     * Validates that network is running.
     * @throws {MeshError} If not running
     * @private
     */
  _validateRunning() {
    if (this._state !== 'running') {
      throw new MeshError(
        'MeshNetwork is not running. Call start() first.',
        'E900',
        { state: this._state }
      );
    }
  }

  /**
     * Checks if a peer is offline.
     * @param {string} peerId - Peer ID
     * @returns {boolean} True if offline
     * @private
     */
  _isPeerOffline(peerId) {
    const peer = this._service.getPeer(peerId);
    return !peer || !peer.isConnected;
  }

  /**
     * Encodes a message for storage.
     * @param {string} text - Message text
     * @returns {Uint8Array} Encoded payload
     * @private
     */
  _encodeMessage(text) {
    return new TextEncoder().encode(text);
  }

  /**
     * Normalizes channel name (adds # if missing).
     * @param {string} name - Channel name
     * @returns {string} Normalized name
     * @private
     */
  _normalizeChannelName(name) {
    return name.startsWith('#') ? name : `#${name}`;
  }

  /**
     * Maximum allowed message size in bytes (1MB).
     * @constant {number}
     * @private
     */
  static get MAX_MESSAGE_SIZE() {
    return 1024 * 1024;
  }

  /**
     * Validates message text input.
     * @param {string} text - Message text to validate
     * @throws {ValidationError} If text is invalid
     * @private
     */
  _validateMessageText(text) {
    if (text === null || text === undefined) {
      throw ValidationError.missingArgument('text');
    }

    if (typeof text !== 'string') {
      throw ValidationError.invalidType('text', text, 'string');
    }

    if (text.length === 0) {
      throw ValidationError.invalidArgument('text', text, {
        reason: 'Message text cannot be empty'
      });
    }

    // Check size limit (UTF-8 encoded)
    const byteLength = new TextEncoder().encode(text).length;
    if (byteLength > MeshNetwork.MAX_MESSAGE_SIZE) {
      throw ValidationError.outOfRange('text', byteLength, {
        min: 1,
        max: MeshNetwork.MAX_MESSAGE_SIZE
      });
    }
  }

  /**
     * Validates peer ID input.
     * @param {string} peerId - Peer ID to validate
     * @throws {ValidationError} If peerId is invalid
     * @private
     */
  _validatePeerId(peerId) {
    if (peerId === null || peerId === undefined) {
      throw ValidationError.missingArgument('peerId');
    }

    if (typeof peerId !== 'string') {
      throw ValidationError.invalidType('peerId', peerId, 'string');
    }

    if (peerId.trim().length === 0) {
      throw ValidationError.invalidArgument('peerId', peerId, {
        reason: 'Peer ID cannot be empty or whitespace only'
      });
    }
  }
}

// Export convenience constants
MeshNetwork.BatteryMode = BATTERY_MODE;
MeshNetwork.PanicTrigger = PANIC_TRIGGER;
MeshNetwork.HealthStatus = HEALTH_STATUS;

module.exports = {
  MeshNetwork,
  BATTERY_MODE,
  PANIC_TRIGGER,
  HEALTH_STATUS
};
