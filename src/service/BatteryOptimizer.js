'use strict';

/**
 * @fileoverview Battery Optimizer with Adaptive Power Modes
 * @module service/BatteryOptimizer
 *
 * Provides three power profiles (high/balanced/low) with automatic
 * scanning adjustments based on battery level and network activity.
 *
 * Target: <5% battery drain per hour in balanced mode.
 */

const EventEmitter = require('../utils/EventEmitter');

/**
 * Battery mode constants
 * @constant {any}
 */
const BATTERY_MODE = Object.freeze({
  HIGH_PERFORMANCE: 'high',
  BALANCED: 'balanced',
  LOW_POWER: 'low',
  AUTO: 'auto'
});

/** Pre-computed Set of valid battery modes for O(1) lookup */
const BATTERY_MODE_SET = new Set(Object.values(BATTERY_MODE));

/**
 * Battery profile configuration
 * @typedef {Object} BatteryProfile
 * @property {number} scanIntervalMs - BLE scan interval
 * @property {number} scanWindowMs - BLE scan window
 * @property {number} connectionIntervalMs - Connection interval
 * @property {number} advertisingIntervalMs - Advertising interval
 * @property {number} heartbeatIntervalMs - Heartbeat frequency
 * @property {string} description - Human-readable description
 */

/**
 * Default battery profiles
 * @constant {Record<string, BatteryProfile>}
 */
const DEFAULT_PROFILES = Object.freeze({
  [BATTERY_MODE.HIGH_PERFORMANCE]: {
    scanIntervalMs: 100,
    scanWindowMs: 50,
    connectionIntervalMs: 7.5,
    advertisingIntervalMs: 100,
    heartbeatIntervalMs: 10000,
    description: 'Maximum performance, high battery usage'
  },
  [BATTERY_MODE.BALANCED]: {
    scanIntervalMs: 500,
    scanWindowMs: 100,
    connectionIntervalMs: 30,
    advertisingIntervalMs: 500,
    heartbeatIntervalMs: 30000,
    description: 'Balanced performance and battery, <5% drain/hour'
  },
  [BATTERY_MODE.LOW_POWER]: {
    scanIntervalMs: 2000,
    scanWindowMs: 200,
    connectionIntervalMs: 100,
    advertisingIntervalMs: 2000,
    heartbeatIntervalMs: 60000,
    description: 'Minimum battery usage, reduced responsiveness'
  },
  [BATTERY_MODE.AUTO]: {
    // Auto mode uses balanced as base, adjusts dynamically
    scanIntervalMs: 500,
    scanWindowMs: 100,
    connectionIntervalMs: 30,
    advertisingIntervalMs: 500,
    heartbeatIntervalMs: 30000,
    description: 'Automatic adjustment based on battery level'
  }
});

/**
 * Battery level thresholds for auto mode
 * @constant {any}
 */
const BATTERY_THRESHOLDS = Object.freeze({
  HIGH: 50, // Above 50%: high performance
  MEDIUM: 20, // 20-50%: balanced
  LOW: 10, // 10-20%: low power
  CRITICAL: 5 // Below 5%: ultra low power
});

/**
 * Default configuration
 * @constant {any}
 */
const DEFAULT_CONFIG = Object.freeze({
  /** Initial battery mode */
  initialMode: BATTERY_MODE.BALANCED,
  /** Enable automatic mode switching */
  autoAdjust: true,
  /** Battery check interval (ms) */
  batteryCheckIntervalMs: 60000,
  /** Activity-based adjustment enabled */
  activityAdjust: true,
  /** Inactivity timeout for power reduction (ms) */
  inactivityTimeoutMs: 5 * 60 * 1000
});

/**
 * Battery Optimizer for adaptive power management.
 *
 * @class BatteryOptimizer
 * @extends EventEmitter
 * @example
 * const optimizer = new BatteryOptimizer();
 *
 * // Set mode manually
 * await optimizer.setMode(BATTERY_MODE.BALANCED);
 *
 * // Enable auto-adjustment
 * optimizer.setAutoAdjust(true);
 *
 * // Report battery level
 * optimizer.updateBatteryLevel(75);
 *
 * // Get current profile
 * const profile = optimizer.getCurrentProfile();
 */
class BatteryOptimizer extends EventEmitter {
  /**
     * Creates a new BatteryOptimizer instance.
     * @param {any} [options] - Configuration options
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
         * Battery profiles
         * @type {Record<string, any>}
         * @private
         */
    this._profiles = { ...DEFAULT_PROFILES };

