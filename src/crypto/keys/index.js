'use strict';

/**
 * Keys Module
 * Re-exports all key management components.
 * @module crypto/keys
 */

const { KeyPair, KEY_SIZE } = require('./KeyPair');
const { KeyManager, DEFAULT_IDENTITY_KEY } = require('./KeyManager');
const {
  SecureStorage,
  MemorySecureStorage,
  createAsyncStorageAdapter,
  createExpoSecureStoreAdapter
} = require('./SecureStorage');

module.exports = {
  // KeyPair
  KeyPair,
  KEY_SIZE,

  // KeyManager
  KeyManager,
  DEFAULT_IDENTITY_KEY,

  // SecureStorage
  SecureStorage,
  MemorySecureStorage,
  createAsyncStorageAdapter,
  createExpoSecureStoreAdapter
};
