/**
 * @fileoverview Mesh module exports
 * @module mesh
 */

'use strict';

const dedup = require('./dedup');
const fragment = require('./fragment');
const peer = require('./peer');
const router = require('./router');

module.exports = {
  ...dedup,
  ...fragment,
  ...peer,
  ...router
};
