'use strict';

/**
 * @fileoverview Error classes for BLE Mesh Network library
 * @module errors
 */

const MeshError = require('./MeshError');
const CryptoError = require('./CryptoError');
const ConnectionError = require('./ConnectionError');
const HandshakeError = require('./HandshakeError');
const MessageError = require('./MessageError');
const ValidationError = require('./ValidationError');
const AudioError = require('./AudioError');

module.exports = {
  MeshError,
  CryptoError,
  ConnectionError,
  HandshakeError,
  MessageError,
  ValidationError,
  AudioError
};
