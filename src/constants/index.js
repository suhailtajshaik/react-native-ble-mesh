/**
 * @fileoverview Constants module exports
 * @module constants
 */

'use strict';

const protocol = require('./protocol');
const ble = require('./ble');
// Crypto constants kept for protocol compatibility
const crypto = require('./crypto');
const errors = require('./errors');
const events = require('./events');
const audio = require('./audio');

module.exports = {
  ...protocol,
  ...ble,
  ...crypto,
  ...errors,
  ...events,
  ...audio
};
