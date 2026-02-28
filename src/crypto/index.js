'use strict';

/**
 * @fileoverview Crypto module — pluggable provider system
 * @module crypto
 *
 * Provides a CryptoProvider interface with auto-detection:
 * - TweetNaClProvider (tweetnacl) — works everywhere
 * - QuickCryptoProvider (react-native-quick-crypto) — native speed
 * - ExpoCryptoProvider (expo-crypto) — for Expo projects
 */

const CryptoProvider = require('./CryptoProvider');
const { TweetNaClProvider, QuickCryptoProvider, ExpoCryptoProvider } = require('./providers');
const { detectProvider, createProvider } = require('./AutoCrypto');

module.exports = {
  CryptoProvider,
  TweetNaClProvider,
  QuickCryptoProvider,
  ExpoCryptoProvider,
  detectProvider,
  createProvider
};
