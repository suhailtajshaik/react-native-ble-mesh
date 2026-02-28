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

/**
 * Detects and returns the best available crypto provider.
 * @returns {import('./CryptoProvider')} Best available provider
 * @throws {Error} If no crypto provider is available
 */
function detectProvider() {
  // 1. Native speed (react-native-quick-crypto)
  if (QuickCryptoProvider.isAvailable()) {
    return new QuickCryptoProvider();
  }

  // 2. Expo (expo-crypto + tweetnacl)
  if (ExpoCryptoProvider.isAvailable()) {
    return new ExpoCryptoProvider();
  }

  // 3. Universal (tweetnacl)
  if (TweetNaClProvider.isAvailable()) {
    return new TweetNaClProvider();
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

  if (typeof config === 'object' && typeof config.generateKeyPair === 'function') {
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
