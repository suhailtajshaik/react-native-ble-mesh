'use strict';

/**
 * @fileoverview Routing table for mesh network
 * @module mesh/router/RouteTable
 */

const { MESH_CONFIG } = require('../../constants');
const { ValidationError } = require('../../errors');

/**
 * Route entry
 * @typedef {Object} RouteEntry
 * @property {string} destination - Destination peer ID
 * @property {string} nextHop - Next hop peer ID
 * @property {number} hopCount - Distance in hops
 * @property {number} metric - Route quality metric
 * @property {number} lastUpdated - Last update timestamp
 * @property {number} expiresAt - Expiration timestamp
 */

/**
 * Routing table for tracking paths to peers
 * @class RouteTable
 */
class RouteTable {
  /**
   * Creates a new RouteTable
   * @param {Object} [options] - Configuration options
   * @param {number} [options.routeTimeout] - Route expiration timeout
   * @param {number} [options.maxRoutes] - Maximum routes to store
   */
  constructor(options = {}) {
    /**
     * Route timeout in milliseconds
     * @type {number}
     */
    this.routeTimeout = options.routeTimeout || MESH_CONFIG.ROUTE_TIMEOUT_MS;

    /**
     * Maximum routes to store
     * @type {number}
     */
    this.maxRoutes = options.maxRoutes || 256;

    /**
     * Routes by destination peer ID
     * @type {Map<string, RouteEntry>}
     * @private
     */
    this._routes = new Map();

    /**
     * Direct neighbors (next hop = destination)
     * @type {Set<string>}
     * @private
     */
    this._neighbors = new Set();
  }

  /**
   * Adds or updates a route
   * @param {string} destination - Destination peer ID
   * @param {string} nextHop - Next hop peer ID
   * @param {number} hopCount - Hop count to destination
   * @param {number} [metric] - Quality metric (lower is better)
   * @returns {boolean} True if route was added/updated
   */
  addRoute(destination, nextHop, hopCount, metric = 0) {
    if (!destination || typeof destination !== 'string') {
      throw ValidationError.invalidArgument('destination', destination);
    }
    if (!nextHop || typeof nextHop !== 'string') {
      throw ValidationError.invalidArgument('nextHop', nextHop);
    }
    if (!Number.isInteger(hopCount) || hopCount < 0) {
      throw ValidationError.outOfRange('hopCount', hopCount, { min: 0 });
    }

    const existingRoute = this._routes.get(destination);
    const now = Date.now();

    // Check if we should update the route
    if (existingRoute) {
      // Prefer routes with fewer hops or better metric
      const existingScore = existingRoute.hopCount * 100 + existingRoute.metric;
      const newScore = hopCount * 100 + metric;

      if (newScore >= existingScore && !existingRoute.isExpired) {
        // Only update if same next hop (refresh)
        if (existingRoute.nextHop === nextHop) {
          existingRoute.lastUpdated = now;
          existingRoute.expiresAt = now + this.routeTimeout;
          return true;
        }
        return false;
      }
    }

    // Enforce max routes limit
    if (!existingRoute && this._routes.size >= this.maxRoutes) {
      this._evictOldestRoute();
    }

    const route = {
      destination,
      nextHop,
      hopCount,
      metric,
      lastUpdated: now,
      expiresAt: now + this.routeTimeout
    };

    this._routes.set(destination, route);

    // Track direct neighbors
    if (hopCount === 0 || destination === nextHop) {
      this._neighbors.add(destination);
    }

    return true;
  }

  /**
   * Gets a route to a destination
   * @param {string} destination - Destination peer ID
   * @returns {RouteEntry|undefined} Route or undefined
   */
  getRoute(destination) {
    const route = this._routes.get(destination);
    if (!route) { return undefined; }

    // Check if expired
    if (Date.now() > route.expiresAt) {
      this._routes.delete(destination);
      this._neighbors.delete(destination);
      return undefined;
    }

    return route;
  }

  /**
   * Gets the next hop for a destination
   * @param {string} destination - Destination peer ID
   * @returns {string|null} Next hop peer ID or null
   */
  getNextHop(destination) {
    const route = this.getRoute(destination);
    return route ? route.nextHop : null;
  }

  /**
   * Removes a route
   * @param {string} destination - Destination peer ID
   * @returns {boolean} True if removed
   */
  removeRoute(destination) {
    const removed = this._routes.delete(destination);
    if (removed) {
      this._neighbors.delete(destination);
    }
    return removed;
  }

  /**
   * Removes all routes through a specific next hop
   * @param {string} nextHop - Next hop peer ID
   * @returns {string[]} Removed destination IDs
   */
  removeRoutesVia(nextHop) {
    const removed = [];
    for (const [destination, route] of this._routes) {
      if (route.nextHop === nextHop) {
        this._routes.delete(destination);
        this._neighbors.delete(destination);
        removed.push(destination);
      }
    }
    return removed;
  }

  /**
   * Checks if a route exists
   * @param {string} destination - Destination peer ID
   * @returns {boolean} True if route exists and is valid
   */
  hasRoute(destination) {
    return this.getRoute(destination) !== undefined;
  }

  /**
   * Gets all valid routes
   * @returns {RouteEntry[]} Array of routes
   */
  getAllRoutes() {
    const now = Date.now();
    const routes = [];

    for (const [, route] of this._routes) {
      if (now <= route.expiresAt) {
        routes.push({ ...route });
      }
    }

    return routes;
  }

  /**
   * Gets all direct neighbors
   * @returns {string[]} Array of neighbor peer IDs
   */
  getNeighbors() {
    return Array.from(this._neighbors);
  }

  /**
   * Cleans up expired routes
   * @returns {string[]} Array of removed destination IDs
   */
  cleanup() {
    const removed = [];
    const now = Date.now();

    for (const [destination, route] of this._routes) {
      if (now > route.expiresAt) {
        this._routes.delete(destination);
        this._neighbors.delete(destination);
        removed.push(destination);
      }
    }

    return removed;
  }

  /**
   * Evicts the oldest route
   * @private
   */
  _evictOldestRoute() {
    let oldest = null;
    let oldestTime = Infinity;

    for (const [destination, route] of this._routes) {
      if (route.lastUpdated < oldestTime) {
        oldest = destination;
        oldestTime = route.lastUpdated;
      }
    }

    if (oldest) {
      this._routes.delete(oldest);
      this._neighbors.delete(oldest);
    }
  }

  /**
   * Clears all routes
   */
  clear() {
    this._routes.clear();
    this._neighbors.clear();
  }

  /**
   * Gets the number of routes
   * @returns {number} Route count
   */
  get size() {
    return this._routes.size;
  }

  /**
   * Gets routing table statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const routes = this.getAllRoutes();
    const hopCounts = routes.map(r => r.hopCount);

    return {
      totalRoutes: routes.length,
      directNeighbors: this._neighbors.size,
      maxHops: hopCounts.length > 0 ? Math.max(...hopCounts) : 0,
      avgHops: hopCounts.length > 0
        ? hopCounts.reduce((a, b) => a + b, 0) / hopCounts.length
        : 0
    };
  }
}

module.exports = RouteTable;
