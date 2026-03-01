'use strict';

/**
 * @fileoverview Network Health Monitoring for BLE Mesh Network
 * @module mesh/monitor/NetworkMonitor
 *
 * Provides real-time metrics for mesh network status including
 * active nodes, latency, packet loss, and overall health score.
 */

const EventEmitter = require('../../utils/EventEmitter');

/**
 * Health status levels
 * @constant {any}
 */
const HEALTH_STATUS = Object.freeze({
  GOOD: 'good',
  FAIR: 'fair',
  POOR: 'poor',
  UNKNOWN: 'unknown'
});

/**
 * Default monitoring configuration
 * @constant {any}
 */
const DEFAULT_CONFIG = Object.freeze({
  /** Sample window size for latency calculations */
  latencySampleSize: 100,
  /** Node timeout in ms (mark as inactive after this) */
  nodeTimeoutMs: 60 * 1000,
  /** Health check interval in ms */
  healthCheckIntervalMs: 30 * 1000,
  /** Latency thresholds in ms */
  latencyThresholds: {
    good: 500,
    fair: 1000,
    poor: 2000
  },
  /** Packet loss thresholds (0-1) */
  packetLossThresholds: {
    good: 0.05,
    fair: 0.20,
    poor: 0.50
  },
  /** Minimum nodes for good health */
  minActiveNodes: 2
});

/**
 * Node health information
 * @typedef {Object} NodeHealth
 * @property {string} peerId - Peer ID
 * @property {number} lastSeen - Last seen timestamp
 * @property {number} latency - Average latency in ms
 * @property {number} messagesReceived - Messages received from node
 * @property {number} messagesSent - Messages sent to node
 * @property {number} packetLoss - Packet loss rate (0-1)
 * @property {boolean} isActive - Whether node is active
 */

/**
 * Network health report
 * @typedef {Object} NetworkHealth
 * @property {number} activeNodes - Number of active nodes
 * @property {number} totalKnownNodes - Total known nodes
 * @property {number} averageLatencyMs - Average latency in ms
 * @property {number} packetLossRate - Overall packet loss rate (0-1)
 * @property {string} overallHealth - 'good' | 'fair' | 'poor'
 * @property {number} lastUpdated - Timestamp of last update
 */

/**
 * Network health monitoring for mesh network.
 *
 * @class NetworkMonitor
 * @extends EventEmitter
 * @example
 * const monitor = new NetworkMonitor();
 *
 * // Track message delivery
 * monitor.trackMessageSent(peerId, messageId);
 * monitor.trackMessageDelivered(messageId, latencyMs);
 *
 * // Get health report
 * const health = monitor.generateHealthReport();
 * console.log(`${health.activeNodes} active peers, ${health.averageLatencyMs}ms latency`);
 */
class NetworkMonitor extends EventEmitter {
  /**
     * Creates a new NetworkMonitor instance.
     * @param {any} [options={}] - Configuration options
     */
  constructor(options = {}) {
    super();

    /**
         * Configuration
         * @type {any}
         * @private
         */
    this._config = { ...DEFAULT_CONFIG, ...options };

    /**
         * Node health tracking
         * @type {Map<string, any>}
         * @private
         */
    this._nodes = new Map();

    /**
         * Pending messages awaiting delivery confirmation
         * @type {Map<string, { peerId: string, timestamp: number }>}
         * @private
         */
    this._pendingMessages = new Map();

    /**
         * Latency samples (circular buffer)
         * @type {Float64Array}
         * @private
         */
    this._latencies = new Float64Array(this._config.latencySampleSize);

    /**
         * Circular buffer write index
         * @type {number}
         * @private
         */
    this._latencyIndex = 0;

    /**
         * Number of latency samples stored
         * @type {number}
         * @private
         */
    this._latencyCount = 0;

    /**
         * Running sum of latency samples for O(1) average
         * @type {number}
         * @private
         */
    this._latencySum = 0;

    /**
         * Global statistics
         * @type {any}
         * @private
         */
    this._stats = {
      totalMessagesSent: 0,
      totalMessagesDelivered: 0,
      totalMessagesFailed: 0,
      totalMessagesReceived: 0
    };

    /**
         * Health check timer
         * @type {any}
         * @private
         */
    this._healthCheckTimer = null;

    /**
         * Last health report
         * @type {NetworkHealth|null}
         * @private
         */
    this._lastHealthReport = null;

    /**
         * Previous health status for change detection
         * @type {string|null}
         * @private
         */
    this._previousHealth = null;

    // Start health check timer
    this._startHealthCheck();
  }

