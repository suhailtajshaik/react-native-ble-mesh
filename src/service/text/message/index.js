'use strict';

/**
 * @fileoverview Text message module exports
 * @module service/text/message
 */

const TextMessage = require('./TextMessage');
const TextSerializer = require('./TextSerializer');

module.exports = {
  TextMessage,
  ...TextSerializer
};
