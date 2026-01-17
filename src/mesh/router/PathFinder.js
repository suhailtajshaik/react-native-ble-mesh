'use strict';

/**
 * @fileoverview Route discovery and path finding logic
 * @module mesh/router/PathFinder
 */

const EventEmitter = require('events');
const { MESH_CONFIG } = require('../../constants');
const { ValidationError } = require('../../errors');

/**
 * Route request entry
 * @typedef {Object} RouteRequest
 * @property {string} requestId - Unique request ID
 * @property {string} destination - Target peer ID
 * @property {number} createdAt - Request creation timestamp
 * @property {number} expiresAt - Request expiration timestamp
 * @property {Function} resolve - Promise resolve function
 * @property {Function} reject - Promise reject function
 */

/**
 * Path finder for route discovery
 * @class PathFinder
 * @extends EventEmitter
 */
class PathFinder extends EventEmitter {
  /**
   * Creates a new PathFinder
   * @param {Object} options - Configuration options
   * @param {string} options.localPeerId - Local peer ID
   * @param {Object} options.routeTable - RouteTable instance
   * @param {number} [options.discoveryTimeout] - Route discovery timeout
   */
  constructor(options = {}) {
    super();

    if (!options.localPeerId) {
      throw ValidationError.missingArgument('localPeerId');
    }
    if (!options.routeTable) {
      throw ValidationError.missingArgument('routeTable');
    }

    /**
     * Local peer ID
     * @type {string}
     */
    this.localPeerId = options.localPeerId;

    /**
     * Route table reference
     * @type {Object}
     */
    this.routeTable = options.routeTable;

    /**
     * Discovery timeout in milliseconds
     * @type {number}
     */
    this.discoveryTimeout = options.discoveryTimeout || 10000;

    /**
     * Pending route requests
     * @type {Map<string, RouteRequest>}
     * @private
     */
    this._pendingRequests = new Map();

    /**
     * Request counter for unique IDs
     * @type {number}
     * @private
     */
    this._requestCounter = 0;

    /**
     * Statistics
     * @type {Object}
     * @private
     */
    this._stats = {
      requestsSent: 0,
      requestsReceived: 0,
      repliesSent: 0,
      repliesReceived: 0,
      routesDiscovered: 0,
      requestsTimedOut: 0
    };
  }

  /**
   * Finds a route to a destination
   * @param {string} destination - Target peer ID
   * @returns {Promise<Object|null>} Route or null if not found
   */
  async findRoute(destination) {
    if (!destination || typeof destination !== 'string') {
      throw ValidationError.invalidArgument('destination', destination);
    }

    // Check existing route first
    const existingRoute = this.routeTable.getRoute(destination);
    if (existingRoute) {
      return existingRoute;
    }

    // Initiate route discovery
    return this._initiateDiscovery(destination);
  }

  /**
   * Initiates route discovery for a destination
   * @param {string} destination - Target peer ID
   * @returns {Promise<Object|null>} Discovered route or null
   * @private
   */
  _initiateDiscovery(destination) {
    return new Promise((resolve, reject) => {
      const requestId = this._generateRequestId();
      const now = Date.now();

      const request = {
        requestId,
        destination,
        createdAt: now,
        expiresAt: now + this.discoveryTimeout,
        resolve,
        reject
      };

      this._pendingRequests.set(requestId, request);
      this._stats.requestsSent++;

      // Emit discovery request event
      this.emit('discovery:request', {
        requestId,
        destination,
        sourcePeerId: this.localPeerId,
        hopCount: 0
      });

      // Set timeout
      setTimeout(() => {
        if (this._pendingRequests.has(requestId)) {
          this._pendingRequests.delete(requestId);
          this._stats.requestsTimedOut++;
          resolve(null);
        }
      }, this.discoveryTimeout);
    });
  }