  /**
     * Tracks a message being sent to a peer.
     * @param {string} peerId - Target peer ID
     * @param {string} messageId - Message ID
     */
  trackMessageSent(peerId, messageId) {
    const now = Date.now();

    // Update node stats
    const node = this._getOrCreateNode(peerId);
    node.messagesSent++;
    node.lastSeen = now;

    // Track pending message
    this._pendingMessages.set(messageId, {
      peerId,
      timestamp: now
    });

    this._stats.totalMessagesSent++;
  }

  /**
     * Tracks successful message delivery.
     * @param {string} messageId - Message ID
     * @param {number} [latencyMs] - Delivery latency in ms
     */
  trackMessageDelivered(messageId, latencyMs) {
    const pending = this._pendingMessages.get(messageId);
    if (!pending) {
      return;
    }

    const now = Date.now();
    const actualLatency = latencyMs || (now - pending.timestamp);

    // Update node stats
    const node = this._getOrCreateNode(pending.peerId);
    node.messagesDelivered = (node.messagesDelivered || 0) + 1;
    node.lastSeen = now;

    // Update latency
    this._addLatencySample(actualLatency);
    this._updateNodeLatency(node, actualLatency);

    // Clean up
    this._pendingMessages.delete(messageId);
    this._stats.totalMessagesDelivered++;
  }

  /**
     * Tracks message delivery failure.
     * @param {string} messageId - Message ID
     */
  trackMessageFailed(messageId) {
    const pending = this._pendingMessages.get(messageId);
    if (!pending) {
      return;
    }

    // Update node stats
    const node = this._getOrCreateNode(pending.peerId);
    node.messagesFailed = (node.messagesFailed || 0) + 1;

    // Recalculate packet loss
    this._updateNodePacketLoss(node);

    // Clean up
    this._pendingMessages.delete(messageId);
    this._stats.totalMessagesFailed++;
  }

  /**
     * Tracks message received from a peer.
     * @param {string} peerId - Source peer ID
     */
  trackMessageReceived(peerId) {
    const node = this._getOrCreateNode(peerId);
    node.messagesReceived++;
    node.lastSeen = Date.now();
    this._stats.totalMessagesReceived++;
  }

  /**
     * Registers a peer discovery/connection.
     * @param {string} peerId - Peer ID
     */
  trackPeerDiscovered(peerId) {
    const node = this._getOrCreateNode(peerId);
    node.discoveredAt = Date.now();
    node.lastSeen = Date.now();
  }

  /**
     * Tracks peer disconnection.
     * @param {string} peerId - Peer ID
     */
  trackPeerDisconnected(peerId) {
    const node = this._nodes.get(peerId);
    if (node) {
      node.isActive = false;
      node.disconnectedAt = Date.now();
    }
  }

