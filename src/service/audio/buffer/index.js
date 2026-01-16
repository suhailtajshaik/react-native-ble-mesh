'use strict';

/**
 * @fileoverview Audio buffer module exports
 * @module audio/buffer
 */

const FrameBuffer = require('./FrameBuffer');
const JitterBuffer = require('./JitterBuffer');

module.exports = {
  FrameBuffer,
  JitterBuffer
};
