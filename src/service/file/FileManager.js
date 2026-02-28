'use strict';

/**
 * @fileoverview File transfer manager for mesh network
 * @module service/file/FileManager
 */

const EventEmitter = require('../../utils/EventEmitter');
const FileChunker = require('./FileChunker');
const FileAssembler = require('./FileAssembler');
const { FileMessage, FILE_TRANSFER_STATE } = require('./FileMessage');

/**
 * Default file transfer configuration
 * @constant {Object}
 */
const DEFAULT_CONFIG = Object.freeze({
  chunkSize: 4096,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  transferTimeoutMs: 5 * 60 * 1000, // 5 minutes
  maxConcurrentTransfers: 5
});

/**
 * Manages file transfers over the mesh network.
 * Handles chunking, reassembly, progress tracking, and timeouts.
 *
 * @class FileManager
 * @extends EventEmitter
 *
 * @fires FileManager#sendProgress - When send progress updates
 * @fires FileManager#receiveProgress - When receive progress updates
 * @fires FileManager#fileReceived - When a complete file is received
 * @fires FileManager#transferFailed - When a transfer fails
 * @fires FileManager#transferCancelled - When a transfer is cancelled
 */
class FileManager extends EventEmitter {
  /**
   * @param {Object} [config={}]
   */
  constructor(config = {}) {
    super();
    this._config = { ...DEFAULT_CONFIG, ...config };
    this._chunker = new FileChunker({
      chunkSize: this._config.chunkSize,
      maxFileSize: this._config.maxFileSize
    });

    /** @type {Map<string, Object>} Active outgoing transfers */
    this._outgoing = new Map();
    /** @type {Map<string, Object>} Active incoming transfers */
    this._incoming = new Map();
    /** @type {Map<string, NodeJS.Timeout>} Transfer timeouts */
    this._timeouts = new Map();
  }