  /**
     * Generates a network health report.
     * @returns {NetworkHealth} Health report
     */
  generateHealthReport() {
    const now = Date.now();
    const timeout = this._config.nodeTimeoutMs;

    // Count active nodes
    let activeNodes = 0;
    let totalLatency = 0;
    let latencyCount = 0;
    let totalSent = 0;
    let totalDelivered = 0;

    for (const node of this._nodes.values()) {
      // Check if node is active
      const isActive = (now - node.lastSeen) < timeout;
      node.isActive = isActive;

      if (isActive) {
        activeNodes++;

        if (node.latency > 0) {
          totalLatency += node.latency;
          latencyCount++;
        }

        totalSent += node.messagesSent || 0;
        totalDelivered += (node.messagesDelivered || 0);
      }
    }

    // Calculate averages
    const averageLatency = latencyCount > 0
      ? Math.round(totalLatency / latencyCount)
      : this._calculateAverageLatency();

    const packetLoss = totalSent > 0
      ? 1 - (totalDelivered / totalSent)
      : 0;

    // Assess overall health
    const health = this._assessHealth(activeNodes, averageLatency, packetLoss);

    const report = {
      activeNodes,
      totalKnownNodes: this._nodes.size,
      averageLatencyMs: averageLatency,
      packetLossRate: Math.round(packetLoss * 1000) / 1000,
      overallHealth: health,
      lastUpdated: now
    };

    this._lastHealthReport = report;

    // Emit event if health changed
    if (this._previousHealth !== health) {
      this.emit('health-changed', {
        previous: this._previousHealth || HEALTH_STATUS.UNKNOWN,
        current: health,
        report
      });
      this._previousHealth = health;
    }

    return report;
  }

  /**
     * Gets detailed health for a specific node.
     * @param {string} peerId - Peer ID
     * @returns {any} Node health or null
     */
  getNodeHealth(peerId) {
    const node = this._nodes.get(peerId);
    if (!node) {
      return null;
    }

    const now = Date.now();
    return {
      ...node,
      isActive: (now - node.lastSeen) < this._config.nodeTimeoutMs
    };
  }

  /**
     * Gets health information for all nodes.
     * @returns {any[]} Array of node health
     */
  getAllNodeHealth() {
    const now = Date.now();
    const timeout = this._config.nodeTimeoutMs;

    return Array.from(this._nodes.values()).map((/** @type {any} */ node) => ({
      ...node,
      isActive: (now - node.lastSeen) < timeout
    }));
  }

  /**
     * Gets the last generated health report.
     * @returns {NetworkHealth|null} Last report
     */
  getLastHealthReport() {
    return this._lastHealthReport;
  }

  /**
     * Gets monitoring statistics.
     * @returns {any} Statistics
     */
  getStats() {
    return {
      ...this._stats,
      knownNodes: this._nodes.size,
      pendingMessages: this._pendingMessages.size,
      averageLatency: this._calculateAverageLatency()
    };
  }

  /**
     * Resets all monitoring data.
     */
  reset() {
    this._nodes.clear();
    this._pendingMessages.clear();
    this._latencies = new Float64Array(this._config.latencySampleSize);
    this._latencyIndex = 0;
    this._latencyCount = 0;
    this._latencySum = 0;
    this._stats = {
      totalMessagesSent: 0,
      totalMessagesDelivered: 0,
      totalMessagesFailed: 0,
      totalMessagesReceived: 0
    };
    this._lastHealthReport = null;
    this._previousHealth = null;
  }

  /**
     * Destroys the monitor.
     */
  destroy() {
    this._stopHealthCheck();
    this.reset();
    this.removeAllListeners();
  }

  /**
     * Gets or creates a node entry.
     * @param {string} peerId - Peer ID
     * @returns {any} Node entry
     * @private
     */
  _getOrCreateNode(peerId) {
    if (!this._nodes.has(peerId)) {
      this._nodes.set(peerId, {
        peerId,
        lastSeen: Date.now(),
        latency: 0,
        messagesReceived: 0,
        messagesSent: 0,
        messagesDelivered: 0,
        messagesFailed: 0,
        packetLoss: 0,
        isActive: true
      });
    }
    return this._nodes.get(peerId);
  }

