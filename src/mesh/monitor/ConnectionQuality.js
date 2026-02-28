'use strict';

/**
 * @fileoverview Connection Quality Calculator
 * @module mesh/monitor/ConnectionQuality
 *
 * Calculates real-time connection quality per peer based on
 * RSSI, latency, packet loss, and throughput metrics.
 */

const EventEmitter = require('../../utils/EventEmitter');

/**
 * Connection quality levels
 * @constant {Object}
 */
const QUALITY_LEVEL = Object.freeze({
  EXCELLENT: 'excellent',
  GOOD: 'good',
  FAIR: 'fair',
  POOR: 'poor',
  DISCONNECTED: 'disconnected'
});

/**
 * Default quality configuration
 * @constant {Object}
 */
const DEFAULT_CONFIG = Object.freeze({
  /** How often to recalculate quality (ms) */
  updateIntervalMs: 5000,
  /** RSSI thresholds (dBm) */
  rssiThresholds: { excellent: -50, good: -70, fair: -85 },
  /** Latency thresholds (ms) */
  latencyThresholds: { excellent: 100, good: 300, fair: 1000 },
  /** Packet loss thresholds (ratio 0-1) */
  packetLossThresholds: { excellent: 0.01, good: 0.05, fair: 0.15 },
  /** Throughput thresholds (kbps) */
  throughputThresholds: { excellent: 200, good: 100, fair: 50 },
  /** Scoring weights */
  weights: { rssi: 0.3, latency: 0.3, packetLoss: 0.25, throughput: 0.15 },
  /** Number of samples to keep per metric */
  sampleSize: 20,
  /** Peer timeout — mark disconnected after this (ms) */
  peerTimeoutMs: 30000
});

/**
 * Per-peer quality metrics tracker
 * @class PeerQualityTracker
 */
class PeerQualityTracker {
  constructor(peerId, config) {
    this.peerId = peerId;
    this._config = config;
    this._rssiSamples = [];
    this._latencySamples = [];
    this._packetsSent = 0;
    this._packetsAcked = 0;
    this._bytesTransferred = 0;
    this._transferStartTime = null;
    this._lastActivity = Date.now();
    this._transport = 'ble';
    this._currentLevel = QUALITY_LEVEL.GOOD;
  }

  /**
   * Records an RSSI sample
   * @param {number} rssi - Signal strength in dBm
   */
  recordRssi(rssi) {
    this._rssiSamples.push(rssi);
    if (this._rssiSamples.length > this._config.sampleSize) {
      this._rssiSamples.shift();
    }
    this._lastActivity = Date.now();
  }

  /**
   * Records a latency measurement
   * @param {number} latencyMs - Round-trip latency in ms
   */
  recordLatency(latencyMs) {
    this._latencySamples.push(latencyMs);
    if (this._latencySamples.length > this._config.sampleSize) {
      this._latencySamples.shift();
    }
    this._lastActivity = Date.now();
  }

  /**
   * Records a sent packet (for packet loss calculation)
   */
  recordPacketSent() {
    this._packetsSent++;
    this._lastActivity = Date.now();
  }

  /**
   * Records a received acknowledgment
   */
  recordPacketAcked() {
    this._packetsAcked++;
    this._lastActivity = Date.now();
  }

  /**
   * Records bytes transferred (for throughput calculation)
   * @param {number} bytes - Number of bytes
   */
  recordBytesTransferred(bytes) {
    if (!this._transferStartTime) {
      this._transferStartTime = Date.now();
    }
    this._bytesTransferred += bytes;
    this._lastActivity = Date.now();
  }

  /**
   * Sets the active transport type
   * @param {string} transport - Transport name ('ble', 'wifi-direct', etc.)
   */
  setTransport(transport) {
    this._transport = transport;
  }

  /**
   * Gets the average RSSI
   * @returns {number|null}
   */
  getAvgRssi() {
    if (this._rssiSamples.length === 0) { return null; }
    return this._rssiSamples.reduce((a, b) => a + b, 0) / this._rssiSamples.length;
  }

  /**
   * Gets the average latency
   * @returns {number|null}
   */
  getAvgLatency() {
    if (this._latencySamples.length === 0) { return null; }
    return this._latencySamples.reduce((a, b) => a + b, 0) / this._latencySamples.length;
  }

  /**
   * Gets the packet loss ratio
   * @returns {number}
   */
  getPacketLoss() {
    if (this._packetsSent === 0) { return 0; }
    return 1 - (this._packetsAcked / this._packetsSent);
  }

  /**
   * Gets estimated throughput in kbps
   * @returns {number}
   */
  getThroughputKbps() {
    if (!this._transferStartTime || this._bytesTransferred === 0) { return 0; }
    const elapsedMs = Date.now() - this._transferStartTime;
    if (elapsedMs === 0) { return 0; }
    return (this._bytesTransferred * 8) / elapsedMs; // kbps
  }

  /**
   * Checks if peer has timed out
   * @returns {boolean}
   */
  isTimedOut() {
    return (Date.now() - this._lastActivity) > this._config.peerTimeoutMs;
  }

  /**
   * Calculates quality score (0-1) for a metric
   * @param {number|null} value - Metric value
   * @param {Object} thresholds - {excellent, good, fair}
   * @param {boolean} [higherIsBetter=false]
   * @returns {number}
   */
  _scoreMetric(value, thresholds, higherIsBetter = false) {
    if (value === null || value === undefined) { return 0.5; } // neutral

    if (higherIsBetter) {
      if (value >= thresholds.excellent) { return 1.0; }
      if (value >= thresholds.good) { return 0.75; }
      if (value >= thresholds.fair) { return 0.5; }
      return 0.25;
    } else {
      // Lower is better (latency, packet loss)
      if (value <= thresholds.excellent) { return 1.0; }
      if (value <= thresholds.good) { return 0.75; }
      if (value <= thresholds.fair) { return 0.5; }
      return 0.25;
    }
  }

