'use strict';

/**
 * @fileoverview Enhanced EventEmitter class
 * @module utils/EventEmitter
 */

/**
 * Enhanced EventEmitter with typed events and memory leak prevention
 * @class EventEmitter
 */
class EventEmitter {
  /**
   * Creates a new EventEmitter
   * @param {Object} [options] - Configuration options
   * @param {number} [options.maxListeners=10] - Maximum listeners per event
   */
  constructor(options = {}) {
    /**
     * Event listeners map
     * @type {Map<string, Array<{listener: Function, once: boolean}>>}
     * @private
     */
    this._events = new Map();

    /**
     * Maximum listeners per event
     * @type {number}
     * @private
     */
    this._maxListeners = options.maxListeners || 10;
  }

  /**
   * Adds an event listener
   * @param {string} event - Event name
   * @param {Function} listener - Event handler
   * @returns {EventEmitter} This instance for chaining
   */
  on(event, listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('Listener must be a function');
    }

    if (!this._events.has(event)) {
      this._events.set(event, []);
    }

    const listeners = this._events.get(event);

    // Warn if max listeners exceeded
    if (listeners.length >= this._maxListeners) {
      console.warn(
        'MaxListenersExceededWarning: Possible EventEmitter memory leak detected. ' +
        `${listeners.length + 1} ${event} listeners added. ` +
        'Use setMaxListeners() to increase limit'
      );
    }

    listeners.push({ listener, once: false });
    return this;
  }

  /**
   * Adds a one-time event listener
   * @param {string} event - Event name
   * @param {Function} listener - Event handler
   * @returns {EventEmitter} This instance for chaining
   */
  once(event, listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('Listener must be a function');
    }

    if (!this._events.has(event)) {
      this._events.set(event, []);
    }

    this._events.get(event).push({ listener, once: true });
    return this;
  }

  /**
   * Removes an event listener
   * @param {string} event - Event name
   * @param {Function} listener - Event handler to remove
   * @returns {EventEmitter} This instance for chaining
   */
  off(event, listener) {
    if (!this._events.has(event)) {
      return this;
    }

    const listeners = this._events.get(event);
    const index = listeners.findIndex(entry => entry.listener === listener);

    if (index !== -1) {
      listeners.splice(index, 1);
    }

    if (listeners.length === 0) {
      this._events.delete(event);
    }

    return this;
  }

  /**
   * Emits an event to all registered listeners
   * @param {string} event - Event name
   * @param {...*} args - Arguments to pass to listeners
   * @returns {boolean} True if event had listeners
   */
  emit(event, ...args) {
    if (!this._events.has(event)) {
      return false;
    }

    const listeners = this._events.get(event);
    const hasOnce = listeners.some(e => e.once);
    const iterList = hasOnce ? listeners.slice() : listeners;

    for (const entry of iterList) {
      try {
        entry.listener.apply(this, args);
      } catch (error) {
        // Emit error event or log if error event fails
        if (event !== 'error') {
          this.emit('error', error);
        } else {
          console.error('Error in error handler:', error);
        }
      }
    }

    // Remove one-time listeners
    if (hasOnce) {
      const remaining = listeners.filter(e => !e.once);
      if (remaining.length === 0) {
        this._events.delete(event);
      } else {
        this._events.set(event, remaining);
      }
    }

    return true;
  }

  /**
   * Removes all listeners for an event or all events
   * @param {string} [event] - Event name (optional, removes all if not provided)
   * @returns {EventEmitter} This instance for chaining
   */
  removeAllListeners(event) {
    if (event === undefined) {
      this._events.clear();
    } else {
      this._events.delete(event);
    }
    return this;
  }

  /**
   * Returns the number of listeners for an event
   * @param {string} event - Event name
   * @returns {number} Number of listeners
   */
  listenerCount(event) {
    if (!this._events.has(event)) {
      return 0;
    }
    return this._events.get(event).length;
  }

  /**
   * Returns all event names with listeners
   * @returns {string[]} Array of event names
   */
  eventNames() {
    return Array.from(this._events.keys());
  }

  /**
   * Sets the maximum number of listeners per event
   * @param {number} n - Maximum listeners
   * @returns {EventEmitter} This instance for chaining
   */
  setMaxListeners(n) {
    this._maxListeners = n;
    return this;
  }

  /**
   * Gets the maximum number of listeners per event
   * @returns {number} Maximum listeners
   */
  getMaxListeners() {
    return this._maxListeners;
  }
}

module.exports = EventEmitter;
