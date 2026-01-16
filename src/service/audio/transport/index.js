'use strict';

/**
 * @fileoverview Audio transport module exports
 * @module audio/transport
 */

const AudioFramer = require('./AudioFramer');
const { AudioFragmenter, AudioAssembler } = require('./AudioFragmenter');

module.exports = {
  ...AudioFramer,
  AudioFragmenter,
  AudioAssembler
};
