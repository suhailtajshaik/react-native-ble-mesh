'use strict';

/**
 * @fileoverview Storage module exports
 * @module storage
 */

const Storage = require('./Storage');
const MemoryStorage = require('./MemoryStorage');
const AsyncStorageAdapter = require('./AsyncStorageAdapter');
const MessageStore = require('./MessageStore');

module.exports = {
  Storage,
  MemoryStorage,
  AsyncStorageAdapter,
  MessageStore
};
