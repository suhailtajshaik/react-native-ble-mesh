'use strict';

/**
 * @fileoverview Emergency Manager for Panic Mode / Data Wipe
 * @module service/EmergencyManager
 *
 * Provides panic mode functionality for immediate data wipe.
 * Critical security feature for high-risk users (activists, protesters).
 * Target: <200ms wipe completion time.
 */

const EventEmitter = require('../utils/EventEmitter');

/**
 * Panic trigger types
 * @constant {Object}
 */
const PANIC_TRIGGER = Object.freeze({
  TRIPLE_TAP: 'triple_tap',
  SHAKE: 'shake',
  MANUAL: 'manual',
  VOLUME_COMBO: 'volume_combo'
});

/**
 * Default configuration
 * @constant {Object}
 */
const DEFAULT_CONFIG = Object.freeze({
  /** Trigger type for panic mode */
  trigger: PANIC_TRIGGER.TRIPLE_TAP,
  /** Time window for multi-tap detection (ms) */
  tapWindowMs: 500,
  /** Number of taps required */
  tapCount: 3,
  /** Shake threshold for accelerometer */
  shakeThreshold: 15,
  /** Shake duration required (ms) */
  shakeDurationMs: 500,
  /** Confirmation required before wipe */
  requireConfirmation: false,
  /** Target wipe time (ms) */
  targetWipeTimeMs: 200
});

/**
 * Emergency Manager for panic mode and data wipe.
 *
 * @class EmergencyManager
 * @extends EventEmitter
 * @example
 * const emergency = new EmergencyManager({
 *   trigger: 'triple_tap',
 * });
 *
 * emergency.enablePanicMode({
 *   onWipe: () => console.log('Data wiped'),
 * });
 *
 * // Register tap events
 * emergency.registerTap();
 */
class EmergencyManager extends EventEmitter {
  /**
     * Creates a new EmergencyManager instance.
     * @param {Object} [options={}] - Configuration options
     * @param {string} [options.trigger='triple_tap'] - Panic trigger type
     * @param {number} [options.tapWindowMs=500] - Time window for taps
     * @param {number} [options.tapCount=3] - Required tap count
     * @param {boolean} [options.requireConfirmation=false] - Require confirmation
     */
  constructor(options = {}) {
    super();

    /**
         * Configuration
         * @type {Object}
         * @private
         */
    this._config = { ...DEFAULT_CONFIG, ...options };

    /**
         * Whether panic mode is enabled
         * @type {boolean}
         * @private
         */
    this._enabled = false;

    /**
         * Tap tracking
         * @type {Object}
         * @private
         */
    this._tapState = {
      count: 0,
      lastTapTime: 0
    };

    /**
         * Shake tracking
         * @type {Object}
         * @private
         */
    this._shakeState = {
      startTime: 0,
      isShaking: false
    };

    /**
         * Wipe callback
         * @type {Function|null}
         * @private
         */
    this._onWipe = null;

    /**
         * Data clearers to execute during wipe
         * @type {Function[]}
         * @private
         */
    this._clearers = [];

    /**
         * Statistics
         * @type {Object}
         * @private
         */
    this._stats = {
      wipesTriggered: 0,
      averageWipeTimeMs: 0,
      lastWipeTime: null
    };
  }

  /**
     * Enables panic mode.
     * @param {Object} [options={}] - Enable options
     * @param {Function} [options.onWipe] - Callback after wipe
     * @param {string} [options.trigger] - Override trigger type
     */
  enablePanicMode(options = {}) {
    this._enabled = true;
    this._onWipe = options.onWipe || null;

    if (options.trigger) {
      this._config.trigger = options.trigger;
    }

    this.emit('panic-mode-enabled', {
      trigger: this._config.trigger
    });
  }

  /**
     * Disables panic mode.
     */
  disablePanicMode() {
    this._enabled = false;
    this._resetTapState();
    this._resetShakeState();

    this.emit('panic-mode-disabled');
  }

  /**
     * Checks if panic mode is enabled.
     * @returns {boolean} True if enabled
     */
  isEnabled() {
    return this._enabled;
  }

  /**
     * Registers a data clearer function.
     * @param {Function} clearer - Async function to clear data
     */
  registerClearer(clearer) {
    if (typeof clearer === 'function') {
      this._clearers.push(clearer);
    }
  }