  /**
     * Adds a latency sample using circular buffer.
     * @param {number} latency - Latency in ms
     * @private
     */
  _addLatencySample(latency) {
    const capacity = this._latencies.length;
    // Subtract the old value being overwritten if buffer is full
    if (this._latencyCount >= capacity) {
      this._latencySum -= this._latencies[this._latencyIndex];
    }
    this._latencies[this._latencyIndex] = latency;
    this._latencySum += latency;
    this._latencyIndex = (this._latencyIndex + 1) % capacity;
    if (this._latencyCount < capacity) {
      this._latencyCount++;
    }
  }

  /**
     * Updates node latency with exponential moving average.
     * @param {any} node - Node to update
     * @param {number} latency - New latency sample
     * @private
     */
  _updateNodeLatency(node, latency) {
    const alpha = 0.2; // Smoothing factor
    if (node.latency === 0) {
      node.latency = latency;
    } else {
      node.latency = alpha * latency + (1 - alpha) * node.latency;
    }
  }

  /**
     * Updates node packet loss rate.
     * @param {any} node - Node to update
     * @private
     */
  _updateNodePacketLoss(node) {
    const total = (node.messagesDelivered || 0) + (node.messagesFailed || 0);
    if (total > 0) {
      node.packetLoss = (node.messagesFailed || 0) / total;
    }
  }

  /**
     * Calculates average latency from samples (O(1) using running sum).
     * @returns {number} Average latency
     * @private
     */
  _calculateAverageLatency() {
    if (this._latencyCount === 0) {
      return 0;
    }
    return Math.round(this._latencySum / this._latencyCount);
  }

  /**
     * Cleans up stale pending messages older than nodeTimeoutMs.
     * @private
     */
  _cleanupPendingMessages() {
    const now = Date.now();
    const timeout = this._config.nodeTimeoutMs;
    for (const [messageId, pending] of this._pendingMessages) {
      if (now - pending.timestamp > timeout) {
        this._pendingMessages.delete(messageId);
        this._stats.totalMessagesFailed++;
      }
    }
  }

  /**
     * Assesses overall network health.
     * @param {number} activeNodes - Active node count
     * @param {number} latency - Average latency
     * @param {number} packetLoss - Packet loss rate
     * @returns {string} Health status
     * @private
     */
  _assessHealth(activeNodes, latency, packetLoss) {
    const { latencyThresholds, packetLossThresholds, minActiveNodes } = this._config;

    // Check for poor indicators
    if (activeNodes < minActiveNodes ||
            packetLoss > packetLossThresholds.poor ||
            latency > latencyThresholds.poor) {
      return HEALTH_STATUS.POOR;
    }

    // Check for fair indicators
    if (activeNodes < minActiveNodes * 2 ||
            packetLoss > packetLossThresholds.fair ||
            latency > latencyThresholds.fair) {
      return HEALTH_STATUS.FAIR;
    }

    return HEALTH_STATUS.GOOD;
  }

  /**
     * Starts periodic health checks.
     * @private
     */
  _startHealthCheck() {
    if (this._healthCheckTimer) { return; }

    this._healthCheckTimer = setInterval(
      () => {
        try {
          this._cleanupPendingMessages();
          const report = this.generateHealthReport();
          this.emit('health-report', report);
        } catch (_error) {
          // Don't let health check errors crash the monitor
        }
      },
      this._config.healthCheckIntervalMs
    );

    // Don't prevent process exit
    if (this._healthCheckTimer && typeof this._healthCheckTimer.unref === 'function') {
      this._healthCheckTimer.unref();
    }
  }

  /**
     * Stops periodic health checks.
     * @private
     */
  _stopHealthCheck() {
    if (this._healthCheckTimer) {
      clearInterval(this._healthCheckTimer);
      this._healthCheckTimer = null;
    }
  }
}

module.exports = {
  NetworkMonitor,
  HEALTH_STATUS,
  DEFAULT_CONFIG
};
