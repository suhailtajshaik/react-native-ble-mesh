'use strict';

/**
 * @fileoverview Time-related utilities
 * @module utils/time
 */

/**
 * Returns a promise that resolves after the specified delay
 * @param {number} ms - Delay in milliseconds
 * @returns {Promise<void>} Promise that resolves after delay
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wraps a promise with a timeout
 * @template T
 * @param {Promise<T>} promise - Promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @param {string} [message='Operation timed out'] - Error message on timeout
 * @returns {Promise<T>} Promise that rejects on timeout
 */
function withTimeout(promise, ms, message = 'Operation timed out') {
  /** @type {any} */ let timeoutId;

  /** @type {Promise<T>} */
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(message));
    }, ms);
  });

  return Promise.race([
    promise.then((/** @type {T} */ result) => {
      clearTimeout(timeoutId);
      return result;
    }).catch((/** @type {any} */ error) => {
      clearTimeout(timeoutId);
      throw error;
    }),
    timeoutPromise
  ]);
}

/**
 * Returns the current timestamp in milliseconds
 * @returns {number} Current timestamp in milliseconds since epoch
 */
function now() {
  return Date.now();
}

/**
 * Returns a high-resolution timestamp for performance measurements
 * Falls back to Date.now() if performance API is not available
 * @returns {number} High-resolution timestamp
 */
function hrTime() {
  // @ts-ignore - performance may be available in some environments
  if (typeof performance !== 'undefined' && performance.now) {
    // @ts-ignore
    return performance.now();
  }
  return Date.now();
}

/**
 * Calculates time elapsed since a given timestamp
 * @param {number} startTime - Start timestamp
 * @returns {number} Elapsed time in milliseconds
 */
function elapsed(startTime) {
  return now() - startTime;
}

/**
 * Checks if a timestamp has expired based on a TTL
 * @param {number} timestamp - Timestamp to check
 * @param {number} ttlMs - Time-to-live in milliseconds
 * @returns {boolean} True if timestamp has expired
 */
function isExpired(timestamp, ttlMs) {
  return now() > timestamp + ttlMs;
}

/**
 * Formats a duration in milliseconds to a human-readable string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration (e.g., "5m 30s")
 */
function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / 60000) % 60;
  const hours = Math.floor(ms / 3600000);

  const parts = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (seconds > 0) {
    parts.push(`${seconds}s`);
  }

  return parts.join(' ') || '0s';
}

/**
 * Creates a debounced function that delays invocation
 * @template T
 * @param {function(...*): T} fn - Function to debounce
 * @param {number} waitMs - Delay in milliseconds
 * @returns {function(...*): void} Debounced function
 */
function debounce(fn, waitMs) {
  /** @type {any} */ let timeoutId = null;

  return function debounced(...args) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      timeoutId = null;
      // @ts-ignore
      fn.apply(this, args);
    }, waitMs);
  };
}

/**
 * Creates a throttled function that only invokes at most once per interval
 * @template T
 * @param {function(...*): T} fn - Function to throttle
 * @param {number} intervalMs - Minimum interval in milliseconds
 * @returns {function(...*): T|undefined} Throttled function
 */
function throttle(fn, intervalMs) {
  let lastCall = 0;

  return function throttled(...args) {
    const currentTime = now();

    if (currentTime - lastCall >= intervalMs) {
      lastCall = currentTime;
      // @ts-ignore
      return fn.apply(this, args);
    }
  };
}

module.exports = {
  delay,
  withTimeout,
  now,
  hrTime,
  elapsed,
  isExpired,
  formatDuration,
  debounce,
  throttle
};
