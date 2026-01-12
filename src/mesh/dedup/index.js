'use strict';

/**
 * @fileoverview Deduplication module exports
 * @module mesh/dedup
 */

const BloomFilter = require('./BloomFilter');
const MessageCache = require('./MessageCache');
const DedupManager = require('./DedupManager');

module.exports = {
  BloomFilter,
  MessageCache,
  DedupManager
};
