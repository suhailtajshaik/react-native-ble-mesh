'use strict';

/**
 * @fileoverview Auto-detect best available crypto provider
 * @module crypto/AutoCrypto
 *
 * Priority order:
 * 1. react-native-quick-crypto (native speed)
 * 2. expo-crypto + tweetnacl (Expo projects)
 * 3. tweetnacl (universal fallback)
 */

const QuickCryptoProvider = require('./providers/QuickCryptoProvider');
const ExpoCryptoProvider = require('./providers/ExpoCryptoProvider');
const TweetNaClProvider = require('./providers/TweetNaClProvider');

/** @type {import('./CryptoProvider')|null} Cached singleton provider */
let _cachedProvider = null;

/**
 * Detects and returns the best available crypto provider.
 * The result is cached as a singleton for subsequent calls.
 * @returns {import('./CryptoProvider')} Best available provider
 * @throws {Error} If no crypto provider is available
 */
function detectProvider() {
  if (_cachedProvider) {
    return _cachedProvider;
  }

  // 1. Native speed (react-native-quick-crypto)
  if (QuickCryptoProvider.isAvailable()) {
    _cachedProvider = new QuickCryptoProvider();
    return _cachedProvider;
  }

  // 2. Expo (expo-crypto + tweetnacl)
  if (ExpoCryptoProvider.isAvailable()) {
    _cachedProvider = new ExpoCryptoProvider();
    return _cachedProvider;
  }

  // 3. Universal (tweetnacl)
  if (TweetNaClProvider.isAvailable()) {
    _cachedProvider = new TweetNaClProvider();
    return _cachedProvider;
  }

  throw new Error(
    'No crypto provider available. Install one of:\n' +
    '  npm install tweetnacl                    (works everywhere)\n' +
    '  npm install react-native-quick-crypto    (native speed)\n' +
    '  npx expo install expo-crypto && npm install tweetnacl  (Expo)'
  );
}

/**
 * Creates a crypto provider from a config value.
 * @param {string|Object|null} config - 'auto', provider name, or provider instance
 * @returns {import('./CryptoProvider')}
 */
function createProvider(config) {
  if (!config || config === 'auto') {
    return detectProvider();
  }

  // @ts-ignore
  if (typeof config === 'object' && typeof config.generateKeyPair === 'function') {
    // @ts-ignore
    return config; // Already a provider instance
  }

  if (typeof config === 'string') {
    switch (config) {
      case 'tweetnacl':
        return new TweetNaClProvider();
      case 'quick-crypto':
        return new QuickCryptoProvider();
      case 'expo-crypto':
        return new ExpoCryptoProvider();
      default:
        throw new Error(`Unknown crypto provider: ${config}`);
    }
  }

  throw new Error('Invalid crypto config: expected "auto", provider name, or provider instance');
}

module.exports = {
  detectProvider,
  createProvider
};