  /**
   * Prepares a file for sending. Returns the transfer object with chunks.
   * The caller (MeshNetwork) is responsible for actually sending chunks via transport.
   *
   * @param {string} peerId - Target peer ID
   * @param {Object} fileInfo - File information
   * @param {Uint8Array} fileInfo.data - File data
   * @param {string} fileInfo.name - File name
   * @param {string} [fileInfo.mimeType='application/octet-stream'] - MIME type
   * @returns {Object} Transfer object with id, offer, and chunks
   */
  prepareSend(peerId, fileInfo) {
    if (this._outgoing.size >= this._config.maxConcurrentTransfers) {
      throw new Error('Max concurrent transfers reached');
    }

    const transferId = `ft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const chunks = this._chunker.chunk(fileInfo.data, transferId);

    const fileMeta = new FileMessage({
      id: transferId,
      name: fileInfo.name,
      mimeType: fileInfo.mimeType || 'application/octet-stream',
      size: fileInfo.data.length,
      totalChunks: chunks.length,
      chunkSize: this._chunker.chunkSize
    });

    const transfer = {
      id: transferId,
      peerId,
      meta: fileMeta,
      chunks,
      sentChunks: 0,
      state: FILE_TRANSFER_STATE.PENDING
    };

    this._outgoing.set(transferId, transfer);
    this._setTransferTimeout(transferId);

    return {
      id: transferId,
      offer: fileMeta.toOffer(),
      chunks,
      totalChunks: chunks.length
    };
  }

  /**
   * Marks a chunk as sent and emits progress
   * @param {string} transferId - Transfer ID
   * @param {number} chunkIndex - Chunk index that was sent
   */
  markChunkSent(transferId, _chunkIndex) {
    const transfer = this._outgoing.get(transferId);
    if (!transfer) { return; }

    transfer.sentChunks++;
    if (!transfer.meta.startedAt) {
      transfer.meta.startedAt = Date.now();
    }
    transfer.state = FILE_TRANSFER_STATE.TRANSFERRING;

    const progress = Math.round((transfer.sentChunks / transfer.chunks.length) * 100);
    this.emit('sendProgress', {
      transferId,
      peerId: transfer.peerId,
      name: transfer.meta.name,
      percent: progress
    });

    if (transfer.sentChunks >= transfer.chunks.length) {
      transfer.state = FILE_TRANSFER_STATE.COMPLETE;
      transfer.meta.completedAt = Date.now();
      this._clearTransferTimeout(transferId);
      this._outgoing.delete(transferId);
      this.emit('sendComplete', {
        transferId,
        peerId: transfer.peerId,
        name: transfer.meta.name,
        elapsedMs: transfer.meta.elapsedMs
      });
    }
  }

  /**
   * Handles an incoming file offer
   * @param {Object} offer - File offer metadata
   * @param {string} senderId - Sender peer ID
   * @returns {string} Transfer ID
   */
  handleOffer(offer, senderId) {
    if (this._incoming.size >= this._config.maxConcurrentTransfers) {
      throw new Error('Max concurrent incoming transfers reached');
    }

    // Validate offer fields
    if (!offer || !offer.id || !offer.name) {
      throw new Error('Invalid file offer: missing id or name');
    }
    if (typeof offer.totalChunks !== 'number' || offer.totalChunks <= 0) {
      throw new Error('Invalid file offer: invalid totalChunks');
    }
    if (typeof offer.size !== 'number' || offer.size <= 0) {
      throw new Error('Invalid file offer: invalid size');
    }
    if (offer.size > this._config.maxFileSize) {
      throw new Error(`File too large: ${offer.size} bytes exceeds ${this._config.maxFileSize} byte limit`);
    }

    const fileMeta = FileMessage.fromOffer(offer, senderId);
    const assembler = new FileAssembler(offer.id, offer.totalChunks, offer.size);

    this._incoming.set(offer.id, {
      meta: fileMeta,
      assembler,
      senderId
    });

    this._setTransferTimeout(offer.id);
    return offer.id;
  }

  /**
   * Handles an incoming file chunk
   * @param {string} transferId - Transfer ID
   * @param {number} index - Chunk index
   * @param {Uint8Array} data - Chunk data
   */
  handleChunk(transferId, index, data) {
    const transfer = this._incoming.get(transferId);
    if (!transfer) { return; }

    if (!transfer.meta.startedAt) {
      transfer.meta.startedAt = Date.now();
    }
    transfer.meta.state = FILE_TRANSFER_STATE.TRANSFERRING;

    const isNew = transfer.assembler.addChunk(index, data);
    if (!isNew) { return; }

    transfer.meta.receivedChunks = transfer.assembler.receivedChunks;

    this.emit('receiveProgress', {
      transferId,
      from: transfer.senderId,
      name: transfer.meta.name,
      percent: transfer.assembler.progress
    });

    if (transfer.assembler.isComplete()) {
      const fileData = transfer.assembler.assemble();
      transfer.meta.state = FILE_TRANSFER_STATE.COMPLETE;
      transfer.meta.completedAt = Date.now();
      this._clearTransferTimeout(transferId);
      this._incoming.delete(transferId);

      this.emit('fileReceived', {
        transferId,
        from: transfer.senderId,
        file: {
          name: transfer.meta.name,
          mimeType: transfer.meta.mimeType,
          size: transfer.meta.size,
          data: fileData
        },
        elapsedMs: transfer.meta.elapsedMs
      });
    }
  }

  /**
   * Cancels a transfer (incoming or outgoing)
   * @param {string} transferId - Transfer ID
   */
  cancelTransfer(transferId) {
    this._clearTransferTimeout(transferId);

    if (this._outgoing.has(transferId)) {
      const transfer = this._outgoing.get(transferId);
      transfer.state = FILE_TRANSFER_STATE.CANCELLED;
      this._outgoing.delete(transferId);
      this.emit('transferCancelled', { transferId, direction: 'outgoing' });
    }

    if (this._incoming.has(transferId)) {
      const transfer = this._incoming.get(transferId);
      transfer.meta.state = FILE_TRANSFER_STATE.CANCELLED;
      transfer.assembler.clear();
      this._incoming.delete(transferId);
      this.emit('transferCancelled', { transferId, direction: 'incoming' });
    }
  }

  /**
   * Gets active transfers
   * @returns {Object} { outgoing: [], incoming: [] }
   */
  getActiveTransfers() {
    return {
      outgoing: Array.from(this._outgoing.values()).map(t => ({
        id: t.id, peerId: t.peerId, name: t.meta.name,
        progress: Math.round((t.sentChunks / t.chunks.length) * 100),
        state: t.state
      })),
      incoming: Array.from(this._incoming.values()).map(t => ({
        id: t.meta.id, from: t.senderId, name: t.meta.name,
        progress: t.assembler.progress,
        state: t.meta.state
      }))
    };
  }

  /**
   * Destroys and cleans up
   */
  destroy() {
    for (const id of this._timeouts.keys()) {
      this._clearTransferTimeout(id);
    }
    this._outgoing.clear();
    for (const t of this._incoming.values()) {
      t.assembler.clear();
    }
    this._incoming.clear();
    this.removeAllListeners();
  }

  /** @private */
  _setTransferTimeout(transferId) {
    const timer = setTimeout(() => {
      this.cancelTransfer(transferId);
      this.emit('transferFailed', {
        transferId,
        reason: 'timeout'
      });
    }, this._config.transferTimeoutMs);
    this._timeouts.set(transferId, timer);
  }

  /** @private */
  _clearTransferTimeout(transferId) {
    const timer = this._timeouts.get(transferId);
    if (timer) {
      clearTimeout(timer);
      this._timeouts.delete(transferId);
    }
  }
}

module.exports = FileManager;
