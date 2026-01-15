'use strict';

/**
 * @fileoverview Debug and logging utilities for BLE Mesh
 * @module utils/debug
 *
 * Enable debug output by setting:
 *   - Environment variable: DEBUG=ble-mesh:*
 *   - Or programmatically: debug.enable('ble-mesh:*')
 *
 * Namespaces:
 *   - ble-mesh:service - MeshService events
 *   - ble-mesh:transport - Transport layer
 *   - ble-mesh:crypto - Cryptographic operations
 *   - ble-mesh:handshake - Noise handshake
 *   - ble-mesh:mesh - Mesh routing
 *   - ble-mesh:* - All namespaces
 */

// Check for debug environment variable
const DEBUG_ENV = typeof process !== 'undefined' && process.env && process.env.DEBUG;

// Active debug namespaces
const activeNamespaces = new Set();

// Parse debug patterns
function parseDebugPatterns(patterns) {
  if (!patterns) return;
  const parts = patterns.split(',').map(p => p.trim());
  for (const part of parts) {
    if (part.startsWith('-')) {
      activeNamespaces.delete(part.slice(1));
    } else {
      activeNamespaces.add(part);
    }
  }
}

// Initialize from environment
if (DEBUG_ENV) {
  parseDebugPatterns(DEBUG_ENV);
}

/**
 * Check if a namespace is enabled
 * @param {string} namespace - Namespace to check
 * @returns {boolean}
 */
function isEnabled(namespace) {
  if (activeNamespaces.has('*') || activeNamespaces.has('ble-mesh:*')) {
    return true;
  }
  if (activeNamespaces.has(namespace)) {
    return true;
  }
  // Check wildcard patterns
  for (const pattern of activeNamespaces) {
    if (pattern.endsWith(':*')) {
      const prefix = pattern.slice(0, -1);
      if (namespace.startsWith(prefix)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Create a debug logger for a namespace
 * @param {string} namespace - Debug namespace (e.g., 'ble-mesh:service')
 * @returns {Function} Debug logger function
 */
function createDebugger(namespace) {
  const logger = (...args) => {
    if (!isEnabled(namespace)) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] ${namespace}`;

    // Format message
    const message = args
      .map(arg => {
        if (arg instanceof Error) {
          return `${arg.name}: ${arg.message}`;
        }
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(' ');

    console.log(`${prefix} ${message}`);
  };

  logger.namespace = namespace;
  logger.enabled = () => isEnabled(namespace);

  return logger;
}

/**
 * Enable debug namespaces
 * @param {string} patterns - Comma-separated namespace patterns
 * @example
 * debug.enable('ble-mesh:*')
 * debug.enable('ble-mesh:service,ble-mesh:crypto')
 */
function enable(patterns) {
  parseDebugPatterns(patterns);
}

/**
 * Disable debug output
 */
function disable() {
  activeNamespaces.clear();
}

/**
 * Get list of enabled namespaces
 * @returns {string[]}
 */
function getEnabled() {
  return Array.from(activeNamespaces);
}

// Pre-defined debuggers for common namespaces
const debuggers = {
  service: createDebugger('ble-mesh:service'),
  transport: createDebugger('ble-mesh:transport'),
  crypto: createDebugger('ble-mesh:crypto'),
  handshake: createDebugger('ble-mesh:handshake'),
  mesh: createDebugger('ble-mesh:mesh'),
  protocol: createDebugger('ble-mesh:protocol'),
  storage: createDebugger('ble-mesh:storage')
};

module.exports = {
  createDebugger,
  enable,
  disable,
  isEnabled,
  getEnabled,
  ...debuggers
};