  /**
   * Generates a unique request ID
   * @returns {string} Request ID
   * @private
   */
  _generateRequestId() {
    this._requestCounter = (this._requestCounter + 1) % 0xFFFFFFFF;
    return `${this.localPeerId}:${this._requestCounter}:${Date.now()}`;
  }

  /**
   * Processes an incoming route request
   * @param {Object} request - Route request data
   * @param {string} sourcePeerId - Source peer ID
   * @returns {Object|null} Reply to send or null
   */
  processRouteRequest(request, sourcePeerId) {
    this._stats.requestsReceived++;

    const { requestId, destination, hopCount = 0 } = request;

    // Ignore requests for ourselves
    if (request.sourcePeerId === this.localPeerId) {
      return null;
    }

    // Check if we are the destination
    if (destination === this.localPeerId) {
      this._stats.repliesSent++;
      return {
        type: 'route:reply',
        requestId,
        destination,
        nextHop: this.localPeerId,
        hopCount: 0,
        success: true
      };
    }

    // Check if we have a route
    const route = this.routeTable.getRoute(destination);
    if (route) {
      this._stats.repliesSent++;
      return {
        type: 'route:reply',
        requestId,
        destination,
        nextHop: this.localPeerId,
        hopCount: route.hopCount + 1,
        success: true
      };
    }

    // Forward the request if within hop limit
    if (hopCount < MESH_CONFIG.MAX_HOPS) {
      this.emit('discovery:forward', {
        ...request,
        hopCount: hopCount + 1,
        previousHop: sourcePeerId
      });
    }

    return null;
  }

  /**
   * Processes an incoming route reply
   * @param {Object} reply - Route reply data
   * @param {string} sourcePeerId - Source peer ID
   */
  processRouteReply(reply, sourcePeerId) {
    this._stats.repliesReceived++;

    const { requestId, destination, hopCount, success } = reply;
    const pendingRequest = this._pendingRequests.get(requestId);

    if (!pendingRequest) {
      // Not our request, may need to forward
      return;
    }

    this._pendingRequests.delete(requestId);

    if (success) {
      // Add route to table
      this.routeTable.addRoute(destination, sourcePeerId, hopCount + 1);
      this._stats.routesDiscovered++;

      const route = this.routeTable.getRoute(destination);
      pendingRequest.resolve(route);
    } else {
      pendingRequest.resolve(null);
    }
  }

  /**
   * Updates route information from received messages
   * @param {string} sourcePeerId - Source peer ID
   * @param {string} originalSender - Original message sender
   * @param {number} hopCount - Current hop count
   */
  updateRouteFromMessage(sourcePeerId, originalSender, hopCount) {
    // Add/update route to original sender via source peer
    if (originalSender !== this.localPeerId) {
      this.routeTable.addRoute(originalSender, sourcePeerId, hopCount);
    }

    // Direct neighbor
    if (sourcePeerId !== this.localPeerId) {
      this.routeTable.addRoute(sourcePeerId, sourcePeerId, 0);
    }
  }

  /**
   * Gets pending request count
   * @returns {number} Number of pending requests
   */
  getPendingCount() {
    return this._pendingRequests.size;
  }

  /**
   * Cleans up expired requests
   * @returns {number} Number of cleaned up requests
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [requestId, request] of this._pendingRequests) {
      if (now > request.expiresAt) {
        request.resolve(null);
        this._pendingRequests.delete(requestId);
        this._stats.requestsTimedOut++;
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Gets path finder statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this._stats,
      pendingRequests: this._pendingRequests.size
    };
  }

  /**
   * Resets statistics
   */
  resetStats() {
    this._stats = {
      requestsSent: 0,
      requestsReceived: 0,
      repliesSent: 0,
      repliesReceived: 0,
      routesDiscovered: 0,
      requestsTimedOut: 0
    };
  }

  /**
   * Clears all pending requests
   */
  clear() {
    for (const request of this._pendingRequests.values()) {
      request.resolve(null);
    }
    this._pendingRequests.clear();
  }
}

module.exports = PathFinder;