    /**
         * Current battery mode
         * @type {string}
         * @private
         */
    this._currentMode = this._config.initialMode;

    /**
         * Current battery level (0-100)
         * @type {number}
         * @private
         */
    this._batteryLevel = 100;

    /**
         * Is charging
         * @type {boolean}
         * @private
         */
    this._isCharging = false;

    /**
         * Last activity timestamp
         * @type {number}
         * @private
         */
    this._lastActivityTime = Date.now();

    /**
         * Auto adjustment enabled
         * @type {boolean}
         * @private
         */
    this._autoAdjust = this._config.autoAdjust;

    /**
         * Battery check timer
         * @type {any}
         * @private
         */
    this._batteryCheckTimer = null;

    /**
         * Transport reference for applying settings
         * @type {any}
         * @private
         */
    this._transport = null;

    /**
         * Statistics
         * @type {any}
         * @private
         */
    this._stats = {
      modeChanges: 0,
      autoAdjustments: 0,
      lastModeChange: null
    };

    // Start battery monitoring if auto-adjust enabled
    if (this._autoAdjust) {
      this._startBatteryMonitoring();
    }
  }

  /**
     * Sets the transport to control.
     * @param {any} transport - Transport instance
     */
  setTransport(transport) {
    this._transport = transport;
  }

  /**
     * Sets the battery mode.
     * @param {string} mode - Battery mode
     * @returns {Promise<void>}
     */
  async setMode(mode) {
    // @ts-ignore
    if (!BATTERY_MODE_SET.has(mode)) {
      throw new Error(`Invalid battery mode: ${mode}`);
    }

    const previousMode = this._currentMode;
    this._currentMode = mode;

    // If switching to AUTO, determine actual profile from battery level
    const activeProfile = mode === BATTERY_MODE.AUTO
      ? this._getProfileForBatteryLevel(this._batteryLevel)
      : this._profiles[mode];

    // Apply to transport
    await this._applyProfile(activeProfile);

    this._stats.modeChanges++;
    this._stats.lastModeChange = Date.now();

    this.emit('mode-changed', {
      previous: previousMode,
      current: mode,
      profile: activeProfile
    });
  }

  /**
     * Gets the current battery mode.
     * @returns {string} Current mode
     */
  getMode() {
    return this._currentMode;
  }

  /**
     * Gets the current active profile.
     * @returns {any} Active profile
     */
  getCurrentProfile() {
    if (this._currentMode === BATTERY_MODE.AUTO) {
      return this._getProfileForBatteryLevel(this._batteryLevel);
    }
    return this._profiles[this._currentMode];
  }

  /**
     * Gets all available profiles.
     * @returns {Record<string, any>} Profiles
     */
  getProfiles() {
    return { ...this._profiles };
  }

  /**
     * Updates the battery level and triggers auto-adjustment if enabled.
     * @param {number} level - Battery level (0-100)
     * @param {boolean} [isCharging=false] - Whether device is charging
     */
  async updateBatteryLevel(level, isCharging = false) {
    const previousLevel = this._batteryLevel;
    this._batteryLevel = Math.max(0, Math.min(100, level));
    this._isCharging = isCharging;

    this.emit('battery-updated', {
      level: this._batteryLevel,
      isCharging,
      previousLevel
    });

    // Auto-adjust if enabled and in AUTO mode
    if (this._autoAdjust && this._currentMode === BATTERY_MODE.AUTO) {
      await this._autoAdjustMode();
    }
  }

  /**
     * Enables or disables auto-adjustment.
     * @param {boolean} enabled - Whether to enable
     */
  setAutoAdjust(enabled) {
    this._autoAdjust = enabled;

    if (enabled && !this._batteryCheckTimer) {
      this._startBatteryMonitoring();
    } else if (!enabled && this._batteryCheckTimer) {
      this._stopBatteryMonitoring();
    }

    this.emit('auto-adjust-changed', { enabled });
  }

  /**
     * Checks if auto-adjustment is enabled.
     * @returns {boolean} True if enabled
     */
  isAutoAdjustEnabled() {
    return this._autoAdjust;
  }

  /**
     * Records user activity (for activity-based optimization).
     */
  recordActivity() {
    this._lastActivityTime = Date.now();
  }

  /**
     * Gets the battery level.
     * @returns {number} Battery level (0-100)
     */
  getBatteryLevel() {
    return this._batteryLevel;
  }

  /**
     * Checks if device is charging.
     * @returns {boolean} True if charging
     */
  isCharging() {
    return this._isCharging;
  }

  /**
     * Gets optimizer statistics.
     * @returns {any} Statistics
     */
  getStats() {
    return {
      ...this._stats,
      currentMode: this._currentMode,
      batteryLevel: this._batteryLevel,
      isCharging: this._isCharging,
      autoAdjust: this._autoAdjust
    };
  }

  /**
     * Destroys the optimizer.
     */
  destroy() {
    this._stopBatteryMonitoring();
    this._transport = null;
    this.removeAllListeners();
  }

  /**
     * Gets the appropriate profile for a battery level.
     * @param {number} level - Battery level
     * @returns {any} Profile
     * @private
     */
  _getProfileForBatteryLevel(level) {
    if (this._isCharging) {
      return this._profiles[BATTERY_MODE.HIGH_PERFORMANCE];
    }

    if (level > BATTERY_THRESHOLDS.HIGH) {
      return this._profiles[BATTERY_MODE.HIGH_PERFORMANCE];
    } else if (level > BATTERY_THRESHOLDS.MEDIUM) {
      return this._profiles[BATTERY_MODE.BALANCED];
    } else {
      return this._profiles[BATTERY_MODE.LOW_POWER];
    }
  }

  /**
     * Auto-adjusts mode based on battery level.
     * @returns {Promise<void>}
     * @private
     */
  async _autoAdjustMode() {
    const profile = this._getProfileForBatteryLevel(this._batteryLevel);
    const currentProfile = this.getCurrentProfile();

    // Only apply if profile actually changed
    if (profile.scanIntervalMs !== currentProfile.scanIntervalMs) {
      await this._applyProfile(profile);
      this._stats.autoAdjustments++;

      this.emit('auto-adjusted', {
        batteryLevel: this._batteryLevel,
        profile
      });
    }
  }

  /**
     * Applies a battery profile to the transport.
     * @param {any} profile - Profile to apply
     * @returns {Promise<void>}
     * @private
     */
  async _applyProfile(profile) {
    if (!this._transport) {
      return;
    }

    try {
      // Apply scan parameters
      if (typeof this._transport.setScanParameters === 'function') {
        await this._transport.setScanParameters({
          interval: profile.scanIntervalMs,
          window: profile.scanWindowMs
        });
      }

      // Apply connection parameters
      if (typeof this._transport.setConnectionParameters === 'function') {
        await this._transport.setConnectionParameters({
          interval: profile.connectionIntervalMs
        });
      }

      // Apply advertising parameters
      if (typeof this._transport.setAdvertisingInterval === 'function') {
        await this._transport.setAdvertisingInterval(profile.advertisingIntervalMs);
      }

      this.emit('profile-applied', { profile });
    } catch (/** @type {any} */ error) {
      this.emit('error', {
        message: 'Failed to apply battery profile',
        error: error.message
      });
    }
  }

  /**
     * Starts battery monitoring timer.
     * @private
     */
  _startBatteryMonitoring() {
    if (this._batteryCheckTimer) {
      return;
    }

    this._batteryCheckTimer = setInterval(
      async () => {
        // Check for inactivity
        if (this._config.activityAdjust) {
          const inactiveTime = Date.now() - this._lastActivityTime;
          if (inactiveTime > this._config.inactivityTimeoutMs) {
            // Switch to low power if inactive
            if (this._currentMode === BATTERY_MODE.AUTO) {
              await this._applyProfile(this._profiles[BATTERY_MODE.LOW_POWER]);
            }
          }
        }
      },
      this._config.batteryCheckIntervalMs
    );
    // Don't prevent process exit (important for tests and cleanup)
    if (this._batteryCheckTimer && typeof this._batteryCheckTimer.unref === 'function') {
      this._batteryCheckTimer.unref();
    }
  }

  /**
     * Stops battery monitoring timer.
     * @private
     */
  _stopBatteryMonitoring() {
    if (this._batteryCheckTimer) {
      clearInterval(this._batteryCheckTimer);
      this._batteryCheckTimer = null;
    }
  }
}

module.exports = {
  BatteryOptimizer,
  BATTERY_MODE,
  BATTERY_THRESHOLDS,
  DEFAULT_PROFILES,
  DEFAULT_CONFIG
};
