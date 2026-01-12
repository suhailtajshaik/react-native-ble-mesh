'use strict';

/**
 * @fileoverview Fragment module exports
 * @module mesh/fragment
 */

const Fragmenter = require('./Fragmenter');
const Assembler = require('./Assembler');

module.exports = {
  // Fragmenter exports
  fragment: Fragmenter.fragment,
  needsFragmentation: Fragmenter.needsFragmentation,
  parseFragmentHeader: Fragmenter.parseFragmentHeader,
  getFragmentInfo: Fragmenter.getFragmentInfo,
  isValidFragment: Fragmenter.isValidFragment,
  FRAGMENT_HEADER_SIZE: Fragmenter.FRAGMENT_HEADER_SIZE,
  // Assembler class
  Assembler
};