  /**
     * Registers a tap event (for triple-tap detection).
     */
  registerTap() {
    if (!this._enabled || this._config.trigger !== PANIC_TRIGGER.TRIPLE_TAP) {
      return;
    }

    const now = Date.now();
    const windowExpired = (now - this._tapState.lastTapTime) > this._config.tapWindowMs;

    if (windowExpired) {
      this._tapState.count = 1;
    } else {
      this._tapState.count++;
    }

    this._tapState.lastTapTime = now;

    // Check if threshold reached
    if (this._tapState.count >= this._config.tapCount) {
      this._triggerPanic(PANIC_TRIGGER.TRIPLE_TAP);
      this._resetTapState();
    }
  }

  /**
     * Registers accelerometer data for shake detection.
     * @param {Object} data - Accelerometer data
     * @param {number} data.x - X acceleration
     * @param {number} data.y - Y acceleration
     * @param {number} data.z - Z acceleration
     */
  registerAccelerometer(data) {
    if (!this._enabled || this._config.trigger !== PANIC_TRIGGER.SHAKE) {
      return;
    }

    const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
    const now = Date.now();

    if (magnitude > this._config.shakeThreshold) {
      if (!this._shakeState.isShaking) {
        this._shakeState.isShaking = true;
        this._shakeState.startTime = now;
      } else if ((now - this._shakeState.startTime) >= this._config.shakeDurationMs) {
        this._triggerPanic(PANIC_TRIGGER.SHAKE);
        this._resetShakeState();
      }
    } else {
      this._resetShakeState();
    }
  }

  /**
     * Manually triggers panic wipe.
     * @returns {Promise<Object>} Wipe result
     */
  async triggerManualWipe() {
    return this._executeWipe(PANIC_TRIGGER.MANUAL);
  }

  /**
     * Wipes all registered data.
     * @returns {Promise<Object>} Wipe result with timing
     */
  async wipeAllData() {
    return this._executeWipe(PANIC_TRIGGER.MANUAL);
  }

  /**
     * Gets emergency statistics.
     * @returns {Object} Statistics
     */
  getStats() {
    return { ...this._stats };
  }

  /**
     * Destroys the manager.
     */
  destroy() {
    this.disablePanicMode();
    this._clearers = [];
    this.removeAllListeners();
  }

  /**
     * Triggers panic mode.
     * @param {string} trigger - Trigger type
     * @private
     */
  _triggerPanic(trigger) {
    if (this._config.requireConfirmation) {
      this.emit('panic-confirmation-required', { trigger });
      return;
    }

    this._executeWipe(trigger);
  }

  /**
     * Executes the data wipe.
     * @param {string} trigger - Trigger type
     * @returns {Promise<Object>} Wipe result
     * @private
     */
  async _executeWipe(trigger) {
    const startTime = Date.now();

    this.emit('panic-wipe-started', { trigger, timestamp: startTime });

    const results = {
      trigger,
      startTime,
      clearerResults: [],
      errors: []
    };

    // Execute all clearers in parallel for speed
    const promises = this._clearers.map(async (clearer, index) => {
      try {
        await clearer();
        results.clearerResults.push({ index, success: true });
      } catch (error) {
        results.errors.push({ index, error: error.message });
        results.clearerResults.push({ index, success: false, error: error.message });
      }
    });

    await Promise.all(promises);

    const endTime = Date.now();
    const elapsedMs = endTime - startTime;

    // Update stats with correct running average calculation
    const previousCount = this._stats.wipesTriggered;
    this._stats.wipesTriggered++;
    this._stats.lastWipeTime = endTime;
    // Proper running average: ((oldAvg * oldCount) + newValue) / newCount
    this._stats.averageWipeTimeMs = previousCount > 0
      ? ((this._stats.averageWipeTimeMs * previousCount) + elapsedMs) / this._stats.wipesTriggered
      : elapsedMs;

    results.endTime = endTime;
    results.elapsedMs = elapsedMs;
    results.metTarget = elapsedMs <= this._config.targetWipeTimeMs;

    this.emit('panic-wipe-completed', results);

    // Call user callback
    if (this._onWipe) {
      try {
        this._onWipe(results);
      } catch (error) {
        // Ignore callback errors
      }
    }

    console.log(`Panic wipe completed in ${elapsedMs}ms`);

    return results;
  }

  /**
     * Resets tap state.
     * @private
     */
  _resetTapState() {
    this._tapState.count = 0;
    this._tapState.lastTapTime = 0;
  }

  /**
     * Resets shake state.
     * @private
     */
  _resetShakeState() {
    this._shakeState.isShaking = false;
    this._shakeState.startTime = 0;
  }
}

module.exports = {
  EmergencyManager,
  PANIC_TRIGGER,
  DEFAULT_CONFIG
};