  /**
   * Calculates overall quality
   * @returns {Object} Quality report
   */
  calculate() {
    if (this.isTimedOut()) {
      return {
        peerId: this.peerId,
        level: QUALITY_LEVEL.DISCONNECTED,
        score: 0,
        rssi: null,
        latencyMs: null,
        packetLoss: 0,
        throughputKbps: 0,
        transport: this._transport,
        lastUpdated: this._lastActivity
      };
    }

    const rssi = this.getAvgRssi();
    const latency = this.getAvgLatency();
    const packetLoss = this.getPacketLoss();
    const throughput = this.getThroughputKbps();

    const w = this._config.weights;
    const rssiScore = this._scoreMetric(rssi, this._config.rssiThresholds, true);
    const latencyScore = this._scoreMetric(latency, this._config.latencyThresholds, false);
    const plScore = this._scoreMetric(packetLoss, this._config.packetLossThresholds, false);
    const tpScore = this._scoreMetric(throughput, this._config.throughputThresholds, true);

    const score = (rssiScore * w.rssi) + (latencyScore * w.latency) +
                  (plScore * w.packetLoss) + (tpScore * w.throughput);

    let level;
    if (score >= 0.8) { level = QUALITY_LEVEL.EXCELLENT; } else if (score >= 0.6) { level = QUALITY_LEVEL.GOOD; } else if (score >= 0.4) { level = QUALITY_LEVEL.FAIR; } else { level = QUALITY_LEVEL.POOR; }

    const previousLevel = this._currentLevel;
    this._currentLevel = level;

    return {
      peerId: this.peerId,
      level,
      score: Math.round(score * 100) / 100,
      rssi: rssi !== null ? Math.round(rssi) : null,
      latencyMs: latency !== null ? Math.round(latency) : null,
      packetLoss: Math.round(packetLoss * 1000) / 1000,
      throughputKbps: Math.round(throughput),
      transport: this._transport,
      lastUpdated: Date.now(),
      changed: previousLevel !== level
    };
  }
}

/**
 * ConnectionQuality — manages quality tracking for all peers
 * @class ConnectionQuality
 * @extends EventEmitter
 */
class ConnectionQuality extends EventEmitter {
  /**
   * @param {Object} [config={}]
   */
  constructor(config = {}) {
    super();
    this._config = { ...DEFAULT_CONFIG, ...config };
    /** @type {Map<string, PeerQualityTracker>} */
    this._peers = new Map();
    this._updateTimer = null;
  }

  /**
   * Starts periodic quality updates
   */
  start() {
    if (this._updateTimer) { return; }
    this._updateTimer = setInterval(() => this._update(), this._config.updateIntervalMs);
  }

  /**
   * Stops periodic updates
   */
  stop() {
    if (this._updateTimer) {
      clearInterval(this._updateTimer);
      this._updateTimer = null;
    }
  }

  /**
   * Destroys and cleans up
   */
  destroy() {
    this.stop();
    this._peers.clear();
    this.removeAllListeners();
  }

  /**
   * Gets or creates a tracker for a peer
   * @param {string} peerId
   * @returns {PeerQualityTracker}
   */
  _getTracker(peerId) {
    if (!this._peers.has(peerId)) {
      this._peers.set(peerId, new PeerQualityTracker(peerId, this._config));
    }
    return this._peers.get(peerId);
  }

  /**
   * Records RSSI for a peer
   * @param {string} peerId
   * @param {number} rssi
   */
  recordRssi(peerId, rssi) {
    this._getTracker(peerId).recordRssi(rssi);
  }

  /**
   * Records latency for a peer
   * @param {string} peerId
   * @param {number} latencyMs
   */
  recordLatency(peerId, latencyMs) {
    this._getTracker(peerId).recordLatency(latencyMs);
  }

  /**
   * Records a sent packet
   * @param {string} peerId
   */
  recordPacketSent(peerId) {
    this._getTracker(peerId).recordPacketSent();
  }

  /**
   * Records a received ack
   * @param {string} peerId
   */
  recordPacketAcked(peerId) {
    this._getTracker(peerId).recordPacketAcked();
  }

  /**
   * Records bytes transferred
   * @param {string} peerId
   * @param {number} bytes
   */
  recordBytesTransferred(peerId, bytes) {
    this._getTracker(peerId).recordBytesTransferred(bytes);
  }

  /**
   * Sets transport type for a peer
   * @param {string} peerId
   * @param {string} transport
   */
  setTransport(peerId, transport) {
    this._getTracker(peerId).setTransport(transport);
  }

  /**
   * Removes a peer tracker
   * @param {string} peerId
   */
  removePeer(peerId) {
    this._peers.delete(peerId);
  }

  /**
   * Gets quality for a specific peer
   * @param {string} peerId
   * @returns {Object|null}
   */
  getQuality(peerId) {
    const tracker = this._peers.get(peerId);
    if (!tracker) { return null; }
    return tracker.calculate();
  }

  /**
   * Gets quality for all peers
   * @returns {Object[]}
   */
  getAllQuality() {
    const results = [];
    for (const tracker of this._peers.values()) {
      results.push(tracker.calculate());
    }
    return results;
  }

  /**
   * Periodic update — recalculates all qualities and emits changes
   * @private
   */
  _update() {
    for (const tracker of this._peers.values()) {
      const quality = tracker.calculate();
      if (quality.changed) {
        this.emit('qualityChanged', quality);
      }
    }
  }
}

module.exports = {
  ConnectionQuality,
  PeerQualityTracker,
  QUALITY_LEVEL
};
