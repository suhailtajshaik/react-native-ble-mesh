'use strict';

/**
 * @fileoverview Safe timeout management with automatic cleanup
 * @module utils/TimeoutManager
 */

/**
 * Manages timeouts with automatic cleanup to prevent memory leaks.
 * Essential for React Native where component unmounts don't clear timers.
 *
 * @class TimeoutManager
 * @example
 * const timeouts = new TimeoutManager();
 * timeouts.set('retry', () => retryOperation(), 5000);
 * // Later, or on cleanup:
 * timeouts.clear('retry');
 * // Or clear all:
 * timeouts.clearAll();
 */
class TimeoutManager {
  constructor() {
    /** @private */
    this._timeouts = new Map();
    /** @private */
    this._intervals = new Map();
  }

  /**
   * Set a timeout (clears existing timeout with same key)
   * @param {string} key - Unique identifier for this timeout
   * @param {Function} callback - Function to call when timeout fires
   * @param {number} delay - Delay in milliseconds
   * @returns {TimeoutManager} This instance for chaining
   */
  set(key, callback, delay) {
    this.clear(key);
    const id = setTimeout(() => {
      this._timeouts.delete(key);
      callback();
    }, delay);
    this._timeouts.set(key, id);
    return this;
  }

  /**
   * Set an interval (clears existing interval with same key)
   * @param {string} key - Unique identifier for this interval
   * @param {Function} callback - Function to call on each interval
   * @param {number} interval - Interval in milliseconds
   * @returns {TimeoutManager} This instance for chaining
   */
  setInterval(key, callback, interval) {
    this.clearInterval(key);
    const id = setInterval(callback, interval);
    this._intervals.set(key, id);
    return this;
  }

  /**
   * Clear a timeout by key
   * @param {string} key - The timeout key to clear
   * @returns {boolean} True if timeout was cleared
   */
  clear(key) {
    if (this._timeouts.has(key)) {
      clearTimeout(this._timeouts.get(key));
      this._timeouts.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Clear an interval by key
   * @param {string} key - The interval key to clear
   * @returns {boolean} True if interval was cleared
   */
  clearInterval(key) {
    if (this._intervals.has(key)) {
      clearInterval(this._intervals.get(key));
      this._intervals.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Check if a timeout exists
   * @param {string} key - The timeout key
   * @returns {boolean} True if timeout exists
   */
  has(key) {
    return this._timeouts.has(key);
  }

  /**
   * Check if an interval exists
   * @param {string} key - The interval key
   * @returns {boolean} True if interval exists
   */
  hasInterval(key) {
    return this._intervals.has(key);
  }

  /**
   * Clear all timeouts
   * @returns {number} Number of timeouts cleared
   */
  clearAllTimeouts() {
    const count = this._timeouts.size;
    for (const id of this._timeouts.values()) {
      clearTimeout(id);
    }
    this._timeouts.clear();
    return count;
  }

  /**
   * Clear all intervals
   * @returns {number} Number of intervals cleared
   */
  clearAllIntervals() {
    const count = this._intervals.size;
    for (const id of this._intervals.values()) {
      clearInterval(id);
    }
    this._intervals.clear();
    return count;
  }

  /**
   * Clear all timeouts and intervals
   * @returns {number} Total number cleared
   */
  clearAll() {
    return this.clearAllTimeouts() + this.clearAllIntervals();
  }

  /**
   * Get count of active timeouts
   * @returns {number} Number of active timeouts
   */
  get timeoutCount() {
    return this._timeouts.size;
  }

  /**
   * Get count of active intervals
   * @returns {number} Number of active intervals
   */
  get intervalCount() {
    return this._intervals.size;
  }

  /**
   * Destroy the manager (clears all timers)
   */
  destroy() {
    this.clearAll();
  }
}

module.exports = TimeoutManager;
