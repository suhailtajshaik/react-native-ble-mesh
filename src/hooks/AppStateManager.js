'use strict';

/**
 * @fileoverview React Native app state management for mesh service
 * @module hooks/AppStateManager
 */

/**
 * Manages React Native app state transitions for mesh service.
 * Automatically handles background/foreground power mode switching.
 *
 * @class AppStateManager
 *
 * @example
 * const mesh = new MeshService();
 * const appStateManager = new AppStateManager(mesh);
 * appStateManager.initialize();
 *
 * // On component unmount:
 * appStateManager.destroy();
 */
class AppStateManager {
  /**
   * Creates a new AppStateManager
   * @param {MeshService} mesh - MeshService instance to manage
   * @param {Object} [options] - Configuration options
   * @param {string} [options.backgroundMode='ULTRA_POWER_SAVER'] - Power mode for background
   * @param {string} [options.foregroundMode='BALANCED'] - Power mode for foreground
   * @param {boolean} [options.autoSaveState=true] - Auto save state on background
   */
  constructor(mesh, options = {}) {
    /** @private */
    this._mesh = mesh;
    /** @private */
    this._options = {
      backgroundMode: options.backgroundMode || 'ULTRA_POWER_SAVER',
      foregroundMode: options.foregroundMode || 'BALANCED',
      autoSaveState: options.autoSaveState !== false
    };
    /** @private */
    this._appState = 'active';
    /** @private */
    this._subscription = null;
    /** @private */
    this._initialized = false;
    /** @private */
    this._AppState = null;
  }

  /**
   * Initialize app state monitoring
   * @returns {boolean} True if initialized, false if AppState not available
   */
  initialize() {
    if (this._initialized) { return true; }

    // Try to get AppState from React Native
    try {
      const { AppState } = require('react-native');
      this._AppState = AppState;
    } catch (e) {
      // React Native not available (Node.js environment)
      console.warn('AppStateManager: React Native AppState not available');
      return false;
    }

    this._subscription = this._AppState.addEventListener(
      'change',
      this._handleStateChange.bind(this)
    );

    this._initialized = true;
    return true;
  }

  /**
   * Handle app state change
   * @private
   * @param {string} nextAppState - New app state
   */
  _handleStateChange(nextAppState) {
    const wasActive = this._appState === 'active';
    const isActive = nextAppState === 'active';

    // Going to background
    if (wasActive && !isActive) {
      this._onBackground();
    }

    // Coming to foreground
    if (!wasActive && isActive) {
      this._onForeground();
    }

    this._appState = nextAppState;
  }

  /**
   * Called when app goes to background
   * @private
   */
  _onBackground() {
    if (!this._mesh) { return; }

    try {
      // Switch to power saver mode
      if (typeof this._mesh.setPowerMode === 'function') {
        this._mesh.setPowerMode(this._options.backgroundMode);
      }

      // Save state if enabled
      if (this._options.autoSaveState && typeof this._mesh._saveState === 'function') {
        this._mesh._saveState();
      }
    } catch (e) {
      console.warn('AppStateManager: Error handling background transition', e);
    }
  }

  /**
   * Called when app comes to foreground
   * @private
   */
  _onForeground() {
    if (!this._mesh) { return; }

    try {
      // Restore normal power mode
      if (typeof this._mesh.setPowerMode === 'function') {
        this._mesh.setPowerMode(this._options.foregroundMode);
      }

      // Restore state if enabled
      if (this._options.autoSaveState && typeof this._mesh._restoreState === 'function') {
        this._mesh._restoreState();
      }
    } catch (e) {
      console.warn('AppStateManager: Error handling foreground transition', e);
    }
  }

  /**
   * Get current app state
   * @returns {string} Current app state ('active', 'background', 'inactive')
   */
  getAppState() {
    return this._appState;
  }

  /**
   * Check if app is in foreground
   * @returns {boolean} True if app is active
   */
  isActive() {
    return this._appState === 'active';
  }

  /**
   * Check if app is in background
   * @returns {boolean} True if app is in background
   */
  isBackground() {
    return this._appState === 'background';
  }

  /**
   * Destroy the manager and cleanup subscriptions
   */
  destroy() {
    if (this._subscription) {
      this._subscription.remove();
      this._subscription = null;
    }
    this._mesh = null;
    this._initialized = false;
  }
}

module.exports = AppStateManager;
